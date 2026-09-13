<?php

/**
 * ADR-013 largest-remainder cart-level discount allocation.
 * Production allocator, not a copied WoodMart/B2BKing formula.
 */

$line_a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
$line_b = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
$line_c = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

function br13_line( $line_id, $subtotal, $discount = 0, $tax = 0 ) {
	return array(
		'lineId'        => $line_id,
		'subtotalMinor' => $subtotal,
		'discountMinor' => $discount,
		'taxMinor'      => $tax,
	);
}

$divisible = Cetech_Pos_Bridge_Cart_Discount::allocate(
	array(
		br13_line( $line_a, 1000 ),
		br13_line( $line_b, 1000 ),
	),
	200
);
br01_assert( is_array( $divisible ), 'two-line exactly divisible cart discount allocates' );
br01_assert_eq( 100, $divisible[0]['allocatedMinor'], 'divisible line A share 100' );
br01_assert_eq( 100, $divisible[1]['allocatedMinor'], 'divisible line B share 100' );
br01_assert_eq( 100, $divisible[0]['discountMinor'], 'divisible line A final discount 100' );
br01_assert_eq( 200, $divisible[0]['allocatedMinor'] + $divisible[1]['allocatedMinor'], 'divisible shares sum to cart discount' );

$remainder = Cetech_Pos_Bridge_Cart_Discount::allocate(
	array(
		br13_line( $line_a, 1000 ),
		br13_line( $line_b, 2000 ),
	),
	100
);
br01_assert( is_array( $remainder ), 'two-line one-minor remainder allocates' );
br01_assert_eq( 33, $remainder[0]['allocatedMinor'], 'remainder floor share for base 1000 is 33' );
br01_assert_eq( 67, $remainder[1]['allocatedMinor'], 'remainder leftover 1 goes to the larger remainder (base 2000)' );
br01_assert_eq( 100, $remainder[0]['allocatedMinor'] + $remainder[1]['allocatedMinor'], 'remainder shares sum to 100' );

$three = Cetech_Pos_Bridge_Cart_Discount::allocate(
	array(
		br13_line( $line_a, 100 ),
		br13_line( $line_b, 200 ),
		br13_line( $line_c, 300 ),
	),
	10
);
br01_assert( is_array( $three ), 'three-line uneven proportions allocate' );
br01_assert_eq( 2, $three[0]['allocatedMinor'], 'three-line leftover 1 goes to largest remainder (base 100)' );
br01_assert_eq( 3, $three[1]['allocatedMinor'], 'three-line middle floor 3' );
br01_assert_eq( 5, $three[2]['allocatedMinor'], 'three-line largest base floor 5' );
br01_assert_eq( 10, $three[0]['allocatedMinor'] + $three[1]['allocatedMinor'] + $three[2]['allocatedMinor'], 'three-line shares sum to 10' );

$tie_ab = Cetech_Pos_Bridge_Cart_Discount::allocate(
	array(
		br13_line( $line_a, 1000 ),
		br13_line( $line_b, 1000 ),
	),
	1
);
$tie_ba = Cetech_Pos_Bridge_Cart_Discount::allocate(
	array(
		br13_line( $line_b, 1000 ),
		br13_line( $line_a, 1000 ),
	),
	1
);
br01_assert( is_array( $tie_ab ) && is_array( $tie_ba ), 'equal-remainder tie allocates' );
br01_assert_eq( 1, $tie_ab[0]['allocatedMinor'], 'tie-break gives leftover to lexicographically smaller lineId' );
br01_assert_eq( 0, $tie_ab[1]['allocatedMinor'], 'tie-break larger lineId waits' );
br01_assert_eq( 0, $tie_ba[0]['allocatedMinor'], 'reversed input still withholds leftover from the larger lineId' );
br01_assert_eq( 1, $tie_ba[1]['allocatedMinor'], 'reversed input still awards leftover to the smaller lineId' );

$combo = Cetech_Pos_Bridge_Cart_Discount::allocate(
	array(
		br13_line( $line_a, 10000, 1000 ),
		br13_line( $line_b, 5000, 0 ),
	),
	1400
);
br01_assert( is_array( $combo ), 'existing line-level discount plus cart-level discount allocates' );
br01_assert_eq( 9000, $combo[0]['baseMinor'], 'allocation base is subtotal minus existing line discount' );
br01_assert_eq( 900, $combo[0]['allocatedMinor'], 'cart share on couponed line' );
br01_assert_eq( 1900, $combo[0]['discountMinor'], 'final discount is line-level plus allocated share' );
br01_assert_eq( 500, $combo[1]['allocatedMinor'], 'cart share on uncouponed line' );
br01_assert_eq( 500, $combo[1]['discountMinor'], 'uncouponed final discount equals cart share' );
br01_assert_eq( 2400, $combo[0]['discountMinor'] + $combo[1]['discountMinor'], 'sum(line.discount) includes line-level plus cart-level' );

