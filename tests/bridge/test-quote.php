<?php

$quote_correlation = '550e8400-e29b-41d4-a716-446655440000';
$cart_id           = '11111111-1111-4111-8111-111111111111';
$line_id_a         = '22222222-2222-4222-8222-222222222222';
$line_id_b         = '33333333-3333-4333-8333-333333333333';
$location_id       = 'loc-training-1';

function br02_guest_request( $cart_id, $line_id, $location_id, $qty = '1', $product = '101' ) {
	return array(
		'cartId'       => $cart_id,
		'cartRevision' => 1,
		'customer'     => array( 'kind' => 'walkin' ),
		'locationId'   => $location_id,
		'lines'        => array(
			array(
				'lineId'    => $line_id,
				'productId' => $product,
				'quantity'  => $qty,
			),
		),
	);
}

function br02_retail_request( $cart_id, $line_id, $location_id, $customer_id = 'cust_retail_1' ) {
	return array(
		'cartId'       => $cart_id,
		'cartRevision' => 1,
		'customer'     => array(
			'kind'       => 'retail',
			'customerId' => $customer_id,
		),
		'locationId'   => $location_id,
		'lines'        => array(
			array(
				'lineId'    => $line_id,
				'productId' => '101',
				'quantity'  => '1',
			),
		),
	);
}

function br02_fake_runtime() {
	$env              = br01_authorized_env();
	$runtime          = new Cetech_Pos_Bridge_Fake_Woo_Runtime( $env );
	$runtime->bag_key = 'cetech_pos_fake_wc_br02';
	$runtime->write_bag( '__idle__', array() );
	$runtime->customers['cust_retail_1'] = 'retail';
	$runtime->customers['cust_retail_2'] = 'retail';
	$runtime->customers['cust_b2b_1']    = 'b2b';
	$priced_guest                        = array(
		'unitPrice'   => '10.00',
		'subtotal'    => '10.00',
		'discount'    => '0.00',
		'tax'         => '0.00',
		'stockStatus' => 'in_stock',
		'purchasable' => true,
	);
	$priced_retail                       = array(
		'unitPrice'   => '8.00',
		'subtotal'    => '8.00',
		'discount'    => '0.00',
		'tax'         => '0.00',
		'stockStatus' => 'in_stock',
		'purchasable' => true,
	);
	$priced_retail_2                     = array(
		'unitPrice'   => '7.50',
		'subtotal'    => '7.50',
		'discount'    => '0.00',
		'tax'         => '0.00',
		'stockStatus' => 'in_stock',
		'purchasable' => true,
	);
	$runtime->catalog['walkin']['101']['1']               = $priced_guest;
	$runtime->catalog['retail:cust_retail_1']['101']['1'] = $priced_retail;
	$runtime->catalog['retail:cust_retail_2']['101']['1'] = $priced_retail_2;
	$runtime->catalog['walkin']['200:201']['1']           = array(
		'unitPrice'   => '12.00',
		'subtotal'    => '12.00',
		'discount'    => '1.00',
		'tax'         => '0.00',
		'stockStatus' => 'in_stock',
		'purchasable' => true,
	);
	return $runtime;
}

function br02_engine( Cetech_Pos_Bridge_Fake_Woo_Runtime $runtime ) {
	return new Cetech_Pos_Bridge_Quote_Engine( $runtime, new Cetech_Pos_Bridge_Quote_Store() );
}

function br02_dispatch_quote( Cetech_Pos_Bridge_Fake_Woo_Runtime $runtime, array $body, array $headers ) {
	$plugin = new Cetech_Pos_Bridge_Plugin( $runtime->get_environment(), $runtime );
	$plugin->register_routes();
	$controller = $plugin->get_quote_controller();
	$request    = new Cetech_Pos_Bridge_Test_Request( $headers, '/cetech-pos/v1/quotes', $body );
	$permission = $controller->permission_callback( $request );
	if ( $permission !== true ) {
		return $plugin->normalize_error_response( $permission, null, $request );
	}
	return $controller->handle( $request );
}

$runtime = br02_fake_runtime();
$engine  = br02_engine( $runtime );

