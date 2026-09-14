<?php

/**
 * Exercises production Cetech_Pos_Bridge_Woo_Runtime cart mapping.
 * Fake_Woo_Runtime is not used here: it bypasses map_cart_item.
 */

class Cetech_Pos_Bridge_Stub_Product {
	public $price;
	public $purchasable = true;
	public $stock       = 'instock';

	public function get_price() {
		return $this->price;
	}

	public function is_purchasable() {
		return (bool) $this->purchasable;
	}

	public function get_stock_status() {
		return $this->stock;
	}
}

class Cetech_Pos_Bridge_Stub_Product_Without_Price {}

class Cetech_Pos_Bridge_Stub_Cart {
	public $items          = array();
	public $subtotal       = '0.00';
	public $discount_total = '0.00';
	public $total_tax      = '0.00';
	public $total          = '0.00';
	public $shipping_total = '0';
	public $fee_total      = '0';
	public $fees           = array();

	public function get_cart() {
		return $this->items;
	}

	public function get_subtotal() {
		return $this->subtotal;
	}

	public function get_discount_total() {
		return $this->discount_total;
	}

	public function get_total_tax() {
		return $this->total_tax;
	}

	public function get_shipping_total() {
		return isset( $this->shipping_total ) ? $this->shipping_total : '0';
	}

	public function get_fee_total() {
		return isset( $this->fee_total ) ? $this->fee_total : '0';
	}

	public function get_fees() {
		return isset( $this->fees ) && is_array( $this->fees ) ? $this->fees : array();
	}

	public function get_total( $context = 'edit' ) {
		unset( $context );
		return $this->total;
	}
}

class Cetech_Pos_Bridge_Stub_Wc {
	public $cart;
}

class Cetech_Pos_Bridge_Harness_Woo_Runtime extends Cetech_Pos_Bridge_Woo_Runtime {
	/** @var object */
	public $stub_wc;

	protected function wc() {
		return $this->stub_wc;
	}
}

function br02_production_runtime_with_cart( Cetech_Pos_Bridge_Stub_Cart $cart ) {
	$env             = br01_authorized_env();
	$env->woo        = true;
	$runtime         = new Cetech_Pos_Bridge_Harness_Woo_Runtime( $env );
	$wc              = new Cetech_Pos_Bridge_Stub_Wc();
	$wc->cart        = $cart;
	$runtime->stub_wc = $wc;
	return $runtime;
}

function br02_stub_cart_item( array $args ) {
	$product        = new Cetech_Pos_Bridge_Stub_Product();
	$product->price = $args['unitPrice'];
	$item           = array(
		'product_id'    => $args['productId'],
		'quantity'      => $args['quantity'],
		'line_subtotal' => $args['subtotal'],
		'line_total'    => isset( $args['lineTotal'] ) ? $args['lineTotal'] : $args['subtotal'],
		'line_tax'      => isset( $args['tax'] ) ? $args['tax'] : '0',
		'data'          => $product,
	);
	if ( ! empty( $args['variationId'] ) ) {
		$item['variation_id'] = $args['variationId'];
	}
	return $item;
}

function br02_stub_fee( $amount, $tax = '0.00' ) {
	$fee          = new stdClass();
	$fee->amount  = $amount;
	$fee->tax     = $tax;
	$fee->taxable = false;
	return $fee;
}

