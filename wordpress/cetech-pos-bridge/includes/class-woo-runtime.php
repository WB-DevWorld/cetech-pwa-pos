<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Authoritative Woo cart/session/customer adapter.
 * Pricing comes only from WC_Cart::calculate_totals() and resulting cart totals.
 * This class does not copy WoodMart or B2BKing formulas.
 */
class Cetech_Pos_Bridge_Woo_Runtime {
	/** @var Cetech_Pos_Bridge_Environment */
	protected $environment;
	/** @var array<string,int> */
	protected $side_effects = array(
		'orders'   => 0,
		'stock'    => 0,
		'payments' => 0,
		'mail'     => 0,
	);
	/** @var int */
	protected $counter_sale_isolation_depth = 0;
	/** @var bool */
	protected $added_b2bking_cart_discount = false;
	/** @var int */
	public $create_calls = 0;
	/** @var callable|null test seam immediately after wc_create_order, before recovery metadata save */
	public $after_wc_create = null;
	/** @var callable|null test seam after recovery metadata save, before wc_reserve_stock_for_order */
	public $after_meta_save = null;
	/** @var array<string,array<string,mixed>> last authoritative cart tax-rate breakdown, not a wire field */
	protected $last_provider_tax = array();

	public function __construct( Cetech_Pos_Bridge_Environment $environment ) {
		$this->environment = $environment;
	}

	public function get_environment() {
		return $this->environment;
	}

	public function available() {
		return (bool) $this->environment->wc_available();
	}

	public function currency() {
		if ( $this->environment->function_exists( 'get_woocommerce_currency' ) ) {
			return strtoupper( (string) get_woocommerce_currency() );
		}
		return Cetech_Pos_Bridge_Constants::SETTLEMENT_CURRENCY;
	}

	public function price_decimals() {
		if ( $this->environment->function_exists( 'wc_get_price_decimals' ) ) {
			return (int) wc_get_price_decimals();
		}
		return Cetech_Pos_Bridge_Constants::PRICE_DECIMALS;
	}

	public function side_effect_counts() {
		return $this->side_effects;
	}

	/**
	 * Snapshot process-global Woo/WP customer/cart/session state.
	 *
	 * @return array<string,mixed>
	 */
	public function snapshot() {
		$wc = $this->wc();
		return array(
			'user_id'  => $this->current_user_id(),
			'customer' => ( $wc && isset( $wc->customer ) ) ? $wc->customer : null,
			'cart'     => ( $wc && isset( $wc->cart ) ) ? $wc->cart : null,
			'session'  => ( $wc && isset( $wc->session ) ) ? $wc->session : null,
		);
	}

	/**
	 * Isolated quotes snapshot the service user, then discard the pre-quote
	 * storefront cart/session objects on restore. Re-attaching those objects
	 * after calculate_totals can abort PHP-FPM while REST is flushing JSON.
	 *
	 * @param array<string,mixed> $snapshot
	 */
	public function restore( array $snapshot ) {
		$this->release_counter_sale_shipping();
		$this->release_b2bking_cart_discount();
		if ( $this->environment->function_exists( 'wp_set_current_user' ) && array_key_exists( 'user_id', $snapshot ) ) {
			wp_set_current_user( (int) $snapshot['user_id'] );
		}
		$wc = $this->wc();
		if ( ! $wc ) {
			return;
		}
		$wc->session = $this->new_session();
		$wc->cart    = $this->new_cart();
		if ( is_object( $wc->cart ) && method_exists( $wc->cart, 'empty_cart' ) ) {
			$wc->cart->empty_cart( false );
		}
		if ( array_key_exists( 'customer', $snapshot ) && $snapshot['customer'] !== null ) {
			$wc->customer = $snapshot['customer'];
		} else {
			$wc->customer = $this->new_customer( $this->current_user_id() );
		}
	}

	/**
	 * POS quotes are counter sales. Frozen v1 Quote has no shipping field and
	 * requires cart total to equal summed line totals. Storefront shipping
	 * must not enter the isolated cart. Woo REST-request mode is also masked
	 * so frontend pricing hooks still run inside POST /quotes.
	 */
	public function isolate_counter_sale_shipping() {
		if ( $this->counter_sale_isolation_depth === 0 && $this->environment->function_exists( 'add_filter' ) ) {
			add_filter( 'woocommerce_cart_needs_shipping', array( $this, 'counter_sale_needs_no_shipping' ), 9999 );
			add_filter( 'woocommerce_cart_needs_shipping_address', array( $this, 'counter_sale_needs_no_shipping' ), 9999 );
			add_filter( 'woocommerce_is_rest_api_request', array( $this, 'counter_sale_needs_no_shipping' ), 9999 );
			add_filter( 'woocommerce_set_cookie_enabled', array( $this, 'counter_sale_needs_no_shipping' ), 9999 );
			add_filter( 'woocommerce_persistent_cart_enabled', array( $this, 'counter_sale_needs_no_shipping' ), 9999 );
		}
		++$this->counter_sale_isolation_depth;
	}

	public function counter_sale_needs_no_shipping( $needs = false ) {
		unset( $needs );
		return false;
	}

	protected function release_counter_sale_shipping() {
		if ( $this->counter_sale_isolation_depth <= 0 ) {
			return;
		}
		--$this->counter_sale_isolation_depth;
		if ( $this->counter_sale_isolation_depth === 0 && $this->environment->function_exists( 'remove_filter' ) ) {
			remove_filter( 'woocommerce_cart_needs_shipping', array( $this, 'counter_sale_needs_no_shipping' ), 9999 );
			remove_filter( 'woocommerce_cart_needs_shipping_address', array( $this, 'counter_sale_needs_no_shipping' ), 9999 );
			remove_filter( 'woocommerce_is_rest_api_request', array( $this, 'counter_sale_needs_no_shipping' ), 9999 );
			remove_filter( 'woocommerce_set_cookie_enabled', array( $this, 'counter_sale_needs_no_shipping' ), 9999 );
			remove_filter( 'woocommerce_persistent_cart_enabled', array( $this, 'counter_sale_needs_no_shipping' ), 9999 );
		}
	}

	/**
	 * B2BKing registers cart-total fee discounts at request init for the
	 * authenticated staff user. Isolated quotes switch to the buyer afterward.
	 * Re-attach B2BKing's own callback so Woo calculate_totals still runs it.
	 * This does not copy B2BKing formulas.
	 */
	protected function enable_quote_customer_dynamic_pricing() {
		if ( $this->added_b2bking_cart_discount ) {
			return;
		}
		if ( ! $this->environment->class_exists( 'B2bking_Dynamic_Rules' ) ) {
			return;
		}
		if ( ! method_exists( 'B2bking_Dynamic_Rules', 'b2bking_dynamic_rule_cart_discount' ) ) {
			return;
		}
		if ( ! $this->environment->function_exists( 'add_action' ) ) {
			return;
		}
		$callback = array( 'B2bking_Dynamic_Rules', 'b2bking_dynamic_rule_cart_discount' );
		if ( $this->environment->function_exists( 'has_action' ) && has_action( 'woocommerce_cart_calculate_fees', $callback ) ) {
			return;
		}
		add_action( 'woocommerce_cart_calculate_fees', $callback );
		$this->added_b2bking_cart_discount = true;
	}

	protected function release_b2bking_cart_discount() {
		if ( ! $this->added_b2bking_cart_discount ) {
			return;
		}
		if ( $this->environment->function_exists( 'remove_action' ) ) {
			remove_action( 'woocommerce_cart_calculate_fees', array( 'B2bking_Dynamic_Rules', 'b2bking_dynamic_rule_cart_discount' ) );
		}
		$this->added_b2bking_cart_discount = false;
	}

