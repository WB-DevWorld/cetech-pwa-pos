<?php
/**
 * HARDEN-03 / issue #48 — canonical v1 QuoteRequest/Quote schema enforcement at the
 * Woo bridge boundary.
 *
 * These are local PHP assertions against an injected Woo runtime. They prove contract
 * enforcement and fail-closed behaviour. They are not live WordPress/Woo evidence and
 * they never set pricingParityVerified.
 */

require_once dirname( __DIR__, 2 ) . '/wordpress/cetech-pos-bridge/tools/derive-quote-contract.php';

$schema_cart_id  = '44444444-4444-4444-8444-444444444444';
$schema_line_id  = '55555555-5555-4555-8555-555555555555';
$schema_location = 'loc-training-1';
$schema_corr     = '660e8400-e29b-41d4-a716-446655440000';

/**
 * Records every Woo runtime entry point the pricing path uses.
 */
class Cetech_Pos_Bridge_Spy_Woo_Runtime extends Cetech_Pos_Bridge_Fake_Woo_Runtime {
	/** @var array<string,int> */
	public $calls = array(
		'available'                => 0,
		'snapshot'                 => 0,
		'install_customer_context' => 0,
		'reset_cart'               => 0,
		'add_line'                 => 0,
		'calculate_totals'         => 0,
		'get_priced_cart'          => 0,
	);

	/** @var string|null forces an invalid stockStatus into the mapped runtime line */
	public $force_stock_status = null;
	/** @var array<string,string>|null forces an out-of-contract problem code */
	public $force_problem = null;

	public function available() {
		++$this->calls['available'];
		return parent::available();
	}

	public function snapshot() {
		++$this->calls['snapshot'];
		return parent::snapshot();
	}

	public function install_customer_context( array $customer ) {
		++$this->calls['install_customer_context'];
		return parent::install_customer_context( $customer );
	}

	public function reset_cart() {
		++$this->calls['reset_cart'];
		return parent::reset_cart();
	}

	public function add_line( array $line ) {
		++$this->calls['add_line'];
		return parent::add_line( $line );
	}

	public function calculate_totals() {
		++$this->calls['calculate_totals'];
		return parent::calculate_totals();
	}

	public function get_priced_cart() {
		++$this->calls['get_priced_cart'];
		$priced = parent::get_priced_cart();
		if ( $this->force_stock_status !== null && isset( $priced['lines'][0] ) ) {
			$priced['lines'][0]['stockStatus'] = $this->force_stock_status;
		}
		if ( $this->force_problem !== null && isset( $priced['lines'][0] ) ) {
			$priced['lines'][0]['problems'] = array( $this->force_problem );
		}
		return $priced;
	}

	public function pricing_calls() {
		$total = 0;
		foreach ( $this->calls as $name => $count ) {
			if ( $name === 'available' ) {
				continue;
			}
			$total += $count;
		}
		return $total;
	}
}

function harden03_spy_runtime() {
	$env              = br01_authorized_env();
	$runtime          = new Cetech_Pos_Bridge_Spy_Woo_Runtime( $env );
	$runtime->bag_key = 'cetech_pos_fake_wc_harden03_' . bin2hex( random_bytes( 4 ) );
	$runtime->write_bag( '__idle__', array() );
	$runtime->customers['cust_retail_1'] = 'retail';
	$priced                              = array(
		'unitPrice'   => '10.00',
		'subtotal'    => '10.00',
		'discount'    => '0.00',
		'tax'         => '0.00',
		'stockStatus' => 'in_stock',
		'purchasable' => true,
	);
	$runtime->catalog['walkin']['101']['1']               = $priced;
	$runtime->catalog['retail:cust_retail_1']['101']['1'] = $priced;
	return $runtime;
}

