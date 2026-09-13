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
		$contents = method_exists( $cart, 'get_cart' ) ? $cart->get_cart() : array();
		$lines    = array();
		foreach ( $contents as $item ) {
			$mapped = $this->map_cart_item( $item, $currency );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $mapped ) ) {
				return $mapped;
			}
			$lines[] = $mapped;
		}
		$priced = array(
			'currency' => $currency,
			'lines'    => $lines,
			'subtotal' => $this->cart_amount( $cart, 'get_subtotal', 'subtotal' ),
			'discount' => $this->cart_amount( $cart, 'get_discount_total', 'discount_total' ),
			'tax'      => $this->cart_amount( $cart, 'get_total_tax', 'total_tax' ),
			'total'    => $this->cart_total_amount( $cart ),
		);
		if ( $fee_minor < 0 ) {
			$priced = $this->apply_negative_fee_discount( $priced, -$fee_minor );
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

	protected function apply_negative_fee_discount( array $priced, $fee_discount_minor ) {
		$currency = (string) $priced['currency'];
		$add      = (int) $fee_discount_minor;
		if ( $add <= 0 ) {
			return $priced;
		}
		$coupon = Cetech_Pos_Bridge_Money::from_decimal_string( $priced['discount'], $currency );
		if ( $coupon === null ) {
			return $this->unavailable( 'Woo coupon discount could not be converted after a negative fee.' );
		}
		$lines = $priced['lines'];
		$n     = count( $lines );
		if ( $n < 1 ) {
			return $this->unavailable( 'Negative Woo fee discount had no cart lines to allocate.' );
		}
		$subs = array();
		$sum  = 0;
		foreach ( $lines as $line ) {
			$sub = Cetech_Pos_Bridge_Money::from_decimal_string( $line['subtotal'], $currency );
			if ( $sub === null ) {
				return $this->unavailable( 'A quote line subtotal could not be converted while allocating a Woo fee discount.' );
			}
			$subs[] = $sub;
			$sum   += $sub;
		}
		$left = $add;
		foreach ( $lines as $i => $line ) {
			$share = ( $i === $n - 1 ) ? $left : ( $sum > 0 ? intdiv( $add * $subs[ $i ], $sum ) : 0 );
			if ( $i !== $n - 1 ) {
				$left -= $share;
			}
			$existing = Cetech_Pos_Bridge_Money::from_decimal_string( $line['discount'], $currency );
			if ( $existing === null ) {
				return $this->unavailable( 'A quote line discount could not be converted while allocating a Woo fee discount.' );
			}
			$combined = $existing + $share;
			if ( $combined > $subs[ $i ] ) {
				return $this->unavailable( 'Woo fee discount exceeded a line subtotal; v1 Quote cannot allocate it.' );
			}
			$priced['lines'][ $i ]['discount'] = $this->format_minor_as_decimal( $combined );
		}
		$priced['discount'] = $this->format_minor_as_decimal( $coupon + $add );
		return $priced;
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

	protected function format_minor_as_decimal( $minor ) {
		$minor = (int) $minor;
		if ( $minor < 0 ) {
			$minor = 0;
		}
		return sprintf( '%d.%02d', intdiv( $minor, 100 ), $minor % 100 );
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
}
