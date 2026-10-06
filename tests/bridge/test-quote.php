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

$plugin_http = new Cetech_Pos_Bridge_Plugin( br01_authorized_env() );
$quote_http_request = new Cetech_Pos_Bridge_Test_Request(
	array( 'X-Correlation-ID' => $quote_correlation ),
	'/cetech-pos/v1/quotes'
);
$already = Cetech_Pos_Bridge_Response::failure(
	'VALIDATION_ERROR',
	'QuoteRequest is missing a required field.',
	$quote_correlation,
	array( 'field' => 'cartId' )
);
$rewrapped = $plugin_http->normalize_error_response( $already, null, $quote_http_request );
$rewrapped_payload = br01_payload( $rewrapped );
br01_assert_eq( 'VALIDATION_ERROR', $rewrapped_payload['error']['code'], 'rest_post_dispatch keeps bridge error code' );
br01_assert_eq( 'QuoteRequest is missing a required field.', $rewrapped_payload['error']['message'], 'rest_post_dispatch keeps bridge error message' );
br01_assert_eq( 'cartId', $rewrapped_payload['error']['details']['field'], 'rest_post_dispatch keeps field details' );
br01_assert_eq( $quote_correlation, $rewrapped_payload['correlationId'], 'rest_post_dispatch keeps correlation' );

$boom_http_runtime                     = br02_fake_runtime();
$boom_http_runtime->throw_on_calculate = true;
$boom_http                             = br02_dispatch_quote(
	$boom_http_runtime,
	br02_guest_request( $cart_id, $line_id_a, $location_id ),
	array( 'X-Correlation-ID' => $quote_correlation )
);
$boom_http_payload = br01_payload( $boom_http );
br01_assert_eq( 503, br01_status( $boom_http ), 'quote abort becomes HTTP 503 not an empty 500' );
br01_assert_eq( 'INTEGRATION_UNAVAILABLE', $boom_http_payload['error']['code'], 'quote abort uses INTEGRATION_UNAVAILABLE' );
br01_assert_eq( $quote_correlation, $boom_http_payload['correlationId'], 'quote abort keeps correlation' );

$session = new Cetech_Pos_Bridge_Ephemeral_Session();
$session->set_customer_id( 13 );
$session->set( 'cart', array( 'x' => 1 ) );
br01_assert_eq( 13, $session->get_customer_id(), 'ephemeral session stores customer id' );
br01_assert_eq( array( 'x' => 1 ), $session->get( 'cart' ), 'ephemeral session stores cart bag' );
br01_assert_eq( false, $session->set_customer_session_cookie( true ), 'ephemeral session does not set cookies' );
br01_assert_eq( null, $session->unknown_storefront_method(), 'ephemeral session swallows unknown handler methods' );

$already_served = $plugin_http->serve_namespace_json( true, $ok_quote, $quote_http_request, null );
br01_assert_eq( true, $already_served, 'serve_namespace_json respects an already-served request' );
$foreign_serve = $plugin_http->serve_namespace_json( false, $ok_quote, new Cetech_Pos_Bridge_Test_Request( array(), '/wp/v2/users' ), null );
br01_assert_eq( false, $foreign_serve, 'serve_namespace_json leaves non-bridge routes to WordPress' );
ob_start();
$served = $plugin_http->serve_namespace_json( false, $ok_quote, $quote_http_request, null );
$served_body = ob_get_clean();
br01_assert_eq( true, $served, 'serve_namespace_json claims the bridge JSON body' );
$served_json = json_decode( $served_body, true );
br01_assert( is_array( $served_json ) && ! empty( $served_json['ok'] ), 'serve_namespace_json echoes a JSON success envelope' );
br01_assert_eq( 1000, $served_json['data']['total']['minor'], 'served JSON keeps quote total' );

$br02t_uuid    = '550e8400-e29b-41d4-a716-446655440000';
$br02t_other   = '660e8400-e29b-41d4-a716-446655440001';
$br02t_secret  = 'sk_live_QUOTE_SECRET';
$br02t_boom    = 'SECRET_EXCEPTION_TOKEN';

class Br02_Quote_Timing_Gate extends Cetech_Pos_Bridge_Quote_Timing {
	public static $on       = false;
	public static $selected = '';

	public static function enabled() {
		return self::$on === true && self::is_valid_correlation( self::$selected );
	}

	public static function configured_correlation() {
		return is_string( self::$selected ) ? self::$selected : '';
	}
}

class Br02_Timing_Throwing_Gate extends Cetech_Pos_Bridge_Quote_Timing {
	public static function enabled() {
		throw new RuntimeException( 'gate SECRET_EXCEPTION_TOKEN' );
	}
}

class Br02_Timing_Counting extends Br02_Quote_Timing_Gate {
	public $begins = array();

	public function begin( $phase ) {
		$this->begins[] = $phase;
		parent::begin( $phase );
	}
}

class Br02_Timing_Runtime extends Cetech_Pos_Bridge_Fake_Woo_Runtime {
	public $trace         = array();
	public $restore_calls = 0;
	public $fail          = '';

	public function available() {
		if ( $this->fail === 'unavailable' ) {
			return false;
		}
		return parent::available();
	}

	public function snapshot() {
		$this->trace[] = 'snapshot';
		if ( $this->fail === 'snapshot' ) {
			throw new RuntimeException( 'snapshot SECRET_EXCEPTION_TOKEN' );
		}
		return parent::snapshot();
	}

	public function isolate_counter_sale_shipping() {
		$this->trace[] = 'isolate';
		parent::isolate_counter_sale_shipping();
	}

	public function install_customer_context( array $customer ) {
		$this->trace[] = 'install';
		return parent::install_customer_context( $customer );
	}

	public function reset_cart() {
		$this->trace[] = 'reset';
		if ( $this->fail === 'reset' ) {
			return Cetech_Pos_Bridge_Response::wp_error( 'INTEGRATION_UNAVAILABLE', 'reset failed', true, 'resolve', 503 );
		}
		return parent::reset_cart();
	}

	public function add_line( array $line ) {
		$this->trace[] = 'add';
		if ( $this->fail === 'add-error' ) {
			return Cetech_Pos_Bridge_Response::wp_error( 'VALIDATION_ERROR', 'add rejected', false, 'none', 400, array( 'field' => 'lines' ) );
		}
		if ( $this->fail === 'add-throw' ) {
			throw new RuntimeException( 'add SECRET_EXCEPTION_TOKEN' );
		}
		return parent::add_line( $line );
	}

	public function calculate_totals() {
		$this->trace[] = 'calculate';
		return parent::calculate_totals();
	}

	public function get_priced_cart() {
		$this->trace[] = 'priced';
		if ( $this->fail === 'map-error' ) {
			return Cetech_Pos_Bridge_Response::wp_error( 'INTEGRATION_UNAVAILABLE', 'map failed', true, 'resolve', 503 );
		}
		if ( $this->fail === 'map-throw' ) {
			throw new RuntimeException( 'map SECRET_EXCEPTION_TOKEN' );
		}
		$cart = parent::get_priced_cart();
		if ( $this->fail === 'normalize-bad' ) {
			$cart['lines'][0]['subtotal'] = 'not-money';
		}
		if ( $this->fail === 'normalize-throw' ) {
			$cart['lines'][0]['subtotal'] = new stdClass();
		}
		if ( $this->fail === 'short-cart' ) {
			$cart['lines'] = array();
		}
		return $cart;
	}

	public function side_effect_counts() {
		$this->trace[] = 'effects';
		$counts        = parent::side_effect_counts();
		if ( $this->fail === 'effects' ) {
			$counts['orders'] = 1;
		}
		return $counts;
	}

	public function restore( array $snapshot ) {
		$this->trace[] = 'restore';
		++$this->restore_calls;
		if ( $this->fail === 'restore' || $this->fail === 'both' ) {
			throw new RuntimeException( 'restore SECRET_EXCEPTION_TOKEN' );
		}
		parent::restore( $snapshot );
	}
}