function harden03_valid_request( $cart_id, $line_id, $location_id ) {
	return array(
		'cartId'       => $cart_id,
		'cartRevision' => 1,
		'customer'     => array( 'kind' => 'walkin' ),
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

/**
 * Applies one mutation to an otherwise valid QuoteRequest.
 *
 * @param callable $mutate
 */
function harden03_mutated_request( $cart_id, $line_id, $location_id, $mutate ) {
	$request = harden03_valid_request( $cart_id, $line_id, $location_id );
	$mutate( $request );
	return $request;
}

/* ---------------------------------------------------------------------------
 * 1. One contract source: the shipped artifact is a derivation of the canonical schema
 * ------------------------------------------------------------------------ */

$harden03_root     = dirname( __DIR__, 2 );
$harden03_derived  = Cetech_Pos_Bridge_Contract_Derivation::derive( $harden03_root );
$harden03_artifact = json_decode( (string) file_get_contents( Cetech_Pos_Bridge_Schema::artifact_path() ), true );

br01_assert( is_array( $harden03_artifact ), 'shipped quote-contract artifact decodes' );
br01_assert_eq( $harden03_derived, $harden03_artifact, 'shipped artifact equals a fresh derivation of the canonical schema' );
br01_assert_eq( $harden03_derived, Cetech_Pos_Bridge_Contract_Derivation::derive( $harden03_root ), 'derivation is deterministic across runs' );
br01_assert_eq( array( 'Quote', 'QuoteRequest' ), $harden03_artifact['roots'], 'artifact declares the enforced roots' );
br01_assert_eq( 'docs/contracts/pos-domain.schema.json', $harden03_artifact['schemaSource'], 'artifact records the canonical source path' );

$harden03_canonical = json_decode( (string) file_get_contents( $harden03_root . '/docs/contracts/pos-domain.schema.json' ), true );
foreach ( array( 'QuoteRequest', 'Quote', 'QuoteLine', 'Money', 'CustomerContext', 'Quantity', 'StockStatus', 'QuoteProblem' ) as $harden03_def ) {
	br01_assert_eq(
		$harden03_canonical['$defs'][ $harden03_def ],
		$harden03_artifact['$defs'][ $harden03_def ],
		'artifact $defs/' . $harden03_def . ' is byte-identical to the canonical definition'
	);
}
br01_assert( ! isset( $harden03_artifact['$defs']['PrepareSaleRequest'] ), 'artifact carries no R5 prepare-sale contract' );

$harden03_schema = Cetech_Pos_Bridge_Schema::instance();
br01_assert( $harden03_schema->has_definition( 'QuoteRequest' ), 'runtime schema exposes QuoteRequest' );
br01_assert( $harden03_schema->has_definition( 'Quote' ), 'runtime schema exposes Quote' );

/* ---------------------------------------------------------------------------
 * 2. Ingress: contract-invalid QuoteRequest payloads are rejected
 * ------------------------------------------------------------------------ */

$harden03_invalid_requests = array(
	'missing required top-level field'          => function ( &$r ) {
		unset( $r['cartId'] );
	},
	'missing required lines field'              => function ( &$r ) {
		unset( $r['lines'] );
	},
	'unexpected top-level field'                => function ( &$r ) {
		$r['rush'] = true;
	},
	'cartId not a UUID'                         => function ( &$r ) {
		$r['cartId'] = 'cart-1';
	},
	'cartId wrong type'                         => function ( &$r ) {
		$r['cartId'] = 12345;
	},
	'cartRevision negative'                     => function ( &$r ) {
		$r['cartRevision'] = -1;
	},
	'cartRevision as string'                    => function ( &$r ) {
		$r['cartRevision'] = '1';
	},
	'cartRevision as float'                     => function ( &$r ) {
		$r['cartRevision'] = 1.5;
	},
	'customer not an object'                    => function ( &$r ) {
		$r['customer'] = 'walkin';
	},
	'customer kind not a contract value'        => function ( &$r ) {
		$r['customer'] = array( 'kind' => 'wholesale', 'customerId' => 'cust_retail_1' );
	},
	'retail customer missing customerId'        => function ( &$r ) {
		$r['customer'] = array( 'kind' => 'retail' );
	},
	'walkin customer with customerId'           => function ( &$r ) {
		$r['customer'] = array( 'kind' => 'walkin', 'customerId' => 'cust_retail_1' );
	},
	'customer with unexpected field'            => function ( &$r ) {
		$r['customer'] = array( 'kind' => 'retail', 'customerId' => 'cust_retail_1', 'tier' => 'gold' );
	},
	'customerId with a forbidden character'     => function ( &$r ) {
		$r['customer'] = array( 'kind' => 'retail', 'customerId' => 'cust retail 1' );
	},
	'locationId empty'                          => function ( &$r ) {
		$r['locationId'] = '';
	},
	'locationId wrong type'                     => function ( &$r ) {
		$r['locationId'] = 7;
	},
	'lines empty'                               => function ( &$r ) {
		$r['lines'] = array();
	},
	'lines not an array'                        => function ( &$r ) {
		$r['lines'] = array( 'lineId' => 'x' );
	},
	'line not an object'                        => function ( &$r ) {
		$r['lines'] = array( 'not-a-line' );
	},
	'line missing lineId'                       => function ( &$r ) {
		unset( $r['lines'][0]['lineId'] );
	},
	'line missing productId'                    => function ( &$r ) {
		unset( $r['lines'][0]['productId'] );
	},
	'line missing quantity'                     => function ( &$r ) {
		unset( $r['lines'][0]['quantity'] );
	},
	'line with unexpected field'                => function ( &$r ) {
		$r['lines'][0]['note'] = 'gift wrap';
	},
	'lineId not a UUID'                         => function ( &$r ) {
		$r['lines'][0]['lineId'] = 'line-1';
	},
	'productId with a forbidden character'      => function ( &$r ) {
		$r['lines'][0]['productId'] = '10 1';
	},
	'productId empty'                           => function ( &$r ) {
		$r['lines'][0]['productId'] = '';
	},
	'variationId with a forbidden character'    => function ( &$r ) {
		$r['lines'][0]['variationId'] = '#201';
	},
	'variationId wrong type'                    => function ( &$r ) {
		$r['lines'][0]['variationId'] = 201;
	},
	'quantity zero'                             => function ( &$r ) {
		$r['lines'][0]['quantity'] = '0';
	},
	'quantity zero with decimals'               => function ( &$r ) {
		$r['lines'][0]['quantity'] = '0.00';
	},
	'quantity negative'                         => function ( &$r ) {
		$r['lines'][0]['quantity'] = '-1';
	},
	'quantity with too many fractional digits'  => function ( &$r ) {
		$r['lines'][0]['quantity'] = '1.1234567';
	},
	'quantity with a trailing zero'             => function ( &$r ) {
		$r['lines'][0]['quantity'] = '1.10';
	},
	'quantity not numeric'                      => function ( &$r ) {
		$r['lines'][0]['quantity'] = 'two';
	},
	'quantity as a number rather than a string' => function ( &$r ) {
		$r['lines'][0]['quantity'] = 1;
	},
	'quantity with leading zero'                => function ( &$r ) {
		$r['lines'][0]['quantity'] = '01';
	},
);

foreach ( $harden03_invalid_requests as $harden03_label => $harden03_mutation ) {
	$harden03_runtime = harden03_spy_runtime();
	$harden03_engine  = new Cetech_Pos_Bridge_Quote_Engine( $harden03_runtime, new Cetech_Pos_Bridge_Quote_Store() );
	$harden03_result  = $harden03_engine->quote(
		harden03_mutated_request( $schema_cart_id, $schema_line_id, $schema_location, $harden03_mutation )
	);
	br01_assert(
		Cetech_Pos_Bridge_Quote_Request::is_error( $harden03_result ),
		'ingress rejects: ' . $harden03_label
	);
	br01_assert_eq(
		'VALIDATION_ERROR',
		$harden03_result->get_error_code(),
		'ingress rejection uses VALIDATION_ERROR: ' . $harden03_label
	);
	br01_assert_eq(
		0,
		$harden03_runtime->pricing_calls(),
		'no Woo pricing entry point runs for: ' . $harden03_label
	);
}

/* ---------------------------------------------------------------------------
 * 3. Invalid ingress never reaches the pricing path; valid ingress does
 * ------------------------------------------------------------------------ */

$harden03_blocked = harden03_spy_runtime();
$harden03_blocked_engine = new Cetech_Pos_Bridge_Quote_Engine( $harden03_blocked, new Cetech_Pos_Bridge_Quote_Store() );
$harden03_blocked_result = $harden03_blocked_engine->quote(
	harden03_mutated_request(
		$schema_cart_id,
		$schema_line_id,
		$schema_location,
		function ( &$r ) {
			$r['lines'][0]['quantity'] = '0';
		}
	)
);
br01_assert( Cetech_Pos_Bridge_Quote_Request::is_error( $harden03_blocked_result ), 'schema-invalid quantity is rejected' );
br01_assert_eq( 0, $harden03_blocked->calls['snapshot'], 'invalid ingress does not snapshot the Woo runtime' );
br01_assert_eq( 0, $harden03_blocked->calls['install_customer_context'], 'invalid ingress does not install a customer context' );
br01_assert_eq( 0, $harden03_blocked->calls['reset_cart'], 'invalid ingress does not touch the Woo cart' );
br01_assert_eq( 0, $harden03_blocked->calls['add_line'], 'invalid ingress adds no Woo cart line' );
br01_assert_eq( 0, $harden03_blocked->calls['calculate_totals'], 'invalid ingress never runs Woo/WoodMart/B2BKing pricing' );
br01_assert_eq( 0, $harden03_blocked->calls['get_priced_cart'], 'invalid ingress reads no priced cart' );
br01_assert_eq( 0, $harden03_blocked->calls['available'], 'invalid ingress short-circuits before the runtime probe' );
br01_assert_eq( 0, $harden03_blocked->side_effect_counts()['orders'], 'invalid ingress creates no order' );
br01_assert_eq( 0, $harden03_blocked->side_effect_counts()['stock'], 'invalid ingress mutates no stock' );

$harden03_allowed = harden03_spy_runtime();
$harden03_allowed_engine = new Cetech_Pos_Bridge_Quote_Engine( $harden03_allowed, new Cetech_Pos_Bridge_Quote_Store() );
$harden03_allowed_result = $harden03_allowed_engine->quote(
	harden03_valid_request( $schema_cart_id, $schema_line_id, $schema_location )
);
br01_assert( is_array( $harden03_allowed_result ), 'valid ingress still produces a Quote' );
br01_assert( $harden03_allowed->calls['calculate_totals'] > 0, 'valid ingress does reach Woo pricing' );
br01_assert( $harden03_allowed->calls['get_priced_cart'] > 0, 'valid ingress does read the priced cart' );

/* ---------------------------------------------------------------------------
 * 4. Valid round trip satisfies the canonical Quote schema
 * ------------------------------------------------------------------------ */

br01_assert_eq( null, $harden03_schema->validate( $harden03_allowed_result, 'Quote' ), 'produced Quote satisfies the canonical v1 Quote schema' );
br01_assert_eq( 1000, $harden03_allowed_result['total']['minor'], 'round-trip total unchanged by schema hardening' );
br01_assert_eq( 'GHS', $harden03_allowed_result['currency'], 'round-trip currency unchanged' );
br01_assert_eq( 0, $harden03_allowed->side_effect_counts()['orders'], 'valid round trip creates no order' );
br01_assert_eq( 0, $harden03_allowed->side_effect_counts()['stock'], 'valid round trip mutates no stock' );

$harden03_http = br02_dispatch_quote(
	harden03_spy_runtime(),
	harden03_valid_request( $schema_cart_id, $schema_line_id, $schema_location ),
	array( 'X-Correlation-ID' => $schema_corr )
);
$harden03_http_payload = br01_payload( $harden03_http );
br01_assert_eq( 200, br01_status( $harden03_http ), 'valid quote still returns HTTP 200 over REST' );
br01_assert_eq( true, $harden03_http_payload['ok'], 'valid quote still returns ok=true' );
br01_assert_eq( null, $harden03_schema->validate( $harden03_http_payload['data'], 'Quote' ), 'REST success body satisfies the canonical Quote schema' );

$harden03_retail = harden03_spy_runtime();
$harden03_retail_quote = ( new Cetech_Pos_Bridge_Quote_Engine( $harden03_retail, new Cetech_Pos_Bridge_Quote_Store() ) )->quote(
	array(
		'cartId'       => $schema_cart_id,
		'cartRevision' => 0,
		'customer'     => array( 'kind' => 'retail', 'customerId' => 'cust_retail_1' ),
		'locationId'   => $schema_location,
		'lines'        => array(
			array(
				'lineId'    => $schema_line_id,
				'productId' => '101',
				'quantity'  => '1',
			),
		),
	)
);
br01_assert( is_array( $harden03_retail_quote ), 'registered retail round trip still produces a Quote' );
br01_assert_eq( null, $harden03_schema->validate( $harden03_retail_quote, 'Quote' ), 'retail Quote satisfies the canonical schema' );

/* ---------------------------------------------------------------------------
 * 5. Egress: a contract-invalid Quote cannot leave the bridge as a success
 * ------------------------------------------------------------------------ */

$harden03_bad_stock = harden03_spy_runtime();
$harden03_bad_stock->force_stock_status = 'onbackorder';
$harden03_bad_stock_result = ( new Cetech_Pos_Bridge_Quote_Engine( $harden03_bad_stock, new Cetech_Pos_Bridge_Quote_Store() ) )->quote(
	harden03_valid_request( $schema_cart_id, $schema_line_id, $schema_location )
);
br01_assert( Cetech_Pos_Bridge_Quote_Request::is_error( $harden03_bad_stock_result ), 'out-of-contract stockStatus fails closed' );
br01_assert_eq( 'INTEGRATION_UNAVAILABLE', $harden03_bad_stock_result->get_error_code(), 'egress failure uses INTEGRATION_UNAVAILABLE' );
br01_assert( $harden03_bad_stock->calls['get_priced_cart'] > 0, 'egress failure happens after pricing, not before' );

$harden03_bad_problem = harden03_spy_runtime();
$harden03_bad_problem->force_problem = array( 'code' => 'MADE_UP_CODE', 'message' => 'not a contract problem code' );
$harden03_bad_problem_result = ( new Cetech_Pos_Bridge_Quote_Engine( $harden03_bad_problem, new Cetech_Pos_Bridge_Quote_Store() ) )->quote(
	harden03_valid_request( $schema_cart_id, $schema_line_id, $schema_location )
);
br01_assert( Cetech_Pos_Bridge_Quote_Request::is_error( $harden03_bad_problem_result ), 'out-of-contract QuoteProblem code fails closed' );
br01_assert_eq( 'INTEGRATION_UNAVAILABLE', $harden03_bad_problem_result->get_error_code(), 'invalid problem code is not emitted as success' );

$harden03_bad_http = br02_dispatch_quote(
	( function () {
		$runtime                      = harden03_spy_runtime();
		$runtime->force_stock_status  = 'onbackorder';
		return $runtime;
	} )(),
	harden03_valid_request( $schema_cart_id, $schema_line_id, $schema_location ),
	array( 'X-Correlation-ID' => $schema_corr )
);
$harden03_bad_http_payload = br01_payload( $harden03_bad_http );
br01_assert_eq( 503, br01_status( $harden03_bad_http ), 'contract-invalid Quote becomes HTTP 503 over REST' );
br01_assert_eq( false, $harden03_bad_http_payload['ok'], 'contract-invalid Quote never leaves as ok=true' );
br01_assert( ! isset( $harden03_bad_http_payload['data'] ), 'contract-invalid Quote body carries no data payload' );
br01_assert_eq( 'INTEGRATION_UNAVAILABLE', $harden03_bad_http_payload['error']['code'], 'REST egress failure keeps the canonical error code' );
br01_assert_eq( true, $harden03_bad_http_payload['error']['retryable'], 'egress failure retryable matches error-policy.json' );
br01_assert_eq( 'resolve', $harden03_bad_http_payload['error']['nextAction'], 'egress failure nextAction matches error-policy.json' );
br01_assert_eq( $schema_corr, $harden03_bad_http_payload['correlationId'], 'egress failure keeps the correlation id' );
br01_assert_eq( array( 'code', 'message', 'retryable', 'nextAction', 'details' ), array_keys( $harden03_bad_http_payload['error'] ), 'egress failure uses the frozen ApiFailure envelope' );
br01_assert_eq( array( 'field' ), array_keys( $harden03_bad_http_payload['error']['details'] ), 'egress failure details expose only the allowed field key' );

/* ---------------------------------------------------------------------------
 * 6. Direct Quote-schema negatives, driven from a known-valid Quote
 * ------------------------------------------------------------------------ */

$harden03_good_quote = $harden03_allowed_result;
br01_assert_eq( null, $harden03_schema->validate( $harden03_good_quote, 'Quote' ), 'baseline Quote for egress negatives is valid' );

$harden03_invalid_quotes = array(
	'missing required Quote field'      => function ( &$q ) {
		unset( $q['total'] );
	},
	'missing fingerprint'               => function ( &$q ) {
		unset( $q['fingerprint'] );
	},
	'fingerprint too short'             => function ( &$q ) {
		$q['fingerprint'] = 'abc';
	},
	'unexpected Quote field'            => function ( &$q ) {
		$q['margin'] = '3.00';
	},
	'invalid currency'                  => function ( &$q ) {
		$q['currency'] = 'ghs';
	},
	'currency wrong length'             => function ( &$q ) {
		$q['currency'] = 'GHSX';
	},
	'invalid Money shape'               => function ( &$q ) {
		$q['total'] = array( 'amount' => 1000, 'currency' => 'GHS' );
	},
	'Money minor as a string'           => function ( &$q ) {
		$q['total'] = array( 'minor' => '1000', 'currency' => 'GHS' );
	},
	'Money minor negative'              => function ( &$q ) {
		$q['discount'] = array( 'minor' => -100, 'currency' => 'GHS' );
	},
	'Money with an unexpected field'    => function ( &$q ) {
		$q['tax'] = array( 'minor' => 0, 'currency' => 'GHS', 'rate' => '0.15' );
	},
	'invalid discount field shape'      => function ( &$q ) {
		$q['discount'] = '0.00';
	},
	'lines emptied'                     => function ( &$q ) {
		$q['lines'] = array();
	},
	'lines replaced by an object'       => function ( &$q ) {
		$q['lines'] = array( 'lineId' => 'x' );
	},
	'malformed QuoteLine'               => function ( &$q ) {
		unset( $q['lines'][0]['unitPrice'] );
	},
	'QuoteLine missing problems'        => function ( &$q ) {
		unset( $q['lines'][0]['problems'] );
	},
	'QuoteLine unexpected field'        => function ( &$q ) {
		$q['lines'][0]['costPrice'] = array( 'minor' => 1, 'currency' => 'GHS' );
	},
	'QuoteLine invalid quantity'        => function ( &$q ) {
		$q['lines'][0]['quantity'] = '0';
	},
	'QuoteLine quantity as a number'    => function ( &$q ) {
		$q['lines'][0]['quantity'] = 1;
	},
	'QuoteLine invalid stockStatus'     => function ( &$q ) {
		$q['lines'][0]['stockStatus'] = 'onbackorder';
	},
	'QuoteLine purchasable as a string' => function ( &$q ) {
		$q['lines'][0]['purchasable'] = 'true';
	},
	'QuoteLine invalid Money nesting'   => function ( &$q ) {
		$q['lines'][0]['subtotal'] = array( 'minor' => array( 'value' => 1000 ), 'currency' => 'GHS' );
	},
	'QuoteProblem invalid code'         => function ( &$q ) {
		$q['lines'][0]['problems'] = array( array( 'code' => 'NOPE', 'message' => 'x' ) );
	},
	'QuoteProblem missing message'      => function ( &$q ) {
		$q['lines'][0]['problems'] = array( array( 'code' => 'OUT_OF_STOCK' ) );
	},
	'QuoteProblem unexpected field'     => function ( &$q ) {
		$q['lines'][0]['problems'] = array( array( 'code' => 'OUT_OF_STOCK', 'message' => 'x', 'severity' => 'high' ) );
	},
	'invalid calculatedAt timestamp'    => function ( &$q ) {
		$q['calculatedAt'] = '2026-09-14 08:00:00';
	},
	'invalid expiresAt timestamp'       => function ( &$q ) {
		$q['expiresAt'] = '';
	},
	'invalid cartId'                    => function ( &$q ) {
		$q['cartId'] = 'cart-1';
	},
	'cartRevision negative'             => function ( &$q ) {
		$q['cartRevision'] = -1;
	},
	'invalid customer context'          => function ( &$q ) {
		$q['customer'] = array( 'kind' => 'wholesale' );
	},
	'purchasable as a string'           => function ( &$q ) {
		$q['purchasable'] = 'yes';
	},
);

foreach ( $harden03_invalid_quotes as $harden03_label => $harden03_mutation ) {
	$harden03_candidate = $harden03_good_quote;
	$harden03_mutation( $harden03_candidate );
	br01_assert(
		$harden03_schema->validate( $harden03_candidate, 'Quote' ) !== null,
		'egress schema rejects: ' . $harden03_label
	);
}

/* ---------------------------------------------------------------------------
 * 7. Optional contract fields stay accepted; validator fails closed on the unknown
 * ------------------------------------------------------------------------ */

$harden03_with_optionals                         = $harden03_good_quote;
$harden03_with_optionals['lines'][0]['pricingLabel'] = 'per box';
$harden03_with_optionals['lines'][0]['variationId']  = '201';
br01_assert_eq( null, $harden03_schema->validate( $harden03_with_optionals, 'Quote' ), 'optional pricingLabel and variationId remain valid' );

$harden03_valid_problem                      = $harden03_good_quote;
$harden03_valid_problem['lines'][0]['problems'] = array(
	array(
		'code'    => 'OUT_OF_STOCK',
		'message' => 'Line is not purchasable in the isolated Woo cart.',
		'lineId'  => $schema_line_id,
	),
);
br01_assert_eq( null, $harden03_schema->validate( $harden03_valid_problem, 'Quote' ), 'contract QuoteProblem codes remain valid' );

br01_assert(
	Cetech_Pos_Bridge_Schema::instance()->validate( array(), 'PrepareSaleRequest' ) !== null,
	'validator refuses a definition the artifact does not carry'
);

Cetech_Pos_Bridge_Schema::set_instance_for_tests(
	array(
		'roots' => array( 'Probe' ),
		'$defs' => array(
			'Probe' => array(
				'type'            => 'string',
				'unevaluatedItems' => false,
			),
		),
	)
);
br01_assert(
	Cetech_Pos_Bridge_Schema::instance()->validate( 'anything', 'Probe' ) !== null,
	'validator fails closed on a keyword it does not implement'
);
Cetech_Pos_Bridge_Schema::set_instance_for_tests( null );
br01_assert( Cetech_Pos_Bridge_Schema::instance()->has_definition( 'Quote' ), 'schema singleton reloads the shipped artifact after the test seam' );

br01_assert_eq( 'body', Cetech_Pos_Bridge_Schema::field_of( array( 'path' => '', 'keyword' => 'type' ) ), 'root violations report the body field' );
br01_assert_eq( 'lines', Cetech_Pos_Bridge_Schema::field_of( array( 'path' => '/lines/0/quantity', 'keyword' => 'pattern' ) ), 'nested violations report only the top-level field' );
br01_assert_eq( 'customer', Cetech_Pos_Bridge_Schema::field_of( array( 'path' => '/customer/customerId', 'keyword' => 'pattern' ) ), 'customer violations report the customer field' );
