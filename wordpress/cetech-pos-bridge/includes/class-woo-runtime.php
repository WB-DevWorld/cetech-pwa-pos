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
	 * Restore snapshot. Always safe to call from finally.
	 *
	 * @param array<string,mixed> $snapshot
	 */
	public function restore( array $snapshot ) {
		if ( $this->environment->function_exists( 'wp_set_current_user' ) && array_key_exists( 'user_id', $snapshot ) ) {
			wp_set_current_user( (int) $snapshot['user_id'] );
		}
		$wc = $this->wc();
		if ( ! $wc ) {
			return;
		}
		if ( array_key_exists( 'session', $snapshot ) ) {
			$wc->session = $snapshot['session'];
		}
		if ( array_key_exists( 'customer', $snapshot ) ) {
			$wc->customer = $snapshot['customer'];
		}
		if ( array_key_exists( 'cart', $snapshot ) ) {
			$wc->cart = $snapshot['cart'];
		}
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
			$this->set_user( 0 );
			$wc->customer = $this->new_customer( 0 );
			$wc->session  = $this->new_session();
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
		$this->set_user( $user_id );
		$wc->customer = $this->new_customer( $user_id );
		$wc->session  = $this->new_session();
		return true;
	}

	public function reset_cart() {
		$wc = $this->wc();
		if ( ! $wc ) {
			return $this->unavailable( 'WooCommerce runtime is not available.' );
		}
		$wc->cart = $this->new_cart();
		if ( is_object( $wc->cart ) && method_exists( $wc->cart, 'empty_cart' ) ) {
			$wc->cart->empty_cart( false );
		}
		return true;
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
		$contents = method_exists( $cart, 'get_cart' ) ? $cart->get_cart() : array();
		$lines    = array();
		foreach ( $contents as $item ) {
			$mapped = $this->map_cart_item( $item, $currency );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $mapped ) ) {
				return $mapped;
			}
			$lines[] = $mapped;
		}
		return array(
			'currency' => $currency,
			'lines'    => $lines,
			'subtotal' => $this->cart_amount( $cart, 'get_subtotal', 'subtotal' ),
			'discount' => $this->cart_amount( $cart, 'get_discount_total', 'discount_total' ),
			'tax'      => $this->cart_amount( $cart, 'get_total_tax', 'total_tax' ),
			'total'    => $this->cart_total_amount( $cart ),
		);
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
		if ( is_int( $raw ) ) {
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
		if ( $this->environment->function_exists( 'b2bking_is_b2b_user' ) && b2bking_is_b2b_user( $user_id ) ) {
			return 'b2b';
		}
		if ( $this->environment->function_exists( 'b2bking_is_b2c_user' ) && b2bking_is_b2c_user( $user_id ) ) {
			return 'retail';
		}
		return 'retail';
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
		return new Cetech_Pos_Bridge_Ephemeral_Session();
	}

	protected function count_orders() {
		if ( $this->environment->function_exists( 'wc_orders_count' ) ) {
			return (int) wc_orders_count( 'any' );
		}
		return null;
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