$guest = $engine->quote( br02_guest_request( $cart_id, $line_id_a, $location_id ) );
br01_assert( is_array( $guest ), 'guest quote returns Quote array' );
br01_assert_eq( 1000, $guest['total']['minor'], 'guest context exact total minor units' );
br01_assert_eq( 1000, $guest['lines'][0]['unitPrice']['minor'], 'guest unit price from runtime' );
br01_assert_eq( 'walkin', $guest['customer']['kind'], 'guest customer echoed' );
br01_assert_eq( 'GHS', $guest['currency'], 'settlement currency GHS' );
br01_assert_eq( 64, strlen( $guest['fingerprint'] ), 'fingerprint sha256 hex length 64' );
br01_assert( preg_match( Cetech_Pos_Bridge_Constants::ID_PATTERN, $guest['id'] ) === 1, 'quote id is contract Id' );
br01_assert_eq( '__idle__', $runtime->bag()['customer'], 'guest quote restores idle customer context' );
br01_assert_eq( array(), $runtime->bag()['cart'], 'guest quote restores empty global cart' );
br01_assert_eq( 0, $runtime->side_effect_counts()['orders'], 'guest quote creates no order' );
br01_assert_eq( 0, $runtime->side_effect_counts()['stock'], 'guest quote mutates no stock' );
br01_assert_eq( 0, $runtime->side_effect_counts()['payments'], 'guest quote takes no payment' );
br01_assert_eq(
	$guest['total']['minor'],
	$guest['subtotal']['minor'] - $guest['discount']['minor'] + $guest['tax']['minor'],
	'guest total identity'
);

$retail = $engine->quote( br02_retail_request( $cart_id, $line_id_a, $location_id ) );
br01_assert( is_array( $retail ), 'retail quote returns Quote array' );
br01_assert_eq( 800, $retail['total']['minor'], 'retail context exact total minor units' );
br01_assert( $retail['total']['minor'] !== $guest['total']['minor'], 'guest and retail totals differ as runtime provided' );
br01_assert_eq( 'retail', $retail['customer']['kind'], 'retail customer kind echoed' );
br01_assert_eq( 'cust_retail_1', $retail['customer']['customerId'], 'retail customer id echoed' );
br01_assert_eq( '__idle__', $runtime->bag()['customer'], 'retail quote restores idle customer context' );

$guest_again = $engine->quote( br02_guest_request( $cart_id, $line_id_a, $location_id ) );
br01_assert_eq( $guest['total']['minor'], $guest_again['total']['minor'], 'repeated guest quote remains exact' );
br01_assert_eq( 0, $runtime->side_effect_counts()['orders'], 'repeated quote still creates no order' );

$effects_before = $runtime->side_effect_counts();
$engine->quote( br02_guest_request( $cart_id, $line_id_a, $location_id ) );
$engine->quote( br02_guest_request( $cart_id, $line_id_a, $location_id ) );
br01_assert_eq( $effects_before, $runtime->side_effect_counts(), 'repeated quotes have no commerce side effects' );

$nested_runtime = br02_fake_runtime();
$nested_engine  = br02_engine( $nested_runtime );
$nested_runtime->during_calculate = function () use ( $nested_engine, $cart_id, $line_id_b, $location_id ) {
	$inner = $nested_engine->quote( br02_retail_request( $cart_id, $line_id_b, $location_id, 'cust_retail_2' ) );
	$GLOBALS['cetech_pos_nested_quote_total'] = is_array( $inner ) ? $inner['total']['minor'] : null;
};
$outer = $nested_engine->quote( br02_guest_request( $cart_id, $line_id_a, $location_id ) );
br01_assert_eq( 1000, $outer['total']['minor'], 'outer guest quote isolated from nested retail quote' );
br01_assert_eq( 750, $GLOBALS['cetech_pos_nested_quote_total'], 'nested retail context exact' );
br01_assert_eq( '__idle__', $nested_runtime->bag()['customer'], 'nested quotes restore shared globals' );

$boom                     = br02_fake_runtime();
$boom->throw_on_calculate = true;
$boom->write_bag( '__idle__', array( 'sentinel' ) );
try {
	br02_engine( $boom )->quote( br02_guest_request( $cart_id, $line_id_a, $location_id ) );
	$threw = false;
} catch ( RuntimeException $e ) {
	$threw = true;
}
br01_assert( $threw, 'forced calculate exception is visible' );
br01_assert_eq( '__idle__', $boom->bag()['customer'], 'exception restores customer context' );
br01_assert_eq( array( 'sentinel' ), $boom->bag()['cart'], 'exception restores prior cart bag' );

$missing = $engine->quote( br02_retail_request( $cart_id, $line_id_a, $location_id, 'does-not-exist' ) );
br01_assert( Cetech_Pos_Bridge_Quote_Request::is_error( $missing ), 'unknown customer is an error' );
br01_assert_eq( 'NOT_FOUND', $missing->get_error_code(), 'unknown customer NOT_FOUND' );
br01_assert_eq( '__idle__', $runtime->bag()['customer'], 'unknown customer still restores context' );