$qty5_cart              = new Cetech_Pos_Bridge_Stub_Cart();
$qty5_cart->items[]     = br02_stub_cart_item(
	array(
		'productId' => '101',
		'quantity'  => '5',
		'unitPrice' => '9.00',
		'subtotal'  => '45.00',
	)
);
$qty5_cart->subtotal    = '45.00';
$qty5_cart->total       = '45.00';
$qty5                   = br02_production_runtime_with_cart( $qty5_cart )->get_priced_cart();
br01_assert( is_array( $qty5 ), 'production mapping qty>1 returns priced cart' );
$qty5_unit              = Cetech_Pos_Bridge_Money::from_decimal_string( $qty5['lines'][0]['unitPrice'], 'GHS' );
$qty5_sub               = Cetech_Pos_Bridge_Money::from_decimal_string( $qty5['lines'][0]['subtotal'], 'GHS' );
$qty5_discount          = Cetech_Pos_Bridge_Money::from_decimal_string( $qty5['lines'][0]['discount'], 'GHS' );
$qty5_tax               = Cetech_Pos_Bridge_Money::from_decimal_string( $qty5['lines'][0]['tax'], 'GHS' );
$qty5_line_total        = Cetech_Pos_Bridge_Money::line_total( $qty5_sub, $qty5_discount, $qty5_tax );
$qty5_cart_total        = Cetech_Pos_Bridge_Money::from_decimal_string( $qty5['total'], 'GHS' );
br01_assert_eq( 900, $qty5_unit, 'qty 5 authoritative unitPrice minor 900 not line subtotal' );
br01_assert_eq( 4500, $qty5_sub, 'qty 5 line subtotal minor 4500' );
br01_assert( $qty5_unit !== $qty5_sub, 'unitPrice is not substituted from line subtotal' );
br01_assert_eq( 4500, $qty5_line_total, 'qty 5 line total identity subtotal - discount + tax' );
br01_assert_eq( 4500, $qty5_cart_total, 'qty 5 cart total matches independent line identity' );
br01_assert_eq( '5', $qty5['lines'][0]['quantity'], 'qty 5 quantity preserved' );

$qty1_cart              = new Cetech_Pos_Bridge_Stub_Cart();
$qty1_cart->items[]     = br02_stub_cart_item(
	array(
		'productId' => '101',
		'quantity'  => '1',
		'unitPrice' => '10.00',
		'subtotal'  => '10.00',
	)
);
$qty1_cart->subtotal    = '10.00';
$qty1_cart->total       = '10.00';
$qty1                   = br02_production_runtime_with_cart( $qty1_cart )->get_priced_cart();
$qty1_unit              = Cetech_Pos_Bridge_Money::from_decimal_string( $qty1['lines'][0]['unitPrice'], 'GHS' );
$qty1_sub               = Cetech_Pos_Bridge_Money::from_decimal_string( $qty1['lines'][0]['subtotal'], 'GHS' );
br01_assert_eq( 1000, $qty1_unit, 'qty 1 unitPrice from product get_price' );
br01_assert_eq( 1000, $qty1_sub, 'qty 1 subtotal unchanged' );

$var_cart               = new Cetech_Pos_Bridge_Stub_Cart();
$var_cart->items[]      = br02_stub_cart_item(
	array(
		'productId'   => '200',
		'variationId' => '201',
		'quantity'    => '2',
		'unitPrice'   => '12.00',
		'subtotal'    => '24.00',
		'lineTotal'   => '23.00',
		'tax'         => '0',
	)
);
$var_cart->subtotal     = '24.00';
$var_cart->discount_total = '1.00';
$var_cart->total        = '23.00';
$variation_mapped       = br02_production_runtime_with_cart( $var_cart )->get_priced_cart();
$var_unit               = Cetech_Pos_Bridge_Money::from_decimal_string( $variation_mapped['lines'][0]['unitPrice'], 'GHS' );
$var_sub                = Cetech_Pos_Bridge_Money::from_decimal_string( $variation_mapped['lines'][0]['subtotal'], 'GHS' );
$var_discount           = Cetech_Pos_Bridge_Money::from_decimal_string( $variation_mapped['lines'][0]['discount'], 'GHS' );
$var_tax                = Cetech_Pos_Bridge_Money::from_decimal_string( $variation_mapped['lines'][0]['tax'], 'GHS' );
br01_assert_eq( '201', $variation_mapped['lines'][0]['variationId'], 'variationId preserved on production mapping' );
br01_assert_eq( 1200, $var_unit, 'variation unitPrice from product get_price not subtotal' );
br01_assert_eq( 2400, $var_sub, 'variation line subtotal' );
br01_assert_eq( 100, $var_discount, 'variation discount from runtime line_subtotal minus line_total' );
br01_assert_eq(
	2300,
	Cetech_Pos_Bridge_Money::line_total( $var_sub, $var_discount, $var_tax ),
	'variation line total identity is not unitPrice times quantity'
);