class Br02_Timing_Extract_Request extends Cetech_Pos_Bridge_Test_Request {
	public function get_json_params() {
		throw new RuntimeException( 'extract SECRET_EXCEPTION_TOKEN' );
	}
}

function br02t_runtime() {
	$base              = br02_fake_runtime();
	$runtime           = new Br02_Timing_Runtime( $base->get_environment() );
	$runtime->bag_key  = 'cetech_pos_fake_wc_br02t_' . count( $GLOBALS );
	$runtime->customers = $base->customers;
	$runtime->catalog   = $base->catalog;
	$runtime->catalog['b2b:cust_b2b_1']['101']['1'] = array(
		'unitPrice'   => '9.00',
		'subtotal'    => '9.00',
		'discount'    => '0.00',
		'tax'         => '0.00',
		'stockStatus' => 'in_stock',
		'purchasable' => true,
	);
	$runtime->write_bag( '__idle__', array() );
	return $runtime;
}

function br02t_pair( Br02_Timing_Runtime $runtime ) {
	return new Cetech_Pos_Bridge_Quote_Engine( $runtime, new Cetech_Pos_Bridge_Quote_Store() );
}

function br02t_puts() {
	return isset( $GLOBALS['br02t_transient_puts'] ) ? (int) $GLOBALS['br02t_transient_puts'] : 0;
}

if ( ! function_exists( 'set_transient' ) ) {
	function set_transient( $key, $value, $expiration ) {
		unset( $key, $value, $expiration );
		$GLOBALS['br02t_transient_puts'] = br02t_puts() + 1;
		if ( ! empty( $GLOBALS['br02t_store_throw'] ) ) {
			throw new RuntimeException( 'store SECRET_EXCEPTION_TOKEN' );
		}
		return true;
	}
}

function br02t_request( array $body, $header ) {
	return new Cetech_Pos_Bridge_Test_Request(
		array( 'X-Correlation-ID' => $header ),
		'/cetech-pos/v1/quotes',
		$body
	);
}

function br02t_stable( array $quote ) {
	unset( $quote['id'], $quote['fingerprint'], $quote['calculatedAt'], $quote['expiresAt'] );
	return $quote;
}

function br02t_event( array $events, $label ) {
	br01_assert_eq( 1, count( $events ), $label . ' emits one event' );
	br01_assert( strlen( $events[0] ) <= 2048, $label . ' event is at most 2 KiB' );
	$decoded = json_decode( $events[0], true );
	br01_assert( is_array( $decoded ), $label . ' event is JSON' );
	$allowed = array(
		'event' => true, 'version' => true, 'correlationId' => true, 'outcome' => true,
		'controller_ms' => true, 'context_ms' => true, 'pricing_ms' => true, 'result_ms' => true, 'restore_ms' => true,
		'controller_query_delta' => true, 'context_query_delta' => true, 'pricing_query_delta' => true,
		'result_query_delta' => true, 'restore_query_delta' => true,
	);
	foreach ( $decoded as $key => $value ) {
		br01_assert( isset( $allowed[ $key ] ), $label . ' allowlists ' . $key );
	}
	br01_assert_eq( 'cetech_pos_quote_timing', $decoded['event'], $label . ' event name' );
	br01_assert_eq( 1, $decoded['version'], $label . ' event version' );
	return $decoded;
}

function br02t_phases( array $event, array $present, $label ) {
	foreach ( array( 'context_ms', 'pricing_ms', 'result_ms', 'restore_ms' ) as $key ) {
		if ( in_array( $key, $present, true ) ) {
			br01_assert( isset( $event[ $key ] ) && is_numeric( $event[ $key ] ) && $event[ $key ] >= 0, $label . ' has ' . $key );
		} else {
			br01_assert( ! array_key_exists( $key, $event ), $label . ' omits ' . $key );
		}
	}
}

function br02t_harness( $class = 'Br02_Quote_Timing_Gate' ) {
	$state                 = new stdClass();
	$state->factory        = 0;
	$state->clock          = 0;
	$state->counter        = 0;
	$state->events         = array();
	$state->queries        = 4;
	$state->counter_mode   = 'flat';
	$state->clock_mode     = 'step';
	$state->encoder        = null;
	$state->sink_mode      = 'keep';
	$state->factory_fn     = function () use ( $state, $class ) {
		++$state->factory;
		$clock = function () use ( $state ) {
			++$state->clock;
			if ( $state->clock_mode === 'throw' ) {
				throw new RuntimeException( 'clock SECRET_EXCEPTION_TOKEN' );
			}
			if ( $state->clock_mode === 'absent' ) {
				return null;
			}
			if ( $state->clock_mode === 'negative' ) {
				return -1;
			}
			return 1000000 * $state->clock;
		};
		$counter = function () use ( $state ) {
			++$state->counter;
			if ( $state->counter_mode === 'throw' ) {
				throw new RuntimeException( 'counter SECRET_EXCEPTION_TOKEN' );
			}
			if ( $state->counter_mode === 'invalid' ) {
				return 'bad';
			}
			if ( $state->counter_mode === 'decrease' ) {
				$value = $state->queries;
				--$state->queries;
				return $value;
			}
			return $state->queries;
		};
		$sink = function ( $json ) use ( $state ) {
			if ( $state->sink_mode === 'throw' ) {
				throw new RuntimeException( 'logger SECRET_EXCEPTION_TOKEN' );
			}
			$state->events[] = $json;
		};
		return new $class( $clock, $counter, $sink, $state->encoder );
	};
	return $state;
}

Br02_Quote_Timing_Gate::$on       = false;
Br02_Quote_Timing_Gate::$selected = '';
br01_assert_eq( false, Cetech_Pos_Bridge_Quote_Timing::enabled(), 'production timing gate is off when constants are absent' );

$br02t_off_state = br02t_harness();
$br02t_off_rt    = br02t_runtime();
$br02t_off_engine = br02t_pair( $br02t_off_rt );
$br02t_off = new Cetech_Pos_Bridge_Quote_Controller(
	new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
	new Cetech_Pos_Bridge_Correlation(),
	$br02t_off_engine,
	$br02t_off_state->factory_fn,
	'Cetech_Pos_Bridge_Quote_Timing'
);
$br02t_off_body = br02_guest_request( $cart_id, $line_id_a, $location_id );
$br02t_off_res  = $br02t_off->handle( br02t_request( $br02t_off_body, $br02t_uuid ) );
$br02t_off_pay  = br01_payload( $br02t_off_res );
br01_assert_eq( 200, br01_status( $br02t_off_res ), 'disabled gate still quotes' );
br01_assert_eq( 1000, $br02t_off_pay['data']['total']['minor'], 'disabled gate keeps guest total' );
br01_assert_eq( 0, $br02t_off_state->factory, 'disabled gate does not construct a recorder' );
br01_assert_eq( 0, $br02t_off_state->clock, 'disabled gate does not read a clock' );
br01_assert_eq( 0, $br02t_off_state->counter, 'disabled gate does not read a counter' );
br01_assert_eq( array(), $br02t_off_state->events, 'disabled gate emits no event' );
br01_assert_eq( 0, $br02t_off_rt->side_effect_counts()['orders'], 'disabled gate creates no order' );

Br02_Quote_Timing_Gate::$on       = false;
Br02_Quote_Timing_Gate::$selected = $br02t_uuid;
$br02t_false = br02t_harness();
$br02t_false_engine = br02t_pair( br02t_runtime() );
$br02t_false_ctl = new Cetech_Pos_Bridge_Quote_Controller(
	new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
	new Cetech_Pos_Bridge_Correlation(),
	$br02t_false_engine,
	$br02t_false->factory_fn,
	'Br02_Quote_Timing_Gate'
);
$br02t_false_ctl->handle( br02t_request( $br02t_off_body, $br02t_uuid ) );
br01_assert_eq( 0, $br02t_false->factory, 'false gate does not construct a recorder' );
br01_assert_eq( array(), $br02t_false->events, 'false gate emits no event' );