$mismatch = $engine->quote(
	array(
		'cartId'       => $cart_id,
		'cartRevision' => 1,
		'customer'     => array(
			'kind'       => 'b2b',
			'customerId' => 'cust_retail_1',
		),
		'locationId'   => $location_id,
		'lines'        => array(
			array(
				'lineId'    => $line_id_a,
				'productId' => '101',
				'quantity'  => '1',
			),
		),
	)
);
br01_assert_eq( 'FORBIDDEN', $mismatch->get_error_code(), 'unauthorized customer kind switch denied' );

$variation_req = array(
	'cartId'       => $cart_id,
	'cartRevision' => 2,
	'customer'     => array( 'kind' => 'walkin' ),
	'locationId'   => $location_id,
	'lines'        => array(
		array(
			'lineId'      => $line_id_a,
			'productId'   => '200',
			'variationId' => '201',
			'quantity'    => '1',
		),
	),
);
$variation = $engine->quote( $variation_req );
br01_assert_eq( 1100, $variation['total']['minor'], 'variation line uses runtime totals including discount' );
br01_assert_eq( 100, $variation['discount']['minor'], 'variation discount from runtime' );
br01_assert_eq( '201', $variation['lines'][0]['variationId'], 'variationId preserved' );

$invalid = Cetech_Pos_Bridge_Quote_Request::parse(
	array(
		'cartId'       => $cart_id,
		'cartRevision' => 1,
		'customer'     => array( 'kind' => 'walkin' ),
		'locationId'   => $location_id,
		'lines'        => array(
			array(
				'lineId'    => $line_id_a,
				'productId' => '101',
				'quantity'  => '1',
			),
		),
		'extra'        => true,
	)
);
br01_assert_eq( 'VALIDATION_ERROR', $invalid->get_error_code(), 'unexpected QuoteRequest field rejected' );

$no_woo_env     = br01_authorized_env();
$no_woo_env->woo = false;
$no_woo_runtime = new Cetech_Pos_Bridge_Fake_Woo_Runtime( $no_woo_env );
$no_woo         = br02_engine( $no_woo_runtime )->quote( br02_guest_request( $cart_id, $line_id_a, $location_id ) );
br01_assert_eq( 'INTEGRATION_UNAVAILABLE', $no_woo->get_error_code(), 'quote without Woo is unavailable' );

$unauth_env              = new Cetech_Pos_Bridge_Test_Environment();
$unauth_runtime          = new Cetech_Pos_Bridge_Fake_Woo_Runtime( $unauth_env );
$unauth_runtime->bag_key = 'cetech_pos_fake_wc_unauth';
$unauth_quote            = br02_dispatch_quote(
	$unauth_runtime,
	br02_guest_request( $cart_id, $line_id_a, $location_id ),
	array( 'X-Correlation-ID' => $quote_correlation )
);
$unauth_payload = br01_payload( $unauth_quote );
br01_assert_eq( 401, br01_status( $unauth_quote ), 'unauthenticated quote HTTP 401' );
br01_assert_eq( 'AUTH_REQUIRED', $unauth_payload['error']['code'], 'unauthenticated quote AUTH_REQUIRED' );

$ok_quote   = br02_dispatch_quote(
	br02_fake_runtime(),
	br02_guest_request( $cart_id, $line_id_a, $location_id ),
	array( 'X-Correlation-ID' => $quote_correlation )
);
$ok_payload = br01_payload( $ok_quote );
br01_assert_eq( 200, br01_status( $ok_quote ), 'authorized quote HTTP 200' );
br01_assert_eq( true, $ok_payload['ok'], 'authorized quote ok=true' );
br01_assert_eq( $quote_correlation, $ok_payload['correlationId'], 'quote echoes correlation' );
br01_assert_eq( 1000, $ok_payload['data']['total']['minor'], 'REST quote guest total' );
br01_assert( isset( $ok_quote->headers['Cache-Control'] ) && $ok_quote->headers['Cache-Control'] === 'no-store', 'quote Cache-Control no-store' );

$closed_keys = array( 'ok', 'data', 'correlationId' );
br01_assert_eq( $closed_keys, array_keys( $ok_payload ), 'quote success envelope closed' );
$quote_keys  = array( 'id', 'cartId', 'cartRevision', 'customer', 'locationId', 'currency', 'lines', 'subtotal', 'discount', 'tax', 'total', 'calculatedAt', 'expiresAt', 'purchasable', 'fingerprint' );
br01_assert_eq( $quote_keys, array_keys( $ok_payload['data'] ), 'Quote object closed field set' );