$frac_cart              = new Cetech_Pos_Bridge_Stub_Cart();
$frac_cart->items[]     = br02_stub_cart_item(
	array(
		'productId' => '101',
		'quantity'  => '2.5',
		'unitPrice' => '9.00',
		'subtotal'  => '22.50',
	)
);
$frac_cart->subtotal    = '22.50';
$frac_cart->total       = '22.50';
$frac                   = br02_production_runtime_with_cart( $frac_cart )->get_priced_cart();
$frac_unit              = Cetech_Pos_Bridge_Money::from_decimal_string( $frac['lines'][0]['unitPrice'], 'GHS' );
$frac_sub               = Cetech_Pos_Bridge_Money::from_decimal_string( $frac['lines'][0]['subtotal'], 'GHS' );
br01_assert_eq( 900, $frac_unit, 'fractional qty does not divide subtotal for unitPrice' );
br01_assert_eq( 2250, $frac_sub, 'fractional qty subtotal from Woo line_subtotal' );
br01_assert_eq( '2.5', $frac['lines'][0]['quantity'], 'fractional Quantity preserved' );

$missing_cart           = new Cetech_Pos_Bridge_Stub_Cart();
$missing_item           = br02_stub_cart_item(
	array(
		'productId' => '101',
		'quantity'  => '5',
		'unitPrice' => '9.00',
		'subtotal'  => '45.00',
	)
);
$missing_item['data']   = new Cetech_Pos_Bridge_Stub_Product_Without_Price();
$missing_cart->items[]  = $missing_item;
$missing                = br02_production_runtime_with_cart( $missing_cart )->get_priced_cart();
br01_assert( Cetech_Pos_Bridge_Quote_Request::is_error( $missing ), 'missing get_price fails closed' );
br01_assert_eq( 'INTEGRATION_UNAVAILABLE', $missing->get_error_code(), 'missing unit price is INTEGRATION_UNAVAILABLE' );

$empty_cart             = new Cetech_Pos_Bridge_Stub_Cart();
$empty_item             = br02_stub_cart_item(
	array(
		'productId' => '101',
		'quantity'  => '5',
		'unitPrice' => '',
		'subtotal'  => '45.00',
	)
);
$empty_cart->items[]    = $empty_item;
$empty_price            = br02_production_runtime_with_cart( $empty_cart )->get_priced_cart();
br01_assert( Cetech_Pos_Bridge_Quote_Request::is_error( $empty_price ), 'empty get_price fails closed' );
br01_assert_eq( 'INTEGRATION_UNAVAILABLE', $empty_price->get_error_code(), 'empty unit price is not subtotal fallback' );

$float_cart             = new Cetech_Pos_Bridge_Stub_Cart();
$float_item             = br02_stub_cart_item(
	array(
		'productId' => '101',
		'quantity'  => '5',
		'unitPrice' => 9.00,
		'subtotal'  => '45.00',
	)
);
$float_cart->items[]    = $float_item;
$float_cart->subtotal   = '45.00';
$float_cart->total      = '45.00';
$float_price            = br02_production_runtime_with_cart( $float_cart )->get_priced_cart();
br01_assert( is_array( $float_price ), 'numeric get_price is accepted after wc_format_decimal' );
$float_unit             = Cetech_Pos_Bridge_Money::from_decimal_string( $float_price['lines'][0]['unitPrice'], 'GHS' );
br01_assert_eq( 900, $float_unit, 'float get_price 9.00 becomes unitPriceMinor 900 via Woo decimal format' );

br01_assert_eq( false, ( new Cetech_Pos_Bridge_Woo_Runtime( br01_authorized_env() ) )->counter_sale_needs_no_shipping( true ), 'POS counter isolation rejects storefront shipping' );