Br02_Quote_Timing_Gate::$on       = true;
Br02_Quote_Timing_Gate::$selected = 'not-a-uuid';
$br02t_badsel = br02t_harness();
$br02t_badsel_engine = br02t_pair( br02t_runtime() );
$br02t_badsel_ctl = new Cetech_Pos_Bridge_Quote_Controller(
	new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
	new Cetech_Pos_Bridge_Correlation(),
	$br02t_badsel_engine,
	$br02t_badsel->factory_fn,
	'Br02_Quote_Timing_Gate'
);
$br02t_badsel_ctl->handle( br02t_request( $br02t_off_body, $br02t_uuid ) );
br01_assert_eq( 0, $br02t_badsel->factory, 'invalid selection does no recorder work' );
br01_assert_eq( array(), $br02t_badsel->events, 'invalid selection emits no event' );

Br02_Quote_Timing_Gate::$on       = true;
Br02_Quote_Timing_Gate::$selected = $br02t_uuid;
$br02t_mismatch = br02t_harness();
$br02t_mismatch_engine = br02t_pair( br02t_runtime() );
$br02t_mismatch_ctl = new Cetech_Pos_Bridge_Quote_Controller(
	new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
	new Cetech_Pos_Bridge_Correlation(),
	$br02t_mismatch_engine,
	$br02t_mismatch->factory_fn,
	'Br02_Quote_Timing_Gate'
);
$br02t_mismatch_res = $br02t_mismatch_ctl->handle( br02t_request( $br02t_off_body, $br02t_other ) );
br01_assert_eq( 200, br01_status( $br02t_mismatch_res ), 'mismatched correlation still quotes' );
br01_assert_eq( 1000, br01_payload( $br02t_mismatch_res )['data']['total']['minor'], 'mismatched correlation keeps total' );
br01_assert( $br02t_mismatch->clock > 0, 'enabled mismatch may sample the clock' );
br01_assert_eq( array(), $br02t_mismatch->events, 'mismatched correlation emits no event' );
br01_assert( strpos( json_encode( $br02t_mismatch->events ), $br02t_other ) === false, 'mismatch does not log the request correlation' );

$br02t_badhdr = br02t_harness();
$br02t_badhdr_engine = br02t_pair( br02t_runtime() );
$br02t_badhdr_ctl = new Cetech_Pos_Bridge_Quote_Controller(
	new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
	new Cetech_Pos_Bridge_Correlation(),
	$br02t_badhdr_engine,
	$br02t_badhdr->factory_fn,
	'Br02_Quote_Timing_Gate'
);
$br02t_bad_header = 'raw-header-' . $br02t_secret;
$br02t_badhdr_res = $br02t_badhdr_ctl->handle( br02t_request( $br02t_off_body, $br02t_bad_header ) );
$br02t_badhdr_pay = br01_payload( $br02t_badhdr_res );
br01_assert_eq( 400, br01_status( $br02t_badhdr_res ), 'invalid correlation status unchanged' );
br01_assert_eq( 'VALIDATION_ERROR', $br02t_badhdr_pay['error']['code'], 'invalid correlation code unchanged' );
br01_assert_eq( array(), $br02t_badhdr->events, 'invalid correlation emits no event' );
br01_assert( strpos( json_encode( $br02t_badhdr->events ), $br02t_bad_header ) === false, 'invalid raw header is not logged' );

$br02t_denied_env             = new Cetech_Pos_Bridge_Test_Environment();
$br02t_denied_env->logged_in  = false;
$br02t_denied_env->capability = '';
$br02t_denied = br02t_harness();
$br02t_denied_engine = br02t_pair( br02t_runtime() );
$br02t_denied_ctl = new Cetech_Pos_Bridge_Quote_Controller(
	new Cetech_Pos_Bridge_Auth( $br02t_denied_env ),
	new Cetech_Pos_Bridge_Correlation(),
	$br02t_denied_engine,
	$br02t_denied->factory_fn,
	'Br02_Quote_Timing_Gate'
);
$br02t_denied_permission = $br02t_denied_ctl->permission_callback( br02t_request( $br02t_off_body, $br02t_uuid ) );
br01_assert( Cetech_Pos_Bridge_Quote_Request::is_error( $br02t_denied_permission ), 'permission denial still rejects' );
br01_assert_eq( 'AUTH_REQUIRED', $br02t_denied_permission->get_error_code(), 'permission denial code unchanged' );
br01_assert_eq( 0, $br02t_denied->factory, 'permission denial does no recorder work' );
br01_assert_eq( array(), $br02t_denied->events, 'permission denial emits no event' );

function br02t_success_case( $body, $minor, $label ) {
	global $br02t_uuid, $br02t_secret;
	Br02_Quote_Timing_Gate::$on       = true;
	Br02_Quote_Timing_Gate::$selected = $br02t_uuid;
	$timed_rt = br02t_runtime();
	$plain_rt = br02t_runtime();
	$timed_engine = br02t_pair( $timed_rt );
	$plain_engine = br02t_pair( $plain_rt );
	$state = br02t_harness();
	$controller = new Cetech_Pos_Bridge_Quote_Controller(
		new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
		new Cetech_Pos_Bridge_Correlation(),
		$timed_engine,
		$state->factory_fn,
		'Br02_Quote_Timing_Gate'
	);
	$puts_before = br02t_puts();
	$timed = $controller->handle( br02t_request( $body, $br02t_uuid ) );
	$puts_timed = br02t_puts();
	$plain = $plain_engine->quote( $body );
	$payload = br01_payload( $timed );
	br01_assert_eq( 200, br01_status( $timed ), $label . ' HTTP 200' );
	br01_assert_eq( $minor, $payload['data']['total']['minor'], $label . ' total' );
	br01_assert_eq( br02t_stable( $plain ), br02t_stable( $payload['data'] ), $label . ' stable commercial fields match' );
	br01_assert_eq( $plain_rt->trace, $timed_rt->trace, $label . ' call order matches' );
	br01_assert_eq( 1, $puts_timed - $puts_before, $label . ' stores once' );
	br01_assert_eq( 1, br02t_puts() - $puts_timed, $label . ' store count matches' );
	br01_assert_eq( 1, $timed_rt->restore_calls, $label . ' restores once' );
	br01_assert_eq( '__idle__', $timed_rt->bag()['customer'], $label . ' restores customer' );
	br01_assert_eq( array(), $timed_rt->bag()['cart'], $label . ' restores cart' );
	br01_assert_eq( 0, $timed_rt->side_effect_counts()['orders'], $label . ' orders stay zero' );
	br01_assert_eq( 0, $timed_rt->side_effect_counts()['stock'], $label . ' stock stays zero' );
	br01_assert_eq( 0, $timed_rt->side_effect_counts()['payments'], $label . ' payments stay zero' );
	$event = br02t_event( $state->events, $label );
	br01_assert_eq( 'success', $event['outcome'], $label . ' outcome success' );
	br01_assert_eq( $br02t_uuid, $event['correlationId'], $label . ' correlation' );
	br01_assert( isset( $event['controller_ms'] ) && is_numeric( $event['controller_ms'] ), $label . ' controller_ms' );
	br02t_phases( $event, array( 'context_ms', 'pricing_ms', 'result_ms', 'restore_ms' ), $label );
	br01_assert_eq( 0, $event['controller_query_delta'], $label . ' extra queries zero' );
	br01_assert( strpos( $state->events[0], $br02t_secret ) === false, $label . ' event has no secret' );
}

br02t_success_case( br02_guest_request( $cart_id, $line_id_a, $location_id ), 1000, 'simple quote' );
br02t_success_case(
	array(
		'cartId' => $cart_id, 'cartRevision' => 1, 'customer' => array( 'kind' => 'walkin' ), 'locationId' => $location_id,
		'lines' => array( array( 'lineId' => $line_id_b, 'productId' => '200', 'variationId' => '201', 'quantity' => '1' ) ),
	),
	1100,
	'variation quote'
);
br02t_success_case( br02_retail_request( $cart_id, $line_id_a, $location_id ), 800, 'retail quote' );
br02t_success_case(
	array(
		'cartId' => $cart_id, 'cartRevision' => 1,
		'customer' => array( 'kind' => 'b2b', 'customerId' => 'cust_b2b_1' ),
		'locationId' => $location_id,
		'lines' => array( array( 'lineId' => $line_id_a, 'productId' => '101', 'quantity' => '1' ) ),
	),
	900,
	'wholesale quote'
);