$woodmart_b2b = Cetech_Pos_Bridge_Cart_Discount::allocate(
	array(
		br13_line( $line_a, 76000 ),
		br13_line( $line_b, 34000 ),
	),
	5500
);
br01_assert( is_array( $woodmart_b2b ), 'WoodMart-priced base plus B2B line allocates' );
br01_assert_eq( 5500, $woodmart_b2b[0]['allocatedMinor'] + $woodmart_b2b[1]['allocatedMinor'], 'WoodMart+B2B shares sum to cart discount' );
br01_assert_eq(
	Cetech_Pos_Bridge_Money::line_total( 76000, $woodmart_b2b[0]['discountMinor'], 0 ),
	$woodmart_b2b[0]['totalMinor'],
	'WoodMart-priced line keeps total = subtotal - discount + tax'
);

$oversize = Cetech_Pos_Bridge_Cart_Discount::allocate(
	array(
		br13_line( $line_a, 100 ),
		br13_line( $line_b, 100 ),
	),
	201
);
br01_assert( Cetech_Pos_Bridge_Cart_Discount::is_error( $oversize ), 'discount greater than eligible line economics fails closed' );
br01_assert_eq( 'INTEGRATION_UNAVAILABLE', $oversize->get_error_code(), 'oversize cart discount is INTEGRATION_UNAVAILABLE' );

$two_line_cart           = new Cetech_Pos_Bridge_Stub_Cart();
$two_line_cart->items[]  = br02_stub_cart_item(
	array(
		'productId' => '101',
		'quantity'  => '1',
		'unitPrice' => '10.00',
		'subtotal'  => '10.00',
	)
);
$two_line_cart->items[]  = br02_stub_cart_item(
	array(
		'productId' => '102',
		'quantity'  => '2',
		'unitPrice' => '20.00',
		'subtotal'  => '40.00',
	)
);
$two_line_cart->subtotal  = '50.00';
$two_line_cart->total     = '49.99';
$two_line_cart->fee_total = '-0.01';
$two_line_cart->fees      = array( br02_stub_fee( '-0.01' ) );
$two_priced               = br02_production_runtime_with_cart( $two_line_cart )->get_priced_cart();
br01_assert( is_array( $two_priced ), 'production runtime maps a two-line negative-fee cart' );
br01_assert_eq( 1, $two_priced['cartLevelDiscountMinor'], 'one-minor cart-level discount is preserved until allocation' );

$request_ab = array(
	array( 'lineId' => $line_a ),
	array( 'lineId' => $line_b ),
);
$request_ba = array(
	array( 'lineId' => $line_b ),
	array( 'lineId' => $line_a ),
);
$applied_ab = Cetech_Pos_Bridge_Cart_Discount::apply_to_priced_cart( $two_priced, $request_ab );
$swapped    = $two_priced;
$swapped['lines'] = array( $two_priced['lines'][1], $two_priced['lines'][0] );
$applied_ba = Cetech_Pos_Bridge_Cart_Discount::apply_to_priced_cart( $swapped, $request_ba );
br01_assert( is_array( $applied_ab ) && is_array( $applied_ba ), 'production two-line remainder applies in both cart orders' );
br01_assert_eq(
	$applied_ab['lines'][0]['cartLevelDiscountMinor'],
	$applied_ba['lines'][1]['cartLevelDiscountMinor'],
	'stable lineId tie-break does not follow Woo cart iteration order for line A'
);
br01_assert_eq(
	$applied_ab['lines'][1]['cartLevelDiscountMinor'],
	$applied_ba['lines'][0]['cartLevelDiscountMinor'],
	'stable lineId tie-break does not follow Woo cart iteration order for line B'
);
br01_assert_eq(
	1,
	(int) $applied_ab['lines'][0]['cartLevelDiscountMinor'] + (int) $applied_ab['lines'][1]['cartLevelDiscountMinor'],
	'production two-line allocated shares still sum to the cart-level discount'
);
$ab_disc_0 = Cetech_Pos_Bridge_Money::from_decimal_string( $applied_ab['lines'][0]['discount'], 'GHS' );
$ab_disc_1 = Cetech_Pos_Bridge_Money::from_decimal_string( $applied_ab['lines'][1]['discount'], 'GHS' );
$ab_cart   = Cetech_Pos_Bridge_Money::from_decimal_string( $applied_ab['discount'], 'GHS' );
br01_assert_eq( $ab_cart, $ab_disc_0 + $ab_disc_1, 'sum(line.discount) = quote.discount after production allocation' );