$ship_cart           = new Cetech_Pos_Bridge_Stub_Cart();
$ship_cart->items[]  = br02_stub_cart_item(
	array(
		'productId' => '101',
		'quantity'  => '1',
		'unitPrice' => '40.00',
		'subtotal'  => '40.00',
	)
);
$ship_cart->subtotal = '40.00';
$ship_cart->total    = '1040.00';
$ship_cart->shipping_total = '1000';
$shipped             = br02_production_runtime_with_cart( $ship_cart )->get_priced_cart();
br01_assert( Cetech_Pos_Bridge_Quote_Request::is_error( $shipped ), 'storefront shipping in cart fails closed' );
br01_assert_eq( 'INTEGRATION_UNAVAILABLE', $shipped->get_error_code(), 'shipping cannot enter v1 Quote.total' );

$pos_fee_cart           = new Cetech_Pos_Bridge_Stub_Cart();
$pos_fee_cart->items[]  = br02_stub_cart_item(
	array(
		'productId' => '101',
		'quantity'  => '1',
		'unitPrice' => '40.00',
		'subtotal'  => '40.00',
	)
);
$pos_fee_cart->subtotal = '40.00';
$pos_fee_cart->total    = '45.00';
$pos_fee_cart->fee_total = '5';
$pos_fee                 = br02_production_runtime_with_cart( $pos_fee_cart )->get_priced_cart();
br01_assert( Cetech_Pos_Bridge_Quote_Request::is_error( $pos_fee ), 'positive Woo fee fails closed' );
br01_assert_eq( 'INTEGRATION_UNAVAILABLE', $pos_fee->get_error_code(), 'positive fee cannot enter v1 Quote.total' );