function br02t_controller_case( $label, $setup, $expect ) {
	global $br02t_uuid, $br02t_secret, $br02t_boom;
	Br02_Quote_Timing_Gate::$on       = true;
	Br02_Quote_Timing_Gate::$selected = $br02t_uuid;
	$runtime = br02t_runtime();
	if ( isset( $setup['fail'] ) ) {
		$runtime->fail = $setup['fail'];
	}
	if ( ! empty( $setup['throw_calculate'] ) ) {
		$runtime->throw_on_calculate = true;
	}
	if ( ! empty( $setup['contract'] ) ) {
		$runtime->catalog['walkin']['101']['1']['stockStatus'] = 'not-a-status';
	}
	$engine = br02t_pair( $runtime );
	$state = br02t_harness();
	$controller = new Cetech_Pos_Bridge_Quote_Controller(
		new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
		new Cetech_Pos_Bridge_Correlation(),
		$engine,
		$state->factory_fn,
		'Br02_Quote_Timing_Gate'
	);
	$body = isset( $setup['body'] ) ? $setup['body'] : br02_guest_request( $GLOBALS['cart_id'], $GLOBALS['line_id_a'], $GLOBALS['location_id'] );
	$control_rt = br02t_runtime();
	if ( isset( $setup['fail'] ) ) {
		$control_rt->fail = $setup['fail'];
	}
	if ( ! empty( $setup['throw_calculate'] ) ) {
		$control_rt->throw_on_calculate = true;
	}
	if ( ! empty( $setup['contract'] ) ) {
		$control_rt->catalog['walkin']['101']['1']['stockStatus'] = 'not-a-status';
	}
	$control_engine = br02t_pair( $control_rt );
	$control_controller = new Cetech_Pos_Bridge_Quote_Controller(
		new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
		new Cetech_Pos_Bridge_Correlation(),
		$control_engine
	);
	$request = br02t_request( $body, $br02t_uuid );
	if ( ! empty( $setup['store_throw'] ) ) {
		$GLOBALS['br02t_store_throw'] = true;
	}
	$puts_before = br02t_puts();
	$response = $controller->handle( $request );
	$puts_timed = br02t_puts();
	$control  = $control_controller->handle( $request );
	$puts_control = br02t_puts();
	$GLOBALS['br02t_store_throw'] = false;
	br01_assert_eq( br01_status( $control ), br01_status( $response ), $label . ' status matches control' );
	br01_assert_eq( $expect['status'], br01_status( $response ), $label . ' status' );
	br01_assert_eq( $expect['code'], br01_payload( $response )['error']['code'], $label . ' error code' );
	br01_assert_eq( br01_payload( $control )['error']['code'], br01_payload( $response )['error']['code'], $label . ' error code matches control' );
	br01_assert_eq( $control_rt->restore_calls, $runtime->restore_calls, $label . ' restore count' );
	br01_assert_eq( $puts_control - $puts_timed, $puts_timed - $puts_before, $label . ' store count' );
	br01_assert_eq( $control_rt->side_effect_counts(), $runtime->side_effect_counts(), $label . ' effect counts' );
	$event = br02t_event( $state->events, $label );
	br01_assert_eq( $expect['outcome'], $event['outcome'], $label . ' outcome' );
	br02t_phases( $event, $expect['phases'], $label );
	br01_assert( strpos( $state->events[0], $br02t_secret ) === false, $label . ' hides request secrets' );
	br01_assert( strpos( $state->events[0], $br02t_boom ) === false, $label . ' hides exception text' );
	return $runtime;
}

$br02t_guest = br02_guest_request( $cart_id, $line_id_a, $location_id );
$br02t_guest[ $br02t_secret ] = 'customer-password-secret';
br02t_controller_case(
	'parse error',
	array( 'body' => $br02t_guest ),
	array( 'status' => 400, 'code' => 'VALIDATION_ERROR', 'outcome' => 'typed_error', 'phases' => array() )
);
$br02t_unavailable = br02t_runtime();
$br02t_unavailable->fail = 'unavailable';
br02t_controller_case(
	'unavailable runtime',
	array( 'fail' => 'unavailable' ),
	array( 'status' => 503, 'code' => 'INTEGRATION_UNAVAILABLE', 'outcome' => 'typed_error', 'phases' => array() )
);
br02t_controller_case(
	'unknown customer',
	array( 'body' => br02_retail_request( $cart_id, $line_id_a, $location_id, 'missing_customer' ) ),
	array( 'status' => 404, 'code' => 'NOT_FOUND', 'outcome' => 'typed_error', 'phases' => array( 'context_ms', 'restore_ms' ) )
);
br02t_controller_case(
	'reset error',
	array( 'fail' => 'reset' ),
	array( 'status' => 503, 'code' => 'INTEGRATION_UNAVAILABLE', 'outcome' => 'typed_error', 'phases' => array( 'context_ms', 'restore_ms' ) )
);
br02t_controller_case(
	'add error',
	array( 'fail' => 'add-error' ),
	array( 'status' => 400, 'code' => 'VALIDATION_ERROR', 'outcome' => 'typed_error', 'phases' => array( 'context_ms', 'pricing_ms', 'restore_ms' ) )
);
br02t_controller_case(
	'add throw',
	array( 'fail' => 'add-throw' ),
	array( 'status' => 503, 'code' => 'INTEGRATION_UNAVAILABLE', 'outcome' => 'engine_aborted', 'phases' => array( 'context_ms', 'pricing_ms', 'restore_ms' ) )
);
br02t_controller_case(
	'calculate throw',
	array( 'throw_calculate' => true ),
	array( 'status' => 503, 'code' => 'INTEGRATION_UNAVAILABLE', 'outcome' => 'engine_aborted', 'phases' => array( 'context_ms', 'pricing_ms', 'restore_ms' ) )
);
br02t_controller_case(
	'map error',
	array( 'fail' => 'map-error' ),
	array( 'status' => 503, 'code' => 'INTEGRATION_UNAVAILABLE', 'outcome' => 'typed_error', 'phases' => array( 'context_ms', 'pricing_ms', 'result_ms', 'restore_ms' ) )
);
br02t_controller_case(
	'map throw',
	array( 'fail' => 'map-throw' ),
	array( 'status' => 503, 'code' => 'INTEGRATION_UNAVAILABLE', 'outcome' => 'engine_aborted', 'phases' => array( 'context_ms', 'pricing_ms', 'result_ms', 'restore_ms' ) )
);
br02t_controller_case(
	'normalize error',
	array( 'fail' => 'normalize-bad' ),
	array( 'status' => 503, 'code' => 'INTEGRATION_UNAVAILABLE', 'outcome' => 'typed_error', 'phases' => array( 'context_ms', 'pricing_ms', 'result_ms', 'restore_ms' ) )
);
br02t_controller_case(
	'normalize line-count error',
	array( 'fail' => 'short-cart' ),
	array( 'status' => 503, 'code' => 'INTEGRATION_UNAVAILABLE', 'outcome' => 'typed_error', 'phases' => array( 'context_ms', 'pricing_ms', 'result_ms', 'restore_ms' ) )
);
br02t_controller_case(
	'normalize throw',
	array( 'fail' => 'normalize-throw' ),
	array( 'status' => 503, 'code' => 'INTEGRATION_UNAVAILABLE', 'outcome' => 'engine_aborted', 'phases' => array( 'context_ms', 'pricing_ms', 'result_ms', 'restore_ms' ) )
);
br02t_controller_case(
	'side-effect guard',
	array( 'fail' => 'effects' ),
	array( 'status' => 503, 'code' => 'INTEGRATION_UNAVAILABLE', 'outcome' => 'typed_error', 'phases' => array( 'context_ms', 'pricing_ms', 'result_ms', 'restore_ms' ) )
);
br02t_controller_case(
	'contract error',
	array( 'contract' => true ),
	array( 'status' => 503, 'code' => 'INTEGRATION_UNAVAILABLE', 'outcome' => 'typed_error', 'phases' => array( 'context_ms', 'pricing_ms', 'result_ms', 'restore_ms' ) )
);
br02t_controller_case(
	'store throw',
	array( 'store_throw' => true ),
	array( 'status' => 503, 'code' => 'INTEGRATION_UNAVAILABLE', 'outcome' => 'engine_aborted', 'phases' => array( 'context_ms', 'pricing_ms', 'result_ms', 'restore_ms' ) )
);