	/**
	 * Install an isolated customer. Does not grant staff capabilities.
	 *
	 * @param array<string,mixed> $customer
	 * @return true|WP_Error
	 */
	public function install_customer_context( array $customer ) {
		$wc = $this->wc();
		if ( ! $wc ) {
			return $this->unavailable( 'WooCommerce runtime is not available.' );
		}
		if ( $customer['kind'] === 'walkin' ) {
			$wc->session  = $this->new_session();
			$this->set_user( 0 );
			$wc->customer = $this->new_customer( 0 );
			return true;
		}
		$user_id = $this->resolve_customer_user_id( $customer['customerId'] );
		if ( $user_id === null ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'NOT_FOUND',
				'Customer context was not found.',
				false,
				'none',
				404,
				array( 'field' => 'customer' )
			);
		}
		$actual_kind = $this->detect_customer_kind( $user_id );
		if ( $actual_kind !== $customer['kind'] ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'FORBIDDEN',
				'Requested customer kind does not match the authorized commercial context.',
				false,
				'none',
				403,
				array( 'field' => 'customer' )
			);
		}
		$wc->session  = $this->new_session();
		if ( method_exists( $wc->session, 'set_customer_id' ) ) {
			$wc->session->set_customer_id( $user_id );
		}
		$this->set_user( $user_id );
		$this->clear_session_cart_bag();
		$wc->customer = $this->new_customer( $user_id );
		$this->enable_quote_customer_dynamic_pricing();
		return true;
	}

	public function reset_cart() {
		$wc = $this->wc();
		if ( ! $wc ) {
			return $this->unavailable( 'WooCommerce runtime is not available.' );
		}
		$this->clear_session_cart_bag();
		$wc->cart = $this->new_cart();
		if ( is_object( $wc->cart ) && method_exists( $wc->cart, 'empty_cart' ) ) {
			$wc->cart->empty_cart( false );
		}
		return true;
	}

	protected function clear_session_cart_bag() {
		$wc = $this->wc();
		if ( ! $wc || ! isset( $wc->session ) || ! is_object( $wc->session ) || ! method_exists( $wc->session, 'set' ) ) {
			return;
		}
		$wc->session->set( 'cart', array() );
		$wc->session->set( 'cart_totals', null );
		$wc->session->set( 'applied_coupons', array() );
		$wc->session->set( 'coupon_discount_totals', array() );
		$wc->session->set( 'coupon_discount_tax_totals', array() );
		$wc->session->set( 'removed_cart_contents', array() );
	}

	/**
	 * @param array<string,mixed> $line
	 * @return true|WP_Error
	 */
	public function add_line( array $line ) {
		$wc = $this->wc();
		if ( ! $wc || ! isset( $wc->cart ) || ! is_object( $wc->cart ) || ! method_exists( $wc->cart, 'add_to_cart' ) ) {
			return $this->unavailable( 'WooCommerce cart is not available.' );
		}
		$product_id   = $this->as_positive_int( $line['productId'] );
		$variation_id = isset( $line['variationId'] ) ? $this->as_positive_int( $line['variationId'] ) : 0;
		if ( $product_id === null ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'VALIDATION_ERROR',
				'productId is not a Woo product identifier the bridge can resolve.',
				false,
				'none',
				400,
				array( 'field' => 'lines' )
			);
		}
		$qty = $line['quantity'];
		$added = $wc->cart->add_to_cart( $product_id, $qty, $variation_id ? $variation_id : 0 );
		if ( ! $added ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'VALIDATION_ERROR',
				'WooCommerce rejected a quote line.',
				false,
				'none',
				400,
				array( 'field' => 'lines' )
			);
		}
		return true;
	}

	/**
	 * Execute the full cart quote through Woo runtime hooks.
	 *
	 * @return true|WP_Error
	 */
	public function calculate_totals() {
		$wc = $this->wc();
		if ( ! $wc || ! isset( $wc->cart ) || ! is_object( $wc->cart ) || ! method_exists( $wc->cart, 'calculate_totals' ) ) {
			return $this->unavailable( 'WooCommerce cart totals cannot be calculated.' );
		}
		$before_orders = $this->count_orders();
		$wc->cart->calculate_totals();
		$after_orders = $this->count_orders();
		if ( $after_orders !== null && $before_orders !== null && $after_orders !== $before_orders ) {
			++$this->side_effects['orders'];
			return $this->unavailable( 'Quote mutated Woo orders; quoting aborted.' );
		}
		return true;
	}

	/**
	 * Read priced lines/totals from the Woo cart after calculate_totals.
	 *
	 * @return array<string,mixed>|WP_Error
	 */
	public function get_priced_cart() {
		$wc = $this->wc();
		if ( ! $wc || ! isset( $wc->cart ) || ! is_object( $wc->cart ) ) {
			return $this->unavailable( 'WooCommerce cart is not available.' );
		}
		$currency = $this->currency();
		if ( $currency !== Cetech_Pos_Bridge_Constants::SETTLEMENT_CURRENCY || $this->price_decimals() !== Cetech_Pos_Bridge_Constants::PRICE_DECIMALS ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'VALIDATION_ERROR',
				'Store currency or precision is incompatible with v1 GHS/2-decimal settlement.',
				false,
				'none',
				400,
				array( 'field' => 'currency' )
			);
		}
		$cart     = $wc->cart;
		$shipping = $this->cart_amount( $cart, 'get_shipping_total', 'shipping_total' );
		if ( $this->amount_is_nonzero( $shipping ) ) {
			return $this->unavailable( 'Isolated POS quote still contains storefront shipping; v1 Quote has no shipping field.' );
		}
		$fee_minor = $this->signed_minor( $this->cart_amount( $cart, 'get_fee_total', 'fee_total' ) );
		if ( $fee_minor === null ) {
			return $this->unavailable( 'Isolated POS quote returned an unreadable Woo fee total.' );
		}
		if ( $fee_minor > 0 ) {
			return $this->unavailable( 'Isolated POS quote still contains a positive Woo fee; v1 Quote has no fee field.' );
		}
		$cart_level = $this->inspect_cart_level_discount( $cart, $fee_minor );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $cart_level ) ) {
			return $cart_level;
		}
		$contents                = method_exists( $cart, 'get_cart' ) ? $cart->get_cart() : array();
		$lines                   = array();
		$this->last_provider_tax = array();
		foreach ( $contents as $item ) {
			$mapped = $this->map_cart_item( $item, $currency );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $mapped ) ) {
				return $mapped;
			}
			$lines[] = $mapped;
		}
		$priced = array(
			'currency'                 => $currency,
			'lines'                    => $lines,
			'subtotal'                 => $this->cart_amount( $cart, 'get_subtotal', 'subtotal' ),
			'discount'                 => $this->cart_amount( $cart, 'get_discount_total', 'discount_total' ),
			'tax'                      => $this->cart_amount( $cart, 'get_total_tax', 'total_tax' ),
			'total'                    => $this->cart_total_amount( $cart ),
			'cartLevelDiscountMinor'   => $cart_level,
		);
		$identity = $this->assert_cart_money_identity( $priced, $fee_minor );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $identity ) ) {
			return $identity;
		}
		return $priced;
	}

	protected function map_cart_item( $item, $currency ) {
		$product      = is_array( $item ) && isset( $item['data'] ) ? $item['data'] : null;
		$product_id   = is_array( $item ) && isset( $item['product_id'] ) ? (string) $item['product_id'] : '';
		$variation_id = is_array( $item ) && ! empty( $item['variation_id'] ) ? (string) $item['variation_id'] : null;
		$qty          = is_array( $item ) && isset( $item['quantity'] ) ? $this->canonical_quantity( $item['quantity'] ) : '1';
		$subtotal     = isset( $item['line_subtotal'] ) ? (string) $item['line_subtotal'] : '0';
		$line_total   = isset( $item['line_total'] ) ? (string) $item['line_total'] : $subtotal;
		$tax          = isset( $item['line_tax'] ) ? (string) $item['line_tax'] : '0';
		$discount     = $this->decimal_subtract( $subtotal, $line_total );
		$stock        = $this->stock_status( $product );
		$purchasable  = is_object( $product ) && method_exists( $product, 'is_purchasable' ) ? (bool) $product->is_purchasable() : true;
		if ( $stock === 'out_of_stock' ) {
			$purchasable = false;
		}
		$unit = $this->authoritative_unit_price_string( $product );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $unit ) ) {
			return $unit;
		}
		$mapped = array(
			'productId'    => $product_id,
			'quantity'     => $qty,
			'unitPrice'    => $unit,
			'subtotal'     => $subtotal,
			'discount'     => $discount,
			'tax'          => $tax,
			'stockStatus'  => $stock,
			'purchasable'  => $purchasable,
			'pricingLabel' => $this->pricing_label( $product ),
			'problems'     => array(),
		);
		if ( $variation_id ) {
			$mapped['variationId'] = $variation_id;
		}
		if ( is_array( $item ) && isset( $item['line_tax_data'] ) && is_array( $item['line_tax_data'] ) ) {
			$this->last_provider_tax[ $this->line_tax_key( $mapped ) ] = $item['line_tax_data'];
		}
		if ( ! $purchasable ) {
			$mapped['problems'][] = array(
				'code'    => $stock === 'out_of_stock' ? 'OUT_OF_STOCK' : 'PRODUCT_NOT_PURCHASABLE',
				'message' => 'Line is not purchasable in the isolated Woo cart.',
			);
		}
		unset( $currency );
		return $mapped;
	}

	protected function stock_status( $product ) {
		if ( ! is_object( $product ) || ! method_exists( $product, 'get_stock_status' ) ) {
			return 'unknown';
		}
		$status = (string) $product->get_stock_status();
		if ( $status === 'outofstock' ) {
			return 'out_of_stock';
		}
		if ( $status === 'onbackorder' ) {
			return 'backorder';
		}
		if ( method_exists( $product, 'managing_stock' ) && $product->managing_stock() && method_exists( $product, 'is_in_stock' ) ) {
			$qty = method_exists( $product, 'get_stock_quantity' ) ? $product->get_stock_quantity() : null;
			$low = $this->environment->function_exists( 'wc_get_low_stock_amount' ) ? wc_get_low_stock_amount( $product ) : 2;
			if ( $qty !== null && is_numeric( $qty ) && (int) $qty > 0 && (int) $qty <= (int) $low ) {
				return 'low_stock';
			}
		}
		return $status === 'instock' ? 'in_stock' : 'unknown';
	}

	protected function pricing_label( $product ) {
		if ( is_object( $product ) && method_exists( $product, 'get_price_suffix' ) ) {
			$suffix = (string) $product->get_price_suffix();
			if ( function_exists( 'wp_strip_all_tags' ) ) {
				$suffix = wp_strip_all_tags( $suffix );
			}
			$suffix = trim( $suffix );
			if ( $suffix !== '' && function_exists( 'wp_check_invalid_utf8' ) ) {
				$suffix = wp_check_invalid_utf8( $suffix, true );
			}
			if ( $suffix !== '' ) {
				return $suffix;
			}
		}
		return null;
	}

	protected function cart_amount( $cart, $method, $property ) {
		if ( method_exists( $cart, $method ) ) {
			return (string) $cart->{$method}();
		}
		if ( isset( $cart->$property ) ) {
			return (string) $cart->$property;
		}
		return '0';
	}

	protected function cart_total_amount( $cart ) {
		if ( method_exists( $cart, 'get_total' ) ) {
			$total = $cart->get_total( 'edit' );
			if ( is_string( $total ) || is_numeric( $total ) ) {
				return (string) $total;
			}
		}
		return $this->cart_amount( $cart, 'get_cart_contents_total', 'total' );
	}

	protected function canonical_quantity( $raw ) {
		$s = trim( (string) $raw );
		if ( preg_match( Cetech_Pos_Bridge_Constants::QUANTITY_PATTERN, $s ) ) {
			return $s;
		}
		if ( preg_match( '/^[0-9]+$/', $s ) && $s !== '0' ) {
			return ltrim( $s, '0' ) === '' ? $s : ltrim( $s, '0' );
		}
		return '1';
	}

	/**
	 * Display-rounded per-unit price from the priced cart item's Woo product after hooks.
	 * Never divides line subtotal by quantity. Never copies plugin formulas.
	 *
	 * @param mixed $product
	 * @return string|WP_Error Woo decimal string accepted by the Money adapter.
	 */
	protected function authoritative_unit_price_string( $product ) {
		if ( ! is_object( $product ) || ! method_exists( $product, 'get_price' ) ) {
			return $this->missing_unit_price_error();
		}
		$raw = $product->get_price();
		if ( $this->environment->function_exists( 'wc_format_decimal' ) && ( is_string( $raw ) || is_int( $raw ) || is_float( $raw ) || ( is_numeric( $raw ) && ! is_bool( $raw ) ) ) ) {
			$formatted = wc_format_decimal( $raw, Cetech_Pos_Bridge_Constants::PRICE_DECIMALS );
			if ( is_string( $formatted ) || is_int( $formatted ) || is_float( $formatted ) || is_numeric( $formatted ) ) {
				$raw = (string) $formatted;
			}
		} elseif ( is_int( $raw ) ) {
			$raw = (string) $raw;
		}
		if ( ! is_string( $raw ) ) {
			return $this->missing_unit_price_error();
		}
		$raw = trim( $raw );
		if ( Cetech_Pos_Bridge_Money::from_decimal_string( $raw, Cetech_Pos_Bridge_Constants::SETTLEMENT_CURRENCY ) === null ) {
			return $this->missing_unit_price_error();
		}
		return $raw;
	}

	protected function missing_unit_price_error() {
		return Cetech_Pos_Bridge_Response::wp_error(
			'INTEGRATION_UNAVAILABLE',
			'Woo cart item did not provide an authoritative per-unit price after pricing hooks.',
			true,
			'resolve',
			503,
			array( 'field' => 'lines' )
		);
	}

	protected function decimal_subtract( $left, $right ) {
		$l = Cetech_Pos_Bridge_Money::from_decimal_string( $left, Cetech_Pos_Bridge_Constants::SETTLEMENT_CURRENCY );
		$r = Cetech_Pos_Bridge_Money::from_decimal_string( $right, Cetech_Pos_Bridge_Constants::SETTLEMENT_CURRENCY );
		if ( $l === null || $r === null ) {
			return '0';
		}
		$d = $l - $r;
		if ( $d < 0 ) {
			$d = 0;
		}
		return sprintf( '%d.%02d', intdiv( $d, 100 ), $d % 100 );
	}

	protected function resolve_customer_user_id( $customer_id ) {
		if ( preg_match( '/^[1-9][0-9]*$/', (string) $customer_id ) ) {
			$id = (int) $customer_id;
			if ( $this->environment->function_exists( 'get_userdata' ) ) {
				$user = get_userdata( $id );
				return ( $user ) ? $id : null;
			}
			return $id;
		}
		if ( $this->environment->function_exists( 'get_user_by' ) ) {
			$user = get_user_by( 'login', (string) $customer_id );
			return ( $user && isset( $user->ID ) ) ? (int) $user->ID : null;
		}
		return null;
	}

	protected function detect_customer_kind( $user_id ) {
		$flag = $this->b2bking_stored_user_flag( $user_id );
		if ( $flag === 'yes' ) {
			return 'b2b';
		}
		if ( $this->environment->function_exists( 'b2bking_is_b2b_user' ) && b2bking_is_b2b_user( $user_id ) ) {
			return 'b2b';
		}
		if ( $this->environment->function_exists( 'b2bking_is_b2c_user' ) && b2bking_is_b2c_user( $user_id ) ) {
			return 'retail';
		}
		return 'retail';
	}

	/**
	 * B2BKing stores commercial class in usermeta. Do not infer kind from group IDs alone.
	 *
	 * @param int $user_id
	 * @return string
	 */
	protected function b2bking_stored_user_flag( $user_id ) {
		if ( ! $this->environment->function_exists( 'get_user_meta' ) ) {
			return '';
		}
		$flag = get_user_meta( (int) $user_id, 'b2bking_b2buser', true );
		return is_string( $flag ) ? $flag : '';
	}

	protected function current_user_id() {
		if ( $this->environment->function_exists( 'get_current_user_id' ) ) {
			return (int) get_current_user_id();
		}
		return 0;
	}

	protected function set_user( $user_id ) {
		if ( $this->environment->function_exists( 'wp_set_current_user' ) ) {
			wp_set_current_user( (int) $user_id );
		}
	}

	protected function wc() {
		if ( ! $this->environment->function_exists( 'WC' ) ) {
			return null;
		}
		$wc = WC();
		return is_object( $wc ) ? $wc : null;
	}

	protected function new_customer( $user_id ) {
		if ( $this->environment->class_exists( 'WC_Customer' ) ) {
			return new WC_Customer( (int) $user_id, true );
		}
		return null;
	}

	protected function new_cart() {
		if ( $this->environment->class_exists( 'WC_Cart' ) ) {
			return new WC_Cart();
		}
		return null;
	}

	protected function new_session() {
		if ( $this->environment->class_exists( 'WC_Session' ) ) {
			return new class() extends WC_Session {
				/** @var array<string,mixed> */
				private $bag = array();
				/** @var int */
				private $quote_customer_id = 0;

				public function get( $key, $default = null ) {
					$key = (string) $key;
					return array_key_exists( $key, $this->bag ) ? $this->bag[ $key ] : $default;
				}

				public function set( $key, $value ) {
					$this->bag[ (string) $key ] = $value;
				}

				public function get_customer_id() {
					return $this->quote_customer_id;
				}

				public function set_customer_id( $id ) {
					$this->quote_customer_id = (int) $id;
					if ( property_exists( $this, '_customer_id' ) ) {
						$this->_customer_id = (string) $this->quote_customer_id;
					}
				}

				public function has_session() {
					return true;
				}

				public function save_data() {}

				public function set_customer_session_cookie( $set = true ) {
					unset( $set );
				}

				public function __call( $name, $arguments ) {
					unset( $name, $arguments );
					return null;
				}
			};
		}
		return new Cetech_Pos_Bridge_Ephemeral_Session();
	}

	protected function count_orders() {
		global $wpdb;
		if ( isset( $wpdb ) && is_object( $wpdb ) && isset( $wpdb->prefix ) && method_exists( $wpdb, 'get_var' ) ) {
			$counted = $wpdb->get_var( 'SELECT COUNT(*) FROM ' . $wpdb->prefix . 'wc_orders' );
			if ( $counted !== null ) {
				return (int) $counted;
			}
		}
		return null;
	}

	/**
	 * ADR-013: a negative Woo fee total is a cart-level commercial discount only
	 * when every fee is non-positive, untaxed, and the fee sum matches get_fee_total().
	 *
	 * @param object $cart
	 * @param int    $fee_minor
	 * @return int|WP_Error
	 */
	protected function inspect_cart_level_discount( $cart, $fee_minor ) {
		$fee_minor = (int) $fee_minor;
		if ( $fee_minor === 0 ) {
			return 0;
		}
		if ( $fee_minor > 0 ) {
			return $this->unavailable( 'Isolated POS quote still contains a positive Woo fee; v1 Quote has no fee field.' );
		}
		if ( ! is_object( $cart ) || ! method_exists( $cart, 'get_fees' ) ) {
			return $this->unavailable( 'Woo cart fees cannot be inspected; a negative fee is not a proven commercial discount.' );
		}
		$fees = $cart->get_fees();
		if ( ! is_array( $fees ) || $fees === array() ) {
			return $this->unavailable( 'Woo reported a negative fee total without inspectable fee rows.' );
		}
		$sum = 0;
		foreach ( $fees as $fee ) {
			$amount = $this->fee_amount_minor( $fee );
			if ( $amount === null ) {
				return $this->unavailable( 'A Woo fee amount could not be converted to minor units.' );
			}
			if ( $amount > 0 ) {
				return $this->unavailable( 'Isolated POS quote contains a positive Woo fee row; v1 Quote has no fee field.' );
			}
			$tax = $this->fee_tax_minor( $fee );
			if ( $tax === null ) {
				return $this->unavailable( 'A Woo fee tax amount could not be converted to minor units.' );
			}
			if ( $tax !== 0 ) {
				return $this->unavailable( 'A Woo fee carries tax; v1 Quote cannot treat it as a commercial discount.' );
			}
			$sum += $amount;
		}
		if ( $sum !== $fee_minor ) {
			return $this->unavailable( 'Inspected Woo fee rows do not sum to get_fee_total().' );
		}
		return -$fee_minor;
	}

	/**
	 * @param object $fee
	 * @return int|null
	 */
	protected function fee_amount_minor( $fee ) {
		if ( ! is_object( $fee ) || ! isset( $fee->amount ) ) {
			return null;
		}
		return $this->numeric_to_signed_minor( $fee->amount );
	}

	/**
	 * @param object $fee
	 * @return int|null
	 */
	protected function fee_tax_minor( $fee ) {
		if ( ! is_object( $fee ) ) {
			return null;
		}
		if ( isset( $fee->tax ) ) {
			return $this->numeric_to_signed_minor( $fee->tax );
		}
		return 0;
	}

	protected function numeric_to_signed_minor( $raw ) {
		if ( $this->environment->function_exists( 'wc_format_decimal' ) && ( is_string( $raw ) || is_int( $raw ) || is_float( $raw ) || ( is_numeric( $raw ) && ! is_bool( $raw ) ) ) ) {
			$formatted = wc_format_decimal( $raw, Cetech_Pos_Bridge_Constants::PRICE_DECIMALS );
			if ( is_string( $formatted ) || is_int( $formatted ) || is_float( $formatted ) || is_numeric( $formatted ) ) {
				$raw = (string) $formatted;
			}
		}
		return $this->signed_minor( (string) $raw );
	}

	/**
	 * Prove the negative fee is the only extra cart component besides coupons/tax.
	 *
	 * @param array<string,mixed> $priced
	 * @param int                 $fee_minor
	 * @return true|WP_Error
	 */
	protected function assert_cart_money_identity( array $priced, $fee_minor ) {
		$currency = (string) $priced['currency'];
		$sub      = Cetech_Pos_Bridge_Money::from_decimal_string( $priced['subtotal'], $currency );
		$coupon   = Cetech_Pos_Bridge_Money::from_decimal_string( $priced['discount'], $currency );
		$tax      = Cetech_Pos_Bridge_Money::from_decimal_string( $priced['tax'], $currency );
		$total    = Cetech_Pos_Bridge_Money::from_decimal_string( $priced['total'], $currency );
		if ( $sub === null || $coupon === null || $tax === null || $total === null ) {
			return $this->unavailable( 'Woo cart totals could not be converted while proving fee-discount identity.' );
		}
		$expected = $sub - $coupon + $tax + (int) $fee_minor;
		if ( $expected !== $total ) {
			return $this->unavailable( 'Woo cart total is not subtotal - coupon + tax + fee; the fee is not a v1 commercial discount.' );
		}
		return true;
	}

	protected function signed_minor( $decimal ) {
		$s = trim( (string) $decimal );
		if ( $s === '' || $s === '0' || $s === '0.0' || $s === '0.00' ) {
			return 0;
		}
		$neg      = strpos( $s, '-' ) === 0;
		$unsigned = $neg ? substr( $s, 1 ) : $s;
		$minor    = Cetech_Pos_Bridge_Money::from_decimal_string( $unsigned, $this->currency() );
		if ( $minor === null ) {
			return null;
		}
		return $neg ? -$minor : $minor;
	}

	protected function amount_is_nonzero( $decimal ) {
		$minor = Cetech_Pos_Bridge_Money::from_decimal_string( (string) $decimal, $this->currency() );
		if ( $minor === null ) {
			return (string) $decimal !== '' && (string) $decimal !== '0';
		}
		return $minor !== 0;
	}

	protected function as_positive_int( $value ) {
		if ( is_int( $value ) && $value > 0 ) {
			return $value;
		}
		if ( is_string( $value ) && preg_match( '/^[1-9][0-9]*$/', $value ) ) {
			return (int) $value;
		}
		return null;
	}

	protected function unavailable( $message ) {
		return Cetech_Pos_Bridge_Response::wp_error(
			'INTEGRATION_UNAVAILABLE',
			$message,
			true,
			'resolve',
			503
		);
	}

	/**
	 * Hold-stock lifetime from Woo configuration. Zero is not a bounded
	 * reserved commitment and is refused rather than replaced with a guessed TTL.
	 *
	 * @return int seconds
	 */
	public function hold_stock_seconds() {
		$minutes = 0;
		if ( $this->environment->function_exists( 'get_option' ) ) {
			$minutes = (int) get_option( 'woocommerce_hold_stock_minutes', 0 );
		}
		if ( $minutes <= 0 ) {
			return 0;
		}
		return $minutes * 60;
	}

	/**
	 * Create exactly one unpaid pending Woo order through HPOS-safe CRUD.
	 * Recovery identity is bound into the INITIAL order save, not a later claim update.
	 *
	 * @param array<string,mixed> $quote
	 * @param string              $transaction_id
	 * @param string              $request_hash
	 * @param string              $recovery_token
	 * @return array<string,mixed>|WP_Error
	 */
	public function create_prepared_order( array $quote, $transaction_id, $request_hash, $recovery_token = '' ) {
		$hold = $this->hold_stock_seconds();
		if ( $hold <= 0 ) {
			return $this->unavailable( 'Woo hold-stock minutes is not configured; prepare cannot claim a bounded reserved commitment.' );
		}
		if ( ! is_string( $recovery_token ) || ! preg_match( '/^[0-9a-f]{64}$/', $recovery_token ) ) {
			return $this->unavailable( 'A high-entropy Woo recovery token is required before order create.' );
		}
		if ( ! $this->environment->function_exists( 'wc_create_order' ) ) {
			return $this->unavailable( 'wc_create_order is not available; HPOS-safe order create cannot run.' );
		}
		$before       = $this->count_orders();
		$disable_mail = function () {
			return false;
		};
		if ( $this->environment->function_exists( 'add_filter' ) ) {
			add_filter( 'woocommerce_email_enabled_new_order', $disable_mail, 99 );
			add_filter( 'woocommerce_email_enabled_customer_on_hold_order', $disable_mail, 99 );
		}
		try {
			$order = $this->persist_initial_order_with_recovery_token( $quote, $recovery_token );
			++$this->create_calls;
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $order ) ) {
				return $order;
			}
			$applied = $this->apply_quote_snapshot_to_order( $order, $quote );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $applied ) ) {
				return $applied;
			}
			$this->fire_seam( $this->after_wc_create );
			$sale_id = 'sale-' . ( method_exists( $order, 'get_id' ) ? (string) $order->get_id() : bin2hex( random_bytes( 8 ) ) );
			$meta    = $this->save_ordinary_recovery_meta( $order, $transaction_id, $request_hash, $sale_id, $quote );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $meta ) ) {
				return $meta;
			}
			$this->fire_seam( $this->after_meta_save );
			if ( ! $this->environment->function_exists( 'wc_reserve_stock_for_order' ) ) {
				return $this->unavailable( 'wc_reserve_stock_for_order is not available; prepare will not invent stock arithmetic.' );
			}
			$reserved = $this->call_reserve_stock_for_order( $order, false );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $reserved ) ) {
				$this->trash_incomplete_order( $order );
				return $reserved;
			}
			if ( ! $this->order_has_proven_reservation( $order ) ) {
				return $this->unavailable( 'Woo did not expose a complete current stock reservation after wc_reserve_stock_for_order.' );
			}
			$matched = $this->assert_order_matches_quote( $order, $quote );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $matched ) ) {
				return $matched;
			}
			$described = $this->describe_order( $order, $hold );
			if ( $described === null || empty( $described['reservationProven'] ) ) {
				return $this->unavailable( 'Prepared order reservation could not be described as proven.' );
			}
			$this->side_effects['orders']++;
			$this->side_effects['stock']++;
			$after = $this->count_orders();
			if ( $before !== null && $after !== null && ( $after - $before ) !== 1 ) {
				return $this->unavailable( 'Woo order count did not increase by exactly one during prepare.' );
			}
			return $described;
		} finally {
			if ( $this->environment->function_exists( 'remove_filter' ) ) {
				remove_filter( 'woocommerce_email_enabled_new_order', $disable_mail, 99 );
				remove_filter( 'woocommerce_email_enabled_customer_on_hold_order', $disable_mail, 99 );
			}
		}
	}

	/**
	 * Bind the recovery token into the INITIAL wc_create_order save via Woo CRUD
	 * properties (order_key + meta) set on woocommerce_before_order_object_save.
	 *
	 * @param array<string,mixed> $quote
	 * @param string              $recovery_token
	 * @return object|WP_Error
	 */
	protected function persist_initial_order_with_recovery_token( array $quote, $recovery_token ) {
		$customer_id = $this->quote_customer_user_id( $quote );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $customer_id ) ) {
			return $customer_id;
		}
		$binder = function ( $order ) use ( $recovery_token, $quote, $customer_id ) {
			if ( ! is_object( $order ) ) {
				return;
			}
			if ( method_exists( $order, 'set_order_key' ) ) {
				$order->set_order_key( $recovery_token );
			}
			if ( method_exists( $order, 'set_created_via' ) ) {
				$order->set_created_via( 'cetech-pos' );
			}
			if ( method_exists( $order, 'set_customer_id' ) ) {
				$order->set_customer_id( $customer_id );
			}
			if ( method_exists( $order, 'set_currency' ) && isset( $quote['currency'] ) ) {
				$order->set_currency( $quote['currency'] );
			}
			if ( method_exists( $order, 'update_meta_data' ) ) {
				$order->update_meta_data( Cetech_Pos_Bridge_Constants::ORDER_META_RECOVERY, $recovery_token );
			}
		};
		if ( $this->environment->function_exists( 'add_action' ) ) {
			add_action( 'woocommerce_before_order_object_save', $binder, 0, 1 );
		}
		try {
			$order = wc_create_order(
				array(
					'status'      => 'pending',
					'created_via' => 'cetech-pos',
					'customer_id' => $customer_id,
				)
			);
		} finally {
			if ( $this->environment->function_exists( 'remove_action' ) ) {
				remove_action( 'woocommerce_before_order_object_save', $binder, 0 );
			}
		}
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $order ) || ! is_object( $order ) ) {
			return $this->unavailable( 'Woo did not create a pending order.' );
		}
		if ( ! $this->order_carries_recovery_token( $order, $recovery_token ) ) {
			return $this->unavailable( 'Woo did not persist the recovery identity during the initial order save.' );
		}
		return $order;
	}

	/**
	 * Map accepted Quote line/order economics onto the Woo order. Does not
	 * reimplement WoodMart/B2BKing formulas or invent tax-rate splits.
	 *
	 * @param object              $order
	 * @param array<string,mixed> $quote
	 * @return true|WP_Error
	 */
	public function apply_quote_snapshot_to_order( $order, array $quote ) {
		if ( ! is_object( $order ) || ! method_exists( $order, 'add_product' ) || ! method_exists( $order, 'save' ) ) {
			return $this->unavailable( 'Woo order object does not expose HPOS-safe CRUD methods.' );
		}
		$existing = method_exists( $order, 'get_items' ) ? $order->get_items() : array();
		$existing = is_array( $existing ) ? $existing : array();
		if ( count( $existing ) === 0 ) {
			foreach ( $quote['lines'] as $line ) {
				$product = $this->resolve_product( $line );
				if ( Cetech_Pos_Bridge_Quote_Request::is_error( $product ) ) {
					return $product;
				}
				$mapped = $this->quote_line_economics( $line );
				if ( $mapped === null ) {
					return $this->unavailable( 'Authoritative Quote line economics could not be read as minor units.' );
				}
				$qty   = isset( $line['quantity'] ) ? $line['quantity'] : '1';
				$added = $order->add_product(
					$product,
					$qty,
					array(
						'subtotal' => $mapped['subtotalDec'],
						'total'    => $mapped['exclTaxDec'],
					)
				);
				if ( $added === false || Cetech_Pos_Bridge_Quote_Request::is_error( $added ) ) {
					return Cetech_Pos_Bridge_Response::wp_error(
						'STOCK_CHANGED',
						'Woo refused a quote line during prepare.',
						false,
						'review_quote',
						409,
						array( 'field' => 'lines' )
					);
				}
				$item = is_object( $added ) ? $added : ( method_exists( $order, 'get_item' ) ? $order->get_item( $added ) : null );
				if ( is_object( $item ) ) {
					$taxed = $this->apply_line_tax( $item, $line, $mapped );
					if ( Cetech_Pos_Bridge_Quote_Request::is_error( $taxed ) ) {
						return $taxed;
					}
					if ( method_exists( $item, 'save' ) ) {
						$item->save();
					}
				}
			}
		}
		$order_econs = $this->quote_order_economics( $quote );
		if ( $order_econs === null ) {
			return $this->unavailable( 'Authoritative Quote order economics could not be read as minor units.' );
		}
		if ( method_exists( $order, 'set_currency' ) ) {
			$order->set_currency( $order_econs['currency'] );
		}
		if ( method_exists( $order, 'set_discount_total' ) ) {
			$order->set_discount_total( $order_econs['discountDec'] );
		}
		if ( method_exists( $order, 'set_shipping_total' ) ) {
			$order->set_shipping_total( '0.00' );
		}
		if ( method_exists( $order, 'set_shipping_tax' ) ) {
			$order->set_shipping_tax( '0.00' );
		}
		if ( method_exists( $order, 'set_cart_tax' ) ) {
			$order->set_cart_tax( $order_econs['taxDec'] );
		}
		if ( method_exists( $order, 'set_total' ) ) {
			$order->set_total( $order_econs['totalDec'] );
		}
		$order->save();
		return $this->assert_order_matches_quote( $order, $quote );
	}

	/**
	 * @param object              $order
	 * @param string              $transaction_id
	 * @param string              $request_hash
	 * @param string              $sale_id
	 * @param array<string,mixed> $quote
	 * @return true|WP_Error
	 */
	public function save_ordinary_recovery_meta( $order, $transaction_id, $request_hash, $sale_id, array $quote ) {
		if ( ! is_object( $order ) || ! method_exists( $order, 'update_meta_data' ) || ! method_exists( $order, 'save' ) ) {
			return $this->unavailable( 'Woo order object does not expose HPOS-safe CRUD methods.' );
		}
		$order->update_meta_data( Cetech_Pos_Bridge_Constants::ORDER_META_TX, $transaction_id );
		$order->update_meta_data( Cetech_Pos_Bridge_Constants::ORDER_META_HASH, $request_hash );
		$order->update_meta_data( Cetech_Pos_Bridge_Constants::ORDER_META_SALE, $sale_id );
		if ( isset( $quote['id'] ) ) {
			$order->update_meta_data( Cetech_Pos_Bridge_Constants::ORDER_META_QUOTE, (string) $quote['id'] );
		}
		if ( isset( $quote['fingerprint'] ) ) {
			$order->update_meta_data( Cetech_Pos_Bridge_Constants::ORDER_META_QUOTE_FP, (string) $quote['fingerprint'] );
		}
		$order->save();
		return true;
	}

	/**
	 * Query Woo by the recovery token using supported order_key / meta CRUD.
	 *
	 * @param string $recovery_token
	 * @return array<int,array<string,mixed>>|WP_Error
	 */
	public function find_orders_by_recovery_token( $recovery_token ) {
		if ( ! is_string( $recovery_token ) || ! preg_match( '/^[0-9a-f]{64}$/', $recovery_token ) ) {
			return array();
		}
		if ( ! $this->environment->function_exists( 'wc_get_orders' ) && ! $this->environment->function_exists( 'wc_get_order_id_by_order_key' ) ) {
			return $this->unavailable( 'Woo order query APIs are not available for recovery-token lookup.' );
		}
		$ids = array();
		if ( $this->environment->function_exists( 'wc_get_order_id_by_order_key' ) ) {
			$by_key = wc_get_order_id_by_order_key( $recovery_token );
			if ( $by_key ) {
				$ids[ (string) $by_key ] = true;
			}
		}
		if ( $this->environment->function_exists( 'wc_get_orders' ) ) {
			$by_key_orders = wc_get_orders(
				array(
					'limit'     => 5,
					'return'    => 'ids',
					'order_key' => $recovery_token,
				)
			);
			if ( is_array( $by_key_orders ) ) {
				foreach ( $by_key_orders as $id ) {
					$ids[ (string) $id ] = true;
				}
			}
			$by_meta = wc_get_orders(
				array(
					'limit'      => 5,
					'return'     => 'ids',
					'meta_key'   => Cetech_Pos_Bridge_Constants::ORDER_META_RECOVERY,
					'meta_value' => $recovery_token,
				)
			);
			if ( is_array( $by_meta ) ) {
				foreach ( $by_meta as $id ) {
					$ids[ (string) $id ] = true;
				}
			}
		}
		if ( count( $ids ) > 1 ) {
			return $this->attention_recovery( 'Multiple Woo orders carry this recovery token.' );
		}
		if ( count( $ids ) === 0 ) {
			return array();
		}
		if ( ! $this->environment->function_exists( 'wc_get_order' ) ) {
			return $this->unavailable( 'wc_get_order is not available to load the recovered order.' );
		}
		$order_id = (int) array_key_first( $ids );
		$order    = wc_get_order( $order_id );
		if ( ! is_object( $order ) ) {
			return $this->unavailable( 'Woo order found by recovery token could not be loaded.' );
		}
		$hold      = $this->hold_stock_seconds();
		$described = $this->describe_order( $order, $hold );
		if ( $described === null ) {
			return array();
		}
		$described['recoveryToken'] = $recovery_token;
		return array( $described );
	}

	/**
	 * Finish a token-identified order: snapshot economics, ordinary meta, then reservation.
	 *
	 * @param array<string,mixed> $found
	 * @param array<string,mixed> $quote
	 * @param string              $transaction_id
	 * @param string              $request_hash
	 * @param bool                $may_complete_reservation
	 * @return array<string,mixed>|WP_Error|null
	 */
	public function finish_recovered_order( array $found, array $quote, $transaction_id, $request_hash, $may_complete_reservation ) {
		if ( ! $this->environment->function_exists( 'wc_get_order' ) ) {
			return $this->unavailable( 'wc_get_order is not available to finish recovered prepare.' );
		}
		$order = wc_get_order( $found['orderId'] );
		if ( ! is_object( $order ) ) {
			return $this->unavailable( 'Woo order could not be loaded to finish recovered prepare.' );
		}
		$applied = $this->apply_quote_snapshot_to_order( $order, $quote );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $applied ) ) {
			return $applied;
		}
		$sale_id = isset( $found['saleId'] ) && is_string( $found['saleId'] ) && $found['saleId'] !== ''
			? $found['saleId']
			: ( 'sale-' . (string) $found['orderId'] );
		$meta = $this->save_ordinary_recovery_meta( $order, $transaction_id, $request_hash, $sale_id, $quote );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $meta ) ) {
			return $meta;
		}
		$hold      = $this->hold_stock_seconds();
		$described = $this->describe_order( $order, $hold );
		if ( $described === null ) {
			return $this->unavailable( 'Recovered Woo order could not be described.' );
		}
		if ( ! empty( $described['reservationProven'] ) && isset( $described['stockCommitment'] ) ) {
			$matched = $this->assert_order_matches_quote( $order, $quote );
			return Cetech_Pos_Bridge_Quote_Request::is_error( $matched ) ? $matched : $described;
		}
		if ( ! $may_complete_reservation ) {
			return null;
		}
		$completed = $this->complete_stock_reservation( $described );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $completed ) ) {
			return $completed;
		}
		$matched = $this->assert_order_matches_quote( $order, $quote );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $matched ) ) {
			return $matched;
		}
		return $completed;
	}

	/**
	 * @param object              $order
	 * @param array<string,mixed> $quote
	 * @return true|WP_Error
	 */
	public function assert_order_matches_quote( $order, array $quote ) {
		$eco = $this->read_order_economics( $order );
		$q   = $this->quote_order_economics( $quote );
		if ( $eco === null || $q === null ) {
			return $this->unavailable( 'Prepared Woo order economics could not be compared to the authoritative Quote.' );
		}
		if ( $eco['currency'] !== $q['currency']
			|| $eco['subtotal'] !== $q['subtotal']
			|| $eco['discount'] !== $q['discount']
			|| $eco['tax'] !== $q['tax']
			|| $eco['total'] !== $q['total']
		) {
			return $this->unavailable( 'Prepared Woo order economics diverged from the authoritative Quote.' );
		}
		$lines = $this->read_order_line_economics( $order );
		if ( $lines === null || count( $lines ) !== count( $quote['lines'] ) ) {
			return $this->unavailable( 'Prepared Woo order line economics diverged from the authoritative Quote.' );
		}
		foreach ( $quote['lines'] as $index => $line ) {
			$mapped = $this->quote_line_economics( $line );
			if ( $mapped === null || ! isset( $lines[ $index ] ) ) {
				return $this->unavailable( 'Prepared Woo order line economics diverged from the authoritative Quote.' );
			}
			$saved = $lines[ $index ];
			if ( $saved['subtotal'] !== $mapped['subtotal']
				|| $saved['discount'] !== $mapped['discount']
				|| $saved['tax'] !== $mapped['tax']
				|| $saved['total'] !== $mapped['total']
				|| $saved['quantity'] !== (string) $line['quantity']
			) {
				return $this->unavailable( 'Prepared Woo order line economics diverged from the authoritative Quote.' );
			}
		}
		return true;
	}

	/**
	 * @param string              $order_id
	 * @param array<string,mixed> $quote
	 * @return true|WP_Error
	 */
	public function assert_saved_order_matches_quote( $order_id, array $quote ) {
		if ( ! $this->environment->function_exists( 'wc_get_order' ) ) {
			return $this->unavailable( 'wc_get_order is not available to prove prepared order economics.' );
		}
		$order = wc_get_order( $order_id );
		if ( ! is_object( $order ) ) {
			return $this->unavailable( 'Prepared Woo order could not be loaded to prove economics.' );
		}
		return $this->assert_order_matches_quote( $order, $quote );
	}

	/**
	 * Recovery lookup. Not a claim. Uses supported Woo order querying, not post meta SQL.
	 * Does not report stockCommitment=reserved unless reservation is proven.
	 *
	 * @param string $transaction_id
	 * @return array<int,array<string,mixed>>
	 */
	public function find_orders_by_transaction( $transaction_id ) {
		if ( ! $this->environment->function_exists( 'wc_get_orders' ) ) {
			return array();
		}
		$orders = wc_get_orders(
			array(
				'limit'      => 5,
				'return'     => 'objects',
				'meta_key'   => Cetech_Pos_Bridge_Constants::ORDER_META_TX,
				'meta_value' => $transaction_id,
			)
		);
		if ( ! is_array( $orders ) ) {
			return array();
		}
		$out  = array();
		$hold = $this->hold_stock_seconds();
		foreach ( $orders as $order ) {
			$described = $this->describe_order( $order, $hold );
			if ( $described !== null ) {
				$out[] = $described;
			}
		}
		return $out;
	}

	/**
	 * Idempotently complete stock reservation for an already identified Woo order.
	 * Used by prepare retry, not by GET resolve.
	 *
	 * @param array<string,mixed> $found
	 * @return array<string,mixed>|WP_Error
	 */
	public function complete_stock_reservation( array $found ) {
		if ( ! empty( $found['reservationProven'] ) && isset( $found['stockCommitment'] ) && $found['stockCommitment'] === 'reserved' ) {
			return $found;
		}
		if ( ! $this->environment->function_exists( 'wc_get_order' ) || ! $this->environment->function_exists( 'wc_reserve_stock_for_order' ) ) {
			return $this->unavailable( 'Woo reservation APIs are not available to complete prepare recovery.' );
		}
		$order = wc_get_order( $found['orderId'] );
		if ( ! is_object( $order ) ) {
			return $this->unavailable( 'Woo order could not be loaded to complete reservation.' );
		}
		$reserved = $this->call_reserve_stock_for_order( $order, true );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $reserved ) ) {
			return $reserved;
		}
		$hold      = $this->hold_stock_seconds();
		$described = $this->describe_order( $order, $hold );
		if ( $described === null || empty( $described['reservationProven'] ) ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'REQUIRES_ATTENTION',
				'Existing Woo order reservation could not be proven after retry.',
				false,
				'contact_manager',
				409
			);
		}
		++$this->side_effects['stock'];
		return $described;
	}

	/**
	 * @param object $order
	 * @param int    $hold
	 * @return array<string,mixed>|null
	 */
	protected function describe_order( $order, $hold ) {
		if ( ! is_object( $order ) ) {
			return null;
		}
		$order_id = method_exists( $order, 'get_id' ) ? (string) $order->get_id() : '';
		$hash     = method_exists( $order, 'get_meta' ) ? (string) $order->get_meta( Cetech_Pos_Bridge_Constants::ORDER_META_HASH ) : '';
		$sale     = method_exists( $order, 'get_meta' ) ? (string) $order->get_meta( Cetech_Pos_Bridge_Constants::ORDER_META_SALE ) : '';
		$token    = method_exists( $order, 'get_meta' ) ? (string) $order->get_meta( Cetech_Pos_Bridge_Constants::ORDER_META_RECOVERY ) : '';
		if ( $token === '' && method_exists( $order, 'get_order_key' ) ) {
			$token = (string) $order->get_order_key();
		}
		$ref    = method_exists( $order, 'get_order_number' ) ? (string) $order->get_order_number() : $order_id;
		$proof  = $this->prove_order_reservation( $order );
		$proven = is_array( $proof );
		$row    = array(
			'orderId'           => $order_id,
			'saleId'            => $sale !== '' ? $sale : ( 'sale-' . $order_id ),
			'orderReference'    => $ref,
			'requestHash'       => $hash,
			'recoveryToken'     => $token,
			'reservationProven' => $proven,
			'holdSeconds'       => $hold,
		);
		if ( $proven ) {
			$row['stockCommitment']       = 'reserved';
			$row['reservationExpiresAt']  = $proof['expiresAt'];
			$row['holdSeconds']           = (int) $proof['holdSeconds'];
		}
		return $row;
	}

	/**
	 * Complete current reservation for every product Woo should hold.
	 * COUNT>0 is not proof. Expired rows are not proof.
	 *
	 * @param object $order
	 * @return bool
	 */
	protected function order_has_proven_reservation( $order ) {
		return is_array( $this->prove_order_reservation( $order ) );
	}

	/**
	 * @param object $order
	 * @return array<string,mixed>|null {expiresAt:string,holdSeconds:int}
	 */
	protected function prove_order_reservation( $order ) {
		$required = $this->expected_managed_reservation_quantities( $order );
		if ( ! is_array( $required ) || $required === array() ) {
			return null;
		}
		$rows = $this->read_current_reservation_rows( $order );
		if ( ! is_array( $rows ) ) {
			return null;
		}
		$min_expiry = null;
		foreach ( $required as $product_id => $qty ) {
			$key = (string) $product_id;
			if ( ! isset( $rows[ $key ] ) ) {
				return null;
			}
			$row = $rows[ $key ];
			if ( ! isset( $row['stock_quantity'] ) || ( (float) $row['stock_quantity'] + 0.0000001 ) < (float) $qty ) {
				return null;
			}
			$exp = $this->reservation_expiry_unix( isset( $row['expires'] ) ? $row['expires'] : null );
			if ( $exp === null || $exp <= time() ) {
				return null;
			}
			if ( $min_expiry === null || $exp < $min_expiry ) {
				$min_expiry = $exp;
			}
		}
		if ( $min_expiry === null ) {
			return null;
		}
		return array(
			'expiresAt'   => gmdate( 'Y-m-d\TH:i:s\Z', $min_expiry ),
			'holdSeconds' => $min_expiry - time(),
		);
	}

	/**
	 * Products Woo ReserveStock would actually hold: stock-managed, no backorders,
	 * aggregated by get_stock_managed_by_id(). Unmanaged/backorder items are omitted.
	 *
	 * @param object $order
	 * @return array<string,float>|null
	 */
	protected function expected_managed_reservation_quantities( $order ) {
		if ( ! is_object( $order ) || ! method_exists( $order, 'get_items' ) ) {
			return null;
		}
		$items = $order->get_items();
		if ( ! is_array( $items ) ) {
			return null;
		}
		$required = array();
		foreach ( $items as $item ) {
			if ( is_object( $item ) && method_exists( $item, 'is_type' ) && ! $item->is_type( 'line_item' ) ) {
				continue;
			}
			$qty = 0;
			if ( is_object( $item ) && method_exists( $item, 'get_quantity' ) ) {
				$qty = $item->get_quantity();
			}
			if ( $qty <= 0 ) {
				continue;
			}
			if ( ! is_object( $item ) || ! method_exists( $item, 'get_product' ) ) {
				return null;
			}
			$product = $item->get_product();
			if ( ! is_object( $product ) ) {
				continue;
			}
			if ( ! method_exists( $product, 'managing_stock' ) || ! method_exists( $product, 'backorders_allowed' ) || ! method_exists( $product, 'get_stock_managed_by_id' ) ) {
				return null;
			}
			if ( ! $product->managing_stock() || $product->backorders_allowed() ) {
				continue;
			}
			if ( $this->environment->function_exists( 'apply_filters' ) ) {
				$qty = apply_filters( 'woocommerce_order_item_quantity', $qty, $order, $item );
			}
			$managed_by = (string) $product->get_stock_managed_by_id();
			if ( $managed_by === '' ) {
				return null;
			}
			if ( ! isset( $required[ $managed_by ] ) ) {
				$required[ $managed_by ] = 0;
			}
			$required[ $managed_by ] += $qty;
		}
		return $required;
	}

	/**
	 * Read-only inspection of Woo's reservation table. Never writes.
	 *
	 * @param object $order
	 * @return array<string,array<string,mixed>>|null
	 */
	protected function read_current_reservation_rows( $order ) {
		$order_id = is_object( $order ) && method_exists( $order, 'get_id' ) ? (int) $order->get_id() : 0;
		if ( $order_id <= 0 ) {
			return null;
		}
		global $wpdb;
		if ( ! isset( $wpdb ) || ! is_object( $wpdb ) || ! method_exists( $wpdb, 'get_results' ) ) {
			return null;
		}
		$table = null;
		if ( isset( $wpdb->wc_reserved_stock ) && is_string( $wpdb->wc_reserved_stock ) && preg_match( '/^[A-Za-z0-9_]+$/', $wpdb->wc_reserved_stock ) ) {
			$table = $wpdb->wc_reserved_stock;
		}
		if ( $table === null ) {
			return null;
		}
		$sql = 'SELECT product_id, stock_quantity, expires FROM `' . $table . '` WHERE order_id = %d AND expires > NOW()';
		if ( method_exists( $wpdb, 'prepare' ) ) {
			$sql = $wpdb->prepare( $sql, $order_id );
		}
		$results = $wpdb->get_results( $sql, ARRAY_A );
		if ( ! is_array( $results ) ) {
			return null;
		}
		$out = array();
		foreach ( $results as $row ) {
			if ( ! is_array( $row ) || ! isset( $row['product_id'], $row['stock_quantity'], $row['expires'] ) ) {
				return null;
			}
			$key = (string) $row['product_id'];
			if ( isset( $out[ $key ] ) ) {
				return null;
			}
			$out[ $key ] = $row;
		}
		return $out;
	}

	/**
	 * @param mixed $expires
	 * @return int|null unix timestamp
	 */
	protected function reservation_expiry_unix( $expires ) {
		if ( is_int( $expires ) || ( is_string( $expires ) && ctype_digit( $expires ) ) ) {
			$unix = (int) $expires;
			return $unix > 0 ? $unix : null;
		}
		if ( ! is_string( $expires ) || $expires === '' ) {
			return null;
		}
		$unix = strtotime( $expires );
		return $unix === false ? null : $unix;
	}

	/**
	 * @param object $order
	 * @param bool   $recovery
	 * @return true|WP_Error
	 */
	protected function call_reserve_stock_for_order( $order, $recovery ) {
		try {
			$reserved = wc_reserve_stock_for_order( $order );
			if ( $reserved === false || Cetech_Pos_Bridge_Quote_Request::is_error( $reserved ) ) {
				if ( $recovery ) {
					return Cetech_Pos_Bridge_Response::wp_error(
						'REQUIRES_ATTENTION',
						'Existing Woo order reservation could not be completed.',
						false,
						'contact_manager',
						409
					);
				}
				return Cetech_Pos_Bridge_Response::wp_error(
					'STOCK_CHANGED',
					'Woo could not reserve stock for the prepared order.',
					false,
					'review_quote',
					409,
					array( 'field' => 'lines' )
				);
			}
			return true;
		} catch ( Exception $e ) {
			return $this->reservation_failure_from_exception( $e, $recovery );
		} catch ( Throwable $e ) {
			return $this->reservation_failure_from_exception( $e, $recovery );
		}
	}

	/**
	 * Normalize Woo reservation throwables. Does not invent error codes.
	 *
	 * @param Exception|Throwable $e
	 * @param bool                $recovery
	 * @return WP_Error
	 */
	public function reservation_failure_from_exception( $e, $recovery ) {
		$code  = '';
		$class = is_object( $e ) ? get_class( $e ) : '';
		if ( is_object( $e ) && method_exists( $e, 'getErrorCode' ) ) {
			$code = (string) $e->getErrorCode();
		}
		$is_reserve = ( strpos( $class, 'ReserveStockException' ) !== false );
		$insufficient = (
			$code === 'woocommerce_product_not_enough_stock'
			|| $code === 'woocommerce_product_out_of_stock'
		);
		if ( $insufficient || ( $is_reserve && $insufficient ) ) {
			if ( $recovery ) {
				return Cetech_Pos_Bridge_Response::wp_error(
					'REQUIRES_ATTENTION',
					'Existing Woo order reservation could not be completed.',
					false,
					'contact_manager',
					409
				);
			}
			return Cetech_Pos_Bridge_Response::wp_error(
				'STOCK_CHANGED',
				'Woo could not reserve stock for the prepared order.',
				false,
				'review_quote',
				409,
				array( 'field' => 'lines' )
			);
		}
		if ( $is_reserve && ! $recovery ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'STOCK_CHANGED',
				'Woo could not reserve stock for the prepared order.',
				false,
				'review_quote',
				409,
				array( 'field' => 'lines' )
			);
		}
		if ( $recovery ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'REQUIRES_ATTENTION',
				'Existing Woo order reservation could not be completed.',
				false,
				'contact_manager',
				409
			);
		}
		return $this->unavailable( 'Woo reservation failed without a classifiable stock outcome.' );
	}

	/**
	 * @param callable|null $slot
	 */
	protected function fire_seam( &$slot ) {
		if ( is_callable( $slot ) ) {
			$cb   = $slot;
			$slot = null;
			$cb( $this );
		}
	}

	/**
	 * @param object $order
	 * @param string $recovery_token
	 * @return bool
	 */
	protected function order_carries_recovery_token( $order, $recovery_token ) {
		$key  = method_exists( $order, 'get_order_key' ) ? (string) $order->get_order_key() : '';
		$meta = method_exists( $order, 'get_meta' ) ? (string) $order->get_meta( Cetech_Pos_Bridge_Constants::ORDER_META_RECOVERY ) : '';
		return $key === (string) $recovery_token || $meta === (string) $recovery_token;
	}

	/**
	 * @param array<string,mixed> $quote
	 * @return int|WP_Error
	 */
	protected function quote_customer_user_id( array $quote ) {
		$customer = isset( $quote['customer'] ) && is_array( $quote['customer'] ) ? $quote['customer'] : array();
		$kind     = isset( $customer['kind'] ) ? (string) $customer['kind'] : 'walkin';
		if ( $kind === 'walkin' ) {
			return 0;
		}
		if ( empty( $customer['customerId'] ) ) {
			return $this->unavailable( 'Registered quote is missing customer identity for the prepared Woo order.' );
		}
		$user_id = $this->resolve_customer_user_id( $customer['customerId'] );
		if ( $user_id === null ) {
			return $this->unavailable( 'Authorized customer context could not be mapped onto the prepared Woo order.' );
		}
		return (int) $user_id;
	}

	/**
	 * @param array<string,mixed> $line
	 * @return array<string,mixed>|null
	 */
	protected function quote_line_economics( array $line ) {
		$sub = $this->money_minor( isset( $line['subtotal'] ) ? $line['subtotal'] : null );
		$dis = $this->money_minor( isset( $line['discount'] ) ? $line['discount'] : null );
		$tax = $this->money_minor( isset( $line['tax'] ) ? $line['tax'] : null );
		$tot = $this->money_minor( isset( $line['total'] ) ? $line['total'] : null );
		if ( $sub === null || $dis === null || $tax === null || $tot === null ) {
			return null;
		}
		if ( Cetech_Pos_Bridge_Money::line_total( $sub, $dis, $tax ) !== $tot ) {
			return null;
		}
		$excl = $sub - $dis;
		if ( $excl < 0 ) {
			return null;
		}
		return array(
			'subtotal'    => $sub,
			'discount'    => $dis,
			'tax'         => $tax,
			'total'       => $tot,
			'subtotalDec' => Cetech_Pos_Bridge_Money::to_decimal_string( $sub ),
			'exclTaxDec'  => Cetech_Pos_Bridge_Money::to_decimal_string( $excl ),
			'taxDec'      => Cetech_Pos_Bridge_Money::to_decimal_string( $tax ),
			'totalDec'    => Cetech_Pos_Bridge_Money::to_decimal_string( $tot ),
		);
	}

	/**
	 * @param array<string,mixed> $quote
	 * @return array<string,mixed>|null
	 */
	protected function quote_order_economics( array $quote ) {
		$sub = $this->money_minor( isset( $quote['subtotal'] ) ? $quote['subtotal'] : null );
		$dis = $this->money_minor( isset( $quote['discount'] ) ? $quote['discount'] : null );
		$tax = $this->money_minor( isset( $quote['tax'] ) ? $quote['tax'] : null );
		$tot = $this->money_minor( isset( $quote['total'] ) ? $quote['total'] : null );
		$cur = isset( $quote['currency'] ) ? (string) $quote['currency'] : '';
		if ( $sub === null || $dis === null || $tax === null || $tot === null || $cur === '' ) {
			return null;
		}
		if ( Cetech_Pos_Bridge_Money::line_total( $sub, $dis, $tax ) !== $tot ) {
			return null;
		}
		return array(
			'currency'    => $cur,
			'subtotal'    => $sub,
			'discount'    => $dis,
			'tax'         => $tax,
			'total'       => $tot,
			'subtotalDec' => Cetech_Pos_Bridge_Money::to_decimal_string( $sub ),
			'discountDec' => Cetech_Pos_Bridge_Money::to_decimal_string( $dis ),
			'taxDec'      => Cetech_Pos_Bridge_Money::to_decimal_string( $tax ),
			'totalDec'    => Cetech_Pos_Bridge_Money::to_decimal_string( $tot ),
		);
	}

	/**
	 * @param mixed $envelope
	 * @return int|null
	 */
	protected function money_minor( $envelope ) {
		if ( ! is_array( $envelope ) || ! isset( $envelope['minor'] ) || ! is_numeric( $envelope['minor'] ) ) {
			return null;
		}
		return (int) $envelope['minor'];
	}

	/**
	 * @param object              $item
	 * @param array<string,mixed> $line
	 * @param array<string,mixed> $mapped
	 * @return true|WP_Error
	 */
	protected function apply_line_tax( $item, array $line, array $mapped ) {
		if ( method_exists( $item, 'set_subtotal' ) ) {
			$item->set_subtotal( $mapped['subtotalDec'] );
		}
		if ( method_exists( $item, 'set_total' ) ) {
			$item->set_total( $mapped['exclTaxDec'] );
		}
		$breakdown = $this->provider_tax_for_line( $line );
		if ( $mapped['tax'] > 0 && $breakdown !== null && method_exists( $item, 'set_taxes' ) ) {
			$item->set_taxes( $breakdown );
			return true;
		}
		if ( $mapped['tax'] > 0 && $breakdown === null && $this->line_requires_rate_breakdown() ) {
			return $this->unavailable( 'Authoritative Woo tax-rate breakdown is required to persist taxed order items and was not available.' );
		}
		if ( method_exists( $item, 'set_subtotal_tax' ) ) {
			$item->set_subtotal_tax( $mapped['taxDec'] );
		}
		if ( method_exists( $item, 'set_total_tax' ) ) {
			$item->set_total_tax( $mapped['taxDec'] );
		}
		return true;
	}

	/**
	 * Tax-rate allocation is required only when Woo item APIs cannot persist
	 * an aggregate tax amount. Default: aggregate setters are sufficient.
	 *
	 * @return bool
	 */
	protected function line_requires_rate_breakdown() {
		return false;
	}

	/**
	 * @param array<string,mixed> $line
	 * @return array<string,mixed>|null
	 */
	protected function provider_tax_for_line( array $line ) {
		$key = $this->line_tax_key( $line );
		return isset( $this->last_provider_tax[ $key ] ) ? $this->last_provider_tax[ $key ] : null;
	}

	/**
	 * @param array<string,mixed> $line
	 * @return string
	 */
	protected function line_tax_key( array $line ) {
		$pid = isset( $line['productId'] ) ? (string) $line['productId'] : '';
		$vid = isset( $line['variationId'] ) ? (string) $line['variationId'] : '';
		$qty = isset( $line['quantity'] ) ? (string) $line['quantity'] : '';
		return $pid . '|' . $vid . '|' . $qty;
	}

	/**
	 * @param object $order
	 * @return array<string,mixed>|null
	 */
	protected function read_order_economics( $order ) {
		if ( ! is_object( $order ) ) {
			return null;
		}
		$currency = method_exists( $order, 'get_currency' ) ? strtoupper( (string) $order->get_currency() ) : '';
		$sub      = $this->decimal_prop_minor( $order, 'get_subtotal' );
		$dis      = $this->decimal_prop_minor( $order, 'get_discount_total' );
		$tax      = $this->decimal_prop_minor( $order, 'get_total_tax' );
		$tot      = $this->decimal_prop_minor( $order, 'get_total' );
		if ( $currency === '' || $sub === null || $dis === null || $tax === null || $tot === null ) {
			return null;
		}
		return array(
			'currency' => $currency,
			'subtotal' => $sub,
			'discount' => $dis,
			'tax'      => $tax,
			'total'    => $tot,
		);
	}

	/**
	 * @param object $order
	 * @return array<int,array<string,mixed>>|null
	 */
	protected function read_order_line_economics( $order ) {
		if ( ! is_object( $order ) || ! method_exists( $order, 'get_items' ) ) {
			return null;
		}
		$items = $order->get_items();
		if ( ! is_array( $items ) ) {
			return null;
		}
		$out = array();
		foreach ( $items as $item ) {
			if ( is_object( $item ) && method_exists( $item, 'is_type' ) && ! $item->is_type( 'line_item' ) ) {
				continue;
			}
			$sub = $this->decimal_prop_minor( $item, 'get_subtotal' );
			$net = $this->decimal_prop_minor( $item, 'get_total' );
			$tax = $this->decimal_prop_minor( $item, 'get_total_tax' );
			$qty = is_object( $item ) && method_exists( $item, 'get_quantity' ) ? (string) $item->get_quantity() : '';
			if ( $sub === null || $net === null || $tax === null ) {
				return null;
			}
			$discount = $sub - $net;
			if ( $discount < 0 ) {
				return null;
			}
			$out[] = array(
				'subtotal' => $sub,
				'discount' => $discount,
				'tax'      => $tax,
				'total'    => $net + $tax,
				'quantity' => $qty,
			);
		}
		return $out;
	}

	/**
	 * @param object $obj
	 * @param string $method
	 * @return int|null
	 */
	protected function decimal_prop_minor( $obj, $method ) {
		if ( ! is_object( $obj ) || ! method_exists( $obj, $method ) ) {
			return null;
		}
		$value = $obj->{$method}();
		if ( is_numeric( $value ) ) {
			$value = (string) $value;
		}
		if ( ! is_string( $value ) ) {
			return null;
		}
		return Cetech_Pos_Bridge_Money::from_decimal_string( $value, Cetech_Pos_Bridge_Constants::SETTLEMENT_CURRENCY );
	}

	protected function attention_recovery( $message ) {
		return Cetech_Pos_Bridge_Response::wp_error(
			'REQUIRES_ATTENTION',
			$message,
			false,
			'contact_manager',
			409
		);
	}

	/**
	 * @param array<string,mixed> $line
	 * @return object|WP_Error
	 */
	protected function resolve_product( array $line ) {
		if ( ! $this->environment->function_exists( 'wc_get_product' ) ) {
			return $this->unavailable( 'wc_get_product is not available.' );
		}
		$id = isset( $line['variationId'] ) ? $line['variationId'] : $line['productId'];
		$product = wc_get_product( $id );
		if ( ! is_object( $product ) ) {
			$product = wc_get_product( $line['productId'] );
		}
		if ( ! is_object( $product ) ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'STOCK_CHANGED',
				'Quoted product is no longer available in Woo.',
				false,
				'review_quote',
				409,
				array( 'field' => 'lines' )
			);
		}
		if ( method_exists( $product, 'is_purchasable' ) && ! $product->is_purchasable() ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'STOCK_CHANGED',
				'Quoted product is no longer purchasable.',
				false,
				'review_quote',
				409,
				array( 'field' => 'lines' )
			);
		}
		if ( method_exists( $product, 'is_in_stock' ) && ! $product->is_in_stock() ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'STOCK_CHANGED',
				'Quoted product is out of stock.',
				false,
				'review_quote',
				409,
				array( 'field' => 'lines' )
			);
		}
		return $product;
	}

	protected function trash_incomplete_order( $order ) {
		if ( is_object( $order ) && method_exists( $order, 'delete' ) ) {
			$order->delete( true );
		}
	}
}