$neg_fee_cart            = new Cetech_Pos_Bridge_Stub_Cart();
$neg_fee_cart->items[]   = br02_stub_cart_item(
	array(
		'productId' => '101',
		'quantity'  => '10',
		'unitPrice' => '34.00',
		'subtotal'  => '340.00',
	)
);
$neg_fee_cart->subtotal  = '340.00';
$neg_fee_cart->total     = '323.00';
$neg_fee_cart->fee_total = '-17';
$neg_fee_cart->fees      = array( br02_stub_fee( '-17.00' ) );
$neg_fee                 = br02_production_runtime_with_cart( $neg_fee_cart )->get_priced_cart();
br01_assert( is_array( $neg_fee ), 'negative Woo fee is accepted as a cart-level commercial discount candidate' );
br01_assert_eq( 1700, $neg_fee['cartLevelDiscountMinor'], 'negative fee -17.00 becomes cartLevelDiscountMinor 1700' );
$neg_line_disc           = Cetech_Pos_Bridge_Money::from_decimal_string( $neg_fee['lines'][0]['discount'], 'GHS' );
br01_assert_eq( 0, $neg_line_disc, 'get_priced_cart does not allocate cart-level discount onto lines' );
$neg_applied             = Cetech_Pos_Bridge_Cart_Discount::apply_to_priced_cart(
	$neg_fee,
	array(
		array( 'lineId' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' ),
	)
);
br01_assert( is_array( $neg_applied ), 'ADR-013 allocation applies the proven cart-level discount' );
$neg_line_disc           = Cetech_Pos_Bridge_Money::from_decimal_string( $neg_applied['lines'][0]['discount'], 'GHS' );
$neg_cart_disc           = Cetech_Pos_Bridge_Money::from_decimal_string( $neg_applied['discount'], 'GHS' );
$neg_cart_total          = Cetech_Pos_Bridge_Money::from_decimal_string( $neg_applied['total'], 'GHS' );
$neg_line_sub            = Cetech_Pos_Bridge_Money::from_decimal_string( $neg_applied['lines'][0]['subtotal'], 'GHS' );
$neg_line_tax            = Cetech_Pos_Bridge_Money::from_decimal_string( $neg_applied['lines'][0]['tax'], 'GHS' );
$neg_line_total          = Cetech_Pos_Bridge_Money::line_total( $neg_line_sub, $neg_line_disc, $neg_line_tax );
br01_assert_eq( 1700, $neg_line_disc, 'negative fee -17.00 becomes line discountMinor 1700' );
br01_assert_eq( 1700, $neg_cart_disc, 'cart discountMinor matches allocated fee discount' );
br01_assert_eq( 32300, $neg_cart_total, 'cart total remains Woo get_total including the negative fee' );
br01_assert_eq( 32300, $neg_line_total, 'line identity subtotal - discount + tax after fee allocation' );

$taxed_fee_cart            = new Cetech_Pos_Bridge_Stub_Cart();
$taxed_fee_cart->items[]   = br02_stub_cart_item(
	array(
		'productId' => '101',
		'quantity'  => '1',
		'unitPrice' => '40.00',
		'subtotal'  => '40.00',
	)
);
$taxed_fee_cart->subtotal  = '40.00';
$taxed_fee_cart->total     = '38.00';
$taxed_fee_cart->fee_total = '-2';
$taxed_fee_cart->fees      = array( br02_stub_fee( '-2.00', '0.20' ) );
$taxed_fee                 = br02_production_runtime_with_cart( $taxed_fee_cart )->get_priced_cart();
br01_assert( Cetech_Pos_Bridge_Quote_Request::is_error( $taxed_fee ), 'ambiguous/unsupported taxed fee fails closed' );
br01_assert_eq( 'INTEGRATION_UNAVAILABLE', $taxed_fee->get_error_code(), 'taxed fee cannot enter v1 Quote.discount' );

class Cetech_Pos_Bridge_Kind_Runtime extends Cetech_Pos_Bridge_Harness_Woo_Runtime {
	public $stored_flag = '';

	protected function b2bking_stored_user_flag( $user_id ) {
		unset( $user_id );
		return $this->stored_flag;
	}

	public function expose_kind( $user_id ) {
		return $this->detect_customer_kind( $user_id );
	}
}

$kind_runtime               = new Cetech_Pos_Bridge_Kind_Runtime( br01_authorized_env() );
$kind_runtime->stored_flag  = 'yes';
br01_assert_eq( 'b2b', $kind_runtime->expose_kind( 8 ), 'B2BKing b2bking_b2buser=yes is b2b' );
$kind_runtime->stored_flag  = '';
br01_assert_eq( 'retail', $kind_runtime->expose_kind( 13 ), 'absent B2BKing flag is retail' );

class Cetech_Pos_Bridge_Reservation_Proof_Harness extends Cetech_Pos_Bridge_Woo_Runtime {
	public $injected_rows = array();

	public function prove( $order ) {
		return $this->prove_order_reservation( $order );
	}

	protected function read_current_reservation_rows( $order ) {
		unset( $order );
		return $this->injected_rows;
	}
}

class Cetech_Pos_Bridge_Stub_Reserve_Product {
	public $managing;
	public $backorders;
	public $managed_by;

	public function __construct( $managing, $backorders, $managed_by ) {
		$this->managing   = $managing;
		$this->backorders = $backorders;
		$this->managed_by = $managed_by;
	}

	public function managing_stock() {
		return $this->managing;
	}

	public function backorders_allowed() {
		return $this->backorders;
	}

	public function get_stock_managed_by_id() {
		return $this->managed_by;
	}
}

class Cetech_Pos_Bridge_Stub_Reserve_Item {
	public $product;
	public $qty;
	public $type = 'line_item';

	public function is_type( $type ) {
		return $type === $this->type;
	}

	public function get_quantity() {
		return $this->qty;
	}

	public function get_product() {
		return $this->product;
	}
}

class Cetech_Pos_Bridge_Stub_Reserve_Order {
	public $id    = 42;
	public $items = array();

	public function get_id() {
		return $this->id;
	}

	public function get_items() {
		return $this->items;
	}
}

function br02_reserve_item( $managed_by, $qty, $managing = true, $backorders = false ) {
	$item          = new Cetech_Pos_Bridge_Stub_Reserve_Item();
	$item->qty     = $qty;
	$item->product = new Cetech_Pos_Bridge_Stub_Reserve_Product( $managing, $backorders, $managed_by );
	return $item;
}

$proof_runtime = new Cetech_Pos_Bridge_Reservation_Proof_Harness( br01_authorized_env() );
$proof_order   = new Cetech_Pos_Bridge_Stub_Reserve_Order();
$proof_order->items[] = br02_reserve_item( '101', 1 );
$proof_order->items[] = br02_reserve_item( '102', 2 );
$future = time() + 1800;

$proof_runtime->injected_rows = array(
	'101' => array(
		'product_id'     => '101',
		'stock_quantity' => 1,
		'expires'        => $future,
	),
);
br01_assert_eq( null, $proof_runtime->prove( $proof_order ), 'only one of two required reservation rows is not proven' );

$proof_runtime->injected_rows['102'] = array(
	'product_id'     => '102',
	'stock_quantity' => 1,
	'expires'        => $future,
);
br01_assert_eq( null, $proof_runtime->prove( $proof_order ), 'wrong reserved quantity is not proven' );

$proof_runtime->injected_rows['102']['stock_quantity'] = 2;
$proof_runtime->injected_rows['102']['expires']        = time() - 30;
br01_assert_eq( null, $proof_runtime->prove( $proof_order ), 'expired reservation row is not proven' );

$proof_runtime->injected_rows['102']['expires'] = $future;
$proof_ok = $proof_runtime->prove( $proof_order );
br01_assert( is_array( $proof_ok ), 'all expected current quantity-correct rows are proven' );
br01_assert_eq( gmdate( 'Y-m-d\TH:i:s\Z', $future ), $proof_ok['expiresAt'], 'proven expiry is the minimum actual reservation expiry' );

$agg_order   = new Cetech_Pos_Bridge_Stub_Reserve_Order();
$agg_order->items[] = br02_reserve_item( '201', 1 );
$agg_order->items[] = br02_reserve_item( '201', 3 );
$proof_runtime->injected_rows = array(
	'201' => array(
		'product_id'     => '201',
		'stock_quantity' => 4,
		'expires'        => $future,
	),
);
br01_assert( is_array( $proof_runtime->prove( $agg_order ) ), 'repeated managed product IDs are aggregated before proof' );

$skip_order   = new Cetech_Pos_Bridge_Stub_Reserve_Order();
$skip_order->items[] = br02_reserve_item( '301', 1, true, false );
$skip_order->items[] = br02_reserve_item( '302', 1, false, false );
$skip_order->items[] = br02_reserve_item( '303', 1, true, true );
$proof_runtime->injected_rows = array(
	'301' => array(
		'product_id'     => '301',
		'stock_quantity' => 1,
		'expires'        => $future,
	),
);
br01_assert( is_array( $proof_runtime->prove( $skip_order ) ), 'unmanaged and backorder items are omitted from the required reservation set' );

$empty_order = new Cetech_Pos_Bridge_Stub_Reserve_Order();
$empty_order->items[] = br02_reserve_item( '401', 1, false, false );
$proof_runtime->injected_rows = array();
br01_assert_eq( null, $proof_runtime->prove( $empty_order ), 'an order with nothing Woo would reserve is not a reserved commitment' );

$norm_runtime = new Cetech_Pos_Bridge_Woo_Runtime( br01_authorized_env() );
$norm_stock   = $norm_runtime->reservation_failure_from_exception(
	new Cetech_Pos_Bridge_Test_ReserveStockException( 'woocommerce_product_not_enough_stock', 'no stock' ),
	false
);
br01_assert_eq( 'STOCK_CHANGED', $norm_stock->get_error_code(), 'ReserveStockException insufficient stock is STOCK_CHANGED on create' );
$norm_recover = $norm_runtime->reservation_failure_from_exception(
	new Cetech_Pos_Bridge_Test_ReserveStockException( 'woocommerce_product_out_of_stock', 'oos' ),
	true
);
br01_assert_eq( 'REQUIRES_ATTENTION', $norm_recover->get_error_code(), 'ReserveStockException on recovery is canonical requires_attention' );
$norm_other = $norm_runtime->reservation_failure_from_exception( new RuntimeException( 'provider boom' ), false );
br01_assert_eq( 'INTEGRATION_UNAVAILABLE', $norm_other->get_error_code(), 'unclassifiable reservation throwable is not a fatal and is not PreparedSale' );