$br02t_snap = br02t_controller_case(
	'snapshot throw',
	array( 'fail' => 'snapshot' ),
	array( 'status' => 503, 'code' => 'INTEGRATION_UNAVAILABLE', 'outcome' => 'engine_aborted', 'phases' => array( 'context_ms' ) )
);
br01_assert_eq( 0, $br02t_snap->restore_calls, 'snapshot throw does not restore' );

$br02t_direct_body = br02_guest_request( $cart_id, $line_id_a, $location_id );
$br02t_calc = br02t_runtime();
$br02t_calc->throw_on_calculate = true;
$br02t_calc->write_bag( '__idle__', array( 'sentinel' ) );
$br02t_calc_engine = br02t_pair( $br02t_calc );
$br02t_calc_msg = null;
try {
	$br02t_calc_engine->quote( $br02t_direct_body );
} catch ( RuntimeException $e ) {
	$br02t_calc_msg = $e->getMessage();
}
br01_assert_eq( 'forced calculate_totals failure', $br02t_calc_msg, 'calculate throw keeps its exception' );
br01_assert_eq( 1, $br02t_calc->restore_calls, 'calculate throw still restores' );
br01_assert_eq( array( 'sentinel' ), $br02t_calc->bag()['cart'], 'calculate throw restore preserves the prior cart' );

$br02t_restore = br02t_runtime();
$br02t_restore->fail = 'restore';
$br02t_restore->write_bag( '__idle__', array( 'sentinel' ) );
$br02t_restore_engine = br02t_pair( $br02t_restore );
$br02t_restore_msg = null;
$br02t_restore_puts = br02t_puts();
try {
	$br02t_restore_engine->quote( $br02t_direct_body );
} catch ( RuntimeException $e ) {
	$br02t_restore_msg = $e->getMessage();
}
br01_assert_eq( 'restore SECRET_EXCEPTION_TOKEN', $br02t_restore_msg, 'restore throw remains the escaping exception' );
br01_assert_eq( 1, $br02t_restore->restore_calls, 'restore throw was reached' );
br01_assert_eq( 1, br02t_puts() - $br02t_restore_puts, 'restore throw happens after the quote store write' );

$br02t_both = br02t_runtime();
$br02t_both->fail = 'both';
$br02t_both->throw_on_calculate = true;
$br02t_both_engine = br02t_pair( $br02t_both );
$br02t_both_msg = null;
$br02t_both_puts = br02t_puts();
try {
	$br02t_both_engine->quote( $br02t_direct_body );
} catch ( RuntimeException $e ) {
	$br02t_both_msg = $e->getMessage();
}
br01_assert_eq( 'restore SECRET_EXCEPTION_TOKEN', $br02t_both_msg, 'restore throw precedes the calculate throw' );
br01_assert_eq( 1, $br02t_both->restore_calls, 'both-throw path still restores once' );
br01_assert_eq( 0, br02t_puts() - $br02t_both_puts, 'both-throw path does not store' );

function br02t_controller_for( $engine, $factory = null ) {
	$args = array(
		new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
		new Cetech_Pos_Bridge_Correlation(),
		$engine,
	);
	if ( $factory !== null ) {
		$args[] = $factory;
		$args[] = 'Br02_Quote_Timing_Gate';
	}
	return new Cetech_Pos_Bridge_Quote_Controller( ...$args );
}

function br02t_catch_quote( $engine, array $body, $recorder = null ) {
	try {
		if ( $recorder === null ) {
			$engine->quote( $body );
		} else {
			$engine->quote( $body, $recorder );
		}
		return null;
	} catch ( Throwable $e ) {
		return $e;
	}
}

/**
 * Enabled recorder plus one throwing diagnostic dependency, compared with
 * the same commerce failure and no recorder.
 *
 * @param callable $configure_runtime
 * @param callable $configure_state
 */
function br02t_qualified_failure_pair( $label, $configure_runtime, $configure_state, $expect_puts, $expect_engine_message ) {
	global $br02t_uuid, $br02t_direct_body, $br02t_boom;
	Br02_Quote_Timing_Gate::$on       = true;
	Br02_Quote_Timing_Gate::$selected = $br02t_uuid;

	$timed_rt   = br02t_runtime();
	$control_rt = br02t_runtime();
	$configure_runtime( $timed_rt );
	$configure_runtime( $control_rt );
	$timed_engine   = br02t_pair( $timed_rt );
	$control_engine = br02t_pair( $control_rt );
	$state          = br02t_harness();
	$configure_state( $state );
	$recorder = call_user_func( $state->factory_fn );
	$recorder->begin_controller();
	br01_assert( $recorder->select( $br02t_uuid ), $label . ' recorder accepts the fixture correlation' );

	$timed_error   = br02t_catch_quote( $timed_engine, $br02t_direct_body, $recorder );
	$control_error = br02t_catch_quote( $control_engine, $br02t_direct_body );
	br01_assert( $timed_error instanceof Throwable, $label . ' timed engine still throws' );
	br01_assert( $control_error instanceof Throwable, $label . ' untimed engine still throws' );
	br01_assert_eq( get_class( $control_error ), get_class( $timed_error ), $label . ' exception class matches the untimed control' );
	br01_assert_eq( $control_error->getMessage(), $timed_error->getMessage(), $label . ' exception message matches the untimed control' );
	br01_assert_eq( $expect_engine_message, $timed_error->getMessage(), $label . ' keeps the original business exception' );
	$finish_error = null;
	try {
		$recorder->finish( 'engine_aborted' );
	} catch ( Throwable $e ) {
		$finish_error = $e;
	}
	br01_assert( $finish_error === null, $label . ' diagnostic finish does not replace the business exception' );

	$http_timed_rt   = br02t_runtime();
	$http_control_rt = br02t_runtime();
	$configure_runtime( $http_timed_rt );
	$configure_runtime( $http_control_rt );
	$http_state = br02t_harness();
	$configure_state( $http_state );
	$request = br02t_request( $br02t_direct_body, $br02t_uuid );
	$puts_before = br02t_puts();
	$timed_escaped = null;
	try {
		$timed_response = br02t_controller_for( br02t_pair( $http_timed_rt ), $http_state->factory_fn )->handle( $request );
	} catch ( Throwable $e ) {
		$timed_escaped  = $e;
		$timed_response = null;
	}
	$puts_timed = br02t_puts();
	$control_escaped = null;
	try {
		$control_response = br02t_controller_for( br02t_pair( $http_control_rt ) )->handle( $request );
	} catch ( Throwable $e ) {
		$control_escaped  = $e;
		$control_response = null;
	}
	$puts_control = br02t_puts();
	br01_assert( $timed_escaped === null, $label . ' timed controller does not let a diagnostic exception escape' );
	br01_assert( $control_escaped === null, $label . ' untimed controller mapping does not escape' );
	br01_assert_eq( 503, br01_status( $timed_response ), $label . ' controller maps the failure to HTTP 503' );
	br01_assert_eq( br01_status( $control_response ), br01_status( $timed_response ), $label . ' status matches the untimed control' );
	br01_assert_eq( br01_payload( $control_response )['error'], br01_payload( $timed_response )['error'], $label . ' mapped error matches the untimed control' );
	br01_assert_eq( 'INTEGRATION_UNAVAILABLE', br01_payload( $timed_response )['error']['code'], $label . ' mapped code' );
	br01_assert_eq( 1, $http_timed_rt->restore_calls, $label . ' restores once' );
	br01_assert_eq( $http_control_rt->restore_calls, $http_timed_rt->restore_calls, $label . ' restore count matches' );
	br01_assert_eq( $http_control_rt->trace, $http_timed_rt->trace, $label . ' call order matches' );
	br01_assert_eq( $expect_puts, $puts_timed - $puts_before, $label . ' store count' );
	br01_assert_eq( $expect_puts, $puts_control - $puts_timed, $label . ' untimed store count' );
	br01_assert_eq( 0, $http_timed_rt->side_effect_counts()['orders'], $label . ' orders stay zero' );
	br01_assert_eq( 0, $http_timed_rt->side_effect_counts()['stock'], $label . ' stock stays zero' );
	br01_assert_eq( 0, $http_timed_rt->side_effect_counts()['payments'], $label . ' payments stay zero' );
	br01_assert_eq( $http_control_rt->side_effect_counts(), $http_timed_rt->side_effect_counts(), $label . ' effect counts match' );
	$timed_body = json_encode( br01_payload( $timed_response ) );
	br01_assert( strpos( $timed_body, $br02t_boom ) === false, $label . ' response hides diagnostic and restore text' );
	foreach ( $http_state->events as $json ) {
		br01_assert( strpos( $json, $br02t_boom ) === false, $label . ' event hides diagnostic text' );
		br01_assert( strpos( $json, 'success' ) === false, $label . ' event does not claim success' );
	}
}

br02t_qualified_failure_pair(
	'enabled restore throw with throwing sink',
	function ( $runtime ) {
		$runtime->fail = 'restore';
	},
	function ( $state ) {
		$state->sink_mode = 'throw';
	},
	1,
	'restore SECRET_EXCEPTION_TOKEN'
);
br02t_qualified_failure_pair(
	'enabled both-throw with throwing clock',
	function ( $runtime ) {
		$runtime->fail                = 'both';
		$runtime->throw_on_calculate  = true;
	},
	function ( $state ) {
		$state->clock_mode = 'throw';
	},
	0,
	'restore SECRET_EXCEPTION_TOKEN'
);

Br02_Quote_Timing_Gate::$on       = true;
Br02_Quote_Timing_Gate::$selected = $br02t_uuid;
$br02t_encode_rt = br02t_runtime();
$br02t_encode_engine = br02t_pair( $br02t_encode_rt );
$br02t_encode_state = br02t_harness();
$br02t_encode = new Cetech_Pos_Bridge_Quote_Controller(
	new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
	new Cetech_Pos_Bridge_Correlation(),
	$br02t_encode_engine,
	$br02t_encode_state->factory_fn,
	'Br02_Quote_Timing_Gate',
	function () {
		return false;
	}
);
$br02t_encode_res = $br02t_encode->handle( br02t_request( $br02t_direct_body, $br02t_uuid ) );
$br02t_encode_pay = br01_payload( $br02t_encode_res );
br01_assert_eq( 503, br01_status( $br02t_encode_res ), 'late encoding failure stays HTTP 503' );
br01_assert_eq( 'INTEGRATION_UNAVAILABLE', $br02t_encode_pay['error']['code'], 'late encoding failure code' );
br01_assert_eq( false, $br02t_encode_pay['ok'], 'late encoding failure is not success' );
$br02t_encode_event = br02t_event( $br02t_encode_state->events, 'late encoding' );
br01_assert_eq( 'typed_error', $br02t_encode_event['outcome'], 'late encoding is not a successful outcome' );

$br02t_encode_throw_state = br02t_harness();
$br02t_encode_throw_engine = br02t_pair( br02t_runtime() );
$br02t_encode_throw = new Cetech_Pos_Bridge_Quote_Controller(
	new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
	new Cetech_Pos_Bridge_Correlation(),
	$br02t_encode_throw_engine,
	$br02t_encode_throw_state->factory_fn,
	'Br02_Quote_Timing_Gate',
	function () {
		throw new RuntimeException( 'encode SECRET_EXCEPTION_TOKEN' );
	}
);
$br02t_encode_escaped = null;
try {
	$br02t_encode_throw->handle( br02t_request( $br02t_direct_body, $br02t_uuid ) );
} catch ( RuntimeException $e ) {
	$br02t_encode_escaped = $e->getMessage();
}
br01_assert_eq( 'encode SECRET_EXCEPTION_TOKEN', $br02t_encode_escaped, 'encoding throw still escapes' );
$br02t_encode_throw_event = br02t_event( $br02t_encode_throw_state->events, 'encoding throw' );
br01_assert_eq( 'incomplete', $br02t_encode_throw_event['outcome'], 'encoding throw is not marked success' );
br01_assert( strpos( $br02t_encode_throw_state->events[0], $br02t_boom ) === false, 'encoding throw event hides the exception' );

$br02t_response_state = br02t_harness();
$br02t_response_engine = br02t_pair( br02t_runtime() );
$br02t_response = new Cetech_Pos_Bridge_Quote_Controller(
	new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
	new Cetech_Pos_Bridge_Correlation(),
	$br02t_response_engine,
	$br02t_response_state->factory_fn,
	'Br02_Quote_Timing_Gate',
	null,
	function () {
		throw new RuntimeException( 'response SECRET_EXCEPTION_TOKEN' );
	}
);
$br02t_response_escaped = null;
try {
	$br02t_response->handle( br02t_request( $br02t_direct_body, $br02t_uuid ) );
} catch ( RuntimeException $e ) {
	$br02t_response_escaped = $e->getMessage();
}
br01_assert_eq( 'response SECRET_EXCEPTION_TOKEN', $br02t_response_escaped, 'response construction throw still escapes' );
$br02t_response_event = br02t_event( $br02t_response_state->events, 'response construction' );
br01_assert_eq( 'incomplete', $br02t_response_event['outcome'], 'response construction failure is not success' );

$br02t_extract_state = br02t_harness();
$br02t_extract_engine = br02t_pair( br02t_runtime() );
$br02t_extract = new Cetech_Pos_Bridge_Quote_Controller(
	new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
	new Cetech_Pos_Bridge_Correlation(),
	$br02t_extract_engine,
	$br02t_extract_state->factory_fn,
	'Br02_Quote_Timing_Gate'
);
$br02t_extract_escaped = null;
$br02t_extract_puts = br02t_puts();
try {
	$br02t_extract->handle( new Br02_Timing_Extract_Request( array( 'X-Correlation-ID' => $br02t_uuid ), '/cetech-pos/v1/quotes', $br02t_direct_body ) );
} catch ( RuntimeException $e ) {
	$br02t_extract_escaped = $e->getMessage();
}
br01_assert_eq( 'extract SECRET_EXCEPTION_TOKEN', $br02t_extract_escaped, 'JSON extraction throw still escapes' );
br01_assert_eq( 0, br02t_puts() - $br02t_extract_puts, 'JSON extraction throw does not store' );
$br02t_extract_event = br02t_event( $br02t_extract_state->events, 'JSON extraction' );
br01_assert_eq( 'incomplete', $br02t_extract_event['outcome'], 'JSON extraction failure is not success' );
br02t_phases( $br02t_extract_event, array(), 'JSON extraction' );

function br02t_dependency_case( $label, $mutate ) {
	global $br02t_uuid, $br02t_direct_body, $br02t_boom;
	Br02_Quote_Timing_Gate::$on       = true;
	Br02_Quote_Timing_Gate::$selected = $br02t_uuid;
	$runtime = br02t_runtime();
	$engine = br02t_pair( $runtime );
	$control_rt = br02t_runtime();
	$control_engine = br02t_pair( $control_rt );
	$state = br02t_harness();
	$mutate( $state );
	$controller = new Cetech_Pos_Bridge_Quote_Controller(
		new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
		new Cetech_Pos_Bridge_Correlation(),
		$engine,
		$state->factory_fn,
		'Br02_Quote_Timing_Gate'
	);
	$escaped = null;
	$puts_before = br02t_puts();
	try {
		$response = $controller->handle( br02t_request( $br02t_direct_body, $br02t_uuid ) );
	} catch ( Throwable $e ) {
		$escaped = $e;
		$response = null;
	}
	$puts_timed = br02t_puts();
	$control = $control_engine->quote( $br02t_direct_body );
	br01_assert( $escaped === null, $label . ' diagnostic failure does not escape' );
	br01_assert_eq( 200, br01_status( $response ), $label . ' status' );
	br01_assert_eq( br02t_stable( $control ), br02t_stable( br01_payload( $response )['data'] ), $label . ' commercial result' );
	br01_assert_eq( 1, $runtime->restore_calls, $label . ' restore count' );
	br01_assert_eq( 1, $puts_timed - $puts_before, $label . ' store count' );
	br01_assert_eq( 1, br02t_puts() - $puts_timed, $label . ' control store count' );
	br01_assert_eq( 0, $runtime->side_effect_counts()['orders'], $label . ' orders' );
	foreach ( $state->events as $json ) {
		br01_assert( strpos( $json, $br02t_boom ) === false, $label . ' event hides diagnostic text' );
	}
	return $state;
}

br02t_dependency_case( 'throwing clock', function ( &$state ) { $state->clock_mode = 'throw'; } );
br02t_dependency_case( 'absent clock', function ( &$state ) { $state->clock_mode = 'absent'; } );
br02t_dependency_case( 'negative clock', function ( &$state ) { $state->clock_mode = 'negative'; } );
br02t_dependency_case( 'throwing counter', function ( &$state ) { $state->counter_mode = 'throw'; } );
br02t_dependency_case( 'invalid counter', function ( &$state ) { $state->counter_mode = 'invalid'; } );
$br02t_decrease = br02t_dependency_case( 'decreasing counter', function ( &$state ) { $state->counter_mode = 'decrease'; } );
$br02t_decrease_event = br02t_event( $br02t_decrease->events, 'decreasing counter' );
br01_assert( ! array_key_exists( 'controller_query_delta', $br02t_decrease_event ), 'decreasing counter omits the delta' );
br02t_dependency_case( 'throwing encoder', function ( &$state ) {
	$state->encoder = function () { throw new RuntimeException( 'encoder SECRET_EXCEPTION_TOKEN' ); };
} );
br02t_dependency_case( 'oversized encoder', function ( &$state ) {
	$state->encoder = function () { return str_repeat( 'A', 3000 ); };
} );
$br02t_extra = br02t_dependency_case( 'non-allowlisted encoder', function ( &$state ) {
	$state->encoder = function ( $payload ) {
		$payload['note'] = 'SECRET_EXCEPTION_TOKEN';
		return json_encode( $payload );
	};
} );
br01_assert_eq( array(), $br02t_extra->events, 'non-allowlisted telemetry is dropped' );
br02t_dependency_case( 'throwing logger', function ( &$state ) { $state->sink_mode = 'throw'; } );

$br02t_factory_state = array( 'called' => 0 );
Br02_Quote_Timing_Gate::$on = true;
Br02_Quote_Timing_Gate::$selected = $br02t_uuid;
$br02t_factory_engine = br02t_pair( br02t_runtime() );
$br02t_factory_ctl = new Cetech_Pos_Bridge_Quote_Controller(
	new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
	new Cetech_Pos_Bridge_Correlation(),
	$br02t_factory_engine,
	function () use ( &$br02t_factory_state ) {
		++$br02t_factory_state['called'];
		throw new RuntimeException( 'factory SECRET_EXCEPTION_TOKEN' );
	},
	'Br02_Quote_Timing_Gate'
);
$br02t_factory_puts = br02t_puts();
$br02t_factory_res = $br02t_factory_ctl->handle( br02t_request( $br02t_direct_body, $br02t_uuid ) );
br01_assert_eq( 200, br01_status( $br02t_factory_res ), 'throwing factory still quotes' );
br01_assert_eq( 1000, br01_payload( $br02t_factory_res )['data']['total']['minor'], 'throwing factory keeps the total' );
br01_assert_eq( 1, $br02t_factory_state['called'], 'throwing factory is contained at the controller' );
br01_assert_eq( 1, br02t_puts() - $br02t_factory_puts, 'throwing factory still stores once' );

$br02t_gate_engine = br02t_pair( br02t_runtime() );
$br02t_gate_calls = 0;
$br02t_gate_ctl = new Cetech_Pos_Bridge_Quote_Controller(
	new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
	new Cetech_Pos_Bridge_Correlation(),
	$br02t_gate_engine,
	function () use ( &$br02t_gate_calls ) {
		++$br02t_gate_calls;
		return new Cetech_Pos_Bridge_Quote_Timing();
	},
	'Br02_Timing_Throwing_Gate'
);
$br02t_gate_res = $br02t_gate_ctl->handle( br02t_request( $br02t_direct_body, $br02t_uuid ) );
br01_assert_eq( 200, br01_status( $br02t_gate_res ), 'throwing gate still quotes' );
br01_assert_eq( 0, $br02t_gate_calls, 'throwing gate does not construct a recorder' );

$br02t_nested_rt = br02t_runtime();
$br02t_nested_engine = br02t_pair( $br02t_nested_rt );
$br02t_nested_state = br02t_harness( 'Br02_Timing_Counting' );
$br02t_nested_recorder = null;
$br02t_nested_state->factory_fn = function () use ( &$br02t_nested_state, &$br02t_nested_recorder ) {
	++$br02t_nested_state->factory;
	$br02t_nested_recorder = new Br02_Timing_Counting(
		function () use ( &$br02t_nested_state ) {
			++$br02t_nested_state->clock;
			return 1000000 * $br02t_nested_state->clock;
		},
		function () use ( &$br02t_nested_state ) {
			++$br02t_nested_state->counter;
			return 4;
		},
		function ( $json ) use ( &$br02t_nested_state ) {
			$br02t_nested_state->events[] = $json;
		}
	);
	return $br02t_nested_recorder;
};
$br02t_nested_rt->during_calculate = function () use ( $br02t_nested_engine, $cart_id, $line_id_b, $location_id ) {
	$inner = $br02t_nested_engine->quote( br02_retail_request( $cart_id, $line_id_b, $location_id, 'cust_retail_2' ) );
	$GLOBALS['br02t_inner_total'] = is_array( $inner ) ? $inner['total']['minor'] : null;
};
$br02t_nested_ctl = new Cetech_Pos_Bridge_Quote_Controller(
	new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
	new Cetech_Pos_Bridge_Correlation(),
	$br02t_nested_engine,
	$br02t_nested_state->factory_fn,
	'Br02_Timing_Counting'
);
$br02t_nested_res = $br02t_nested_ctl->handle( br02t_request( br02_guest_request( $cart_id, $line_id_a, $location_id ), $br02t_uuid ) );
br01_assert_eq( 1000, br01_payload( $br02t_nested_res )['data']['total']['minor'], 'nested outer total' );
br01_assert_eq( 750, $GLOBALS['br02t_inner_total'], 'nested inner total' );
br01_assert_eq( '__idle__', $br02t_nested_rt->bag()['customer'], 'nested quotes restore customer' );
br01_assert_eq( array(), $br02t_nested_rt->bag()['cart'], 'nested quotes restore cart' );
br01_assert_eq( array( 'context', 'pricing', 'result', 'restore' ), $br02t_nested_recorder->begins, 'nested one-argument quote does not enter the outer recorder' );
$br02t_nested_event = br02t_event( $br02t_nested_state->events, 'nested quote' );
br01_assert_eq( 'success', $br02t_nested_event['outcome'], 'nested outer outcome' );
$br02t_prepare_again = $br02t_nested_engine->quote( br02_guest_request( $cart_id, $line_id_a, $location_id ) );
br01_assert_eq( 1000, $br02t_prepare_again['total']['minor'], 'prepare-style one-argument quote still prices' );
br01_assert_eq( 1, count( $br02t_nested_state->events ), 'prepare-style one-argument quote does not emit' );
br01_assert_eq( array( 'context', 'pricing', 'result', 'restore' ), $br02t_nested_recorder->begins, 'prepare-style call does not reuse the recorder' );
$br02t_quote_param = ( new ReflectionMethod( 'Cetech_Pos_Bridge_Quote_Engine', 'quote' ) )->getParameters();
br01_assert_eq( true, $br02t_quote_param[1]->isOptional(), 'quote timing argument stays optional' );
$br02t_prepare_src = file_get_contents( dirname( __DIR__, 2 ) . '/wordpress/cetech-pos-bridge/includes/class-prepare-engine.php' );
$br02t_prepare_at  = strpos( $br02t_prepare_src, '$this->quotes->quote(' );
$br02t_prepare_end = strpos( $br02t_prepare_src, ');', $br02t_prepare_at );
$br02t_prepare_call = substr( $br02t_prepare_src, $br02t_prepare_at, $br02t_prepare_end - $br02t_prepare_at );
br01_assert( strpos( $br02t_prepare_call, '$timing' ) === false, 'prepare quote call stays one-argument' );

$br02t_repeat_state = br02t_harness();
$br02t_repeat_recorder = null;
$br02t_repeat_state->factory_fn = function () use ( &$br02t_repeat_state, &$br02t_repeat_recorder ) {
	++$br02t_repeat_state->factory;
	$br02t_repeat_recorder = new Br02_Quote_Timing_Gate(
		function () use ( &$br02t_repeat_state ) {
			++$br02t_repeat_state->clock;
			return 1000000 * $br02t_repeat_state->clock;
		},
		function () { return 2; },
		function ( $json ) use ( &$br02t_repeat_state ) { $br02t_repeat_state->events[] = $json; }
	);
	return $br02t_repeat_recorder;
};
$br02t_repeat_engine = br02t_pair( br02t_runtime() );
$br02t_repeat_ctl = new Cetech_Pos_Bridge_Quote_Controller(
	new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
	new Cetech_Pos_Bridge_Correlation(),
	$br02t_repeat_engine,
	$br02t_repeat_state->factory_fn,
	'Br02_Quote_Timing_Gate'
);
$br02t_repeat_ctl->handle( br02t_request( $br02t_direct_body, $br02t_uuid ) );
$br02t_repeat_recorder->finish( 'success' );
$br02t_repeat_recorder->finish( 'typed_error' );
br01_assert_eq( 1, count( $br02t_repeat_state->events ), 'repeated finish emits one event' );
br01_assert_eq( 'success', br02t_event( $br02t_repeat_state->events, 'repeated finish' )['outcome'], 'repeated finish keeps the first outcome' );

$br02t_samples = 21;
$br02t_disabled_ns = array();
$br02t_enabled_ns  = array();
$br02t_overhead_events = array();
$br02t_overhead_factory = 0;
$br02t_overhead_rt = br02t_runtime();
$br02t_overhead_effects = $br02t_overhead_rt->side_effect_counts();
$br02t_overhead_off_engine = br02t_pair( $br02t_overhead_rt );
$br02t_overhead_off = new Cetech_Pos_Bridge_Quote_Controller(
	new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
	new Cetech_Pos_Bridge_Correlation(),
	$br02t_overhead_off_engine,
	function () use ( &$br02t_overhead_factory ) {
		++$br02t_overhead_factory;
		return new Cetech_Pos_Bridge_Quote_Timing();
	}
);
$br02t_overhead_on_rt = br02t_runtime();
$br02t_overhead_on_engine = br02t_pair( $br02t_overhead_on_rt );
Br02_Quote_Timing_Gate::$on = true;
Br02_Quote_Timing_Gate::$selected = $br02t_uuid;
$br02t_overhead_on = new Cetech_Pos_Bridge_Quote_Controller(
	new Cetech_Pos_Bridge_Auth( br01_authorized_env() ),
	new Cetech_Pos_Bridge_Correlation(),
	$br02t_overhead_on_engine,
	function () use ( &$br02t_overhead_events ) {
		return new Br02_Quote_Timing_Gate(
			null,
			function () { return 11; },
			function ( $json ) use ( &$br02t_overhead_events ) { $br02t_overhead_events[] = $json; }
		);
	},
	'Br02_Quote_Timing_Gate'
);
for ( $br02t_i = 0; $br02t_i < $br02t_samples; $br02t_i++ ) {
	$br02t_t0 = hrtime( true );
	$br02t_off_sample = $br02t_overhead_off->handle( br02t_request( $br02t_direct_body, $br02t_uuid ) );
	$br02t_disabled_ns[] = hrtime( true ) - $br02t_t0;
	$br02t_t1 = hrtime( true );
	$br02t_on_sample = $br02t_overhead_on->handle( br02t_request( $br02t_direct_body, $br02t_uuid ) );
	$br02t_enabled_ns[] = hrtime( true ) - $br02t_t1;
	br01_assert_eq( 1000, br01_payload( $br02t_off_sample )['data']['total']['minor'], 'overhead disabled total' );
	br01_assert_eq( 1000, br01_payload( $br02t_on_sample )['data']['total']['minor'], 'overhead enabled total' );
}
br01_assert_eq( 0, $br02t_overhead_factory, 'overhead disabled gate does no recorder work' );
br01_assert_eq( $br02t_samples, count( $br02t_overhead_events ), 'overhead enabled emits one event per sample' );
foreach ( $br02t_overhead_events as $br02t_overhead_json ) {
	$br02t_overhead_event = json_decode( $br02t_overhead_json, true );
	br01_assert_eq( 0, $br02t_overhead_event['controller_query_delta'], 'overhead extra query count is zero' );
}
br01_assert_eq( $br02t_overhead_effects, $br02t_overhead_rt->side_effect_counts(), 'overhead disabled commerce effects unchanged' );
br01_assert_eq( $br02t_overhead_effects, $br02t_overhead_on_rt->side_effect_counts(), 'overhead enabled commerce effects unchanged' );
$br02t_deltas = array();
for ( $br02t_i = 0; $br02t_i < $br02t_samples; $br02t_i++ ) {
	$br02t_deltas[] = (int) round( ( $br02t_enabled_ns[ $br02t_i ] - $br02t_disabled_ns[ $br02t_i ] ) / 1000 );
}
sort( $br02t_deltas );
$br02t_disabled_sorted = $br02t_disabled_ns;
$br02t_enabled_sorted  = $br02t_enabled_ns;
sort( $br02t_disabled_sorted );
sort( $br02t_enabled_sorted );
$br02t_mid = (int) floor( $br02t_samples / 2 );
echo 'QUOTE_TIMING_OVERHEAD samples=' . $br02t_samples
	. ' disabled_us_min=' . (int) round( $br02t_disabled_sorted[0] / 1000 )
	. ' disabled_us_p50=' . (int) round( $br02t_disabled_sorted[ $br02t_mid ] / 1000 )
	. ' disabled_us_max=' . (int) round( $br02t_disabled_sorted[ $br02t_samples - 1 ] / 1000 )
	. ' enabled_us_min=' . (int) round( $br02t_enabled_sorted[0] / 1000 )
	. ' enabled_us_p50=' . (int) round( $br02t_enabled_sorted[ $br02t_mid ] / 1000 )
	. ' enabled_us_max=' . (int) round( $br02t_enabled_sorted[ $br02t_samples - 1 ] / 1000 )
	. ' delta_us_min=' . $br02t_deltas[0]
	. ' delta_us_p50=' . $br02t_deltas[ $br02t_mid ]
	. ' delta_us_max=' . $br02t_deltas[ $br02t_samples - 1 ]
	. ' extra_queries=0'
	. PHP_EOL;
Br02_Quote_Timing_Gate::$on = false;
Br02_Quote_Timing_Gate::$selected = '';
