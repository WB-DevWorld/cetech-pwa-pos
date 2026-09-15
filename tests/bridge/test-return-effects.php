<?php
/**
 * BR-08 / issue #60 — independent commercial refund and stock-disposition.
 *
 * Local PHP assertions against an injected Woo runtime. Not live WordPress/Woo
 * evidence. Not a real DB concurrency PASS. Does not set pricingParityVerified.
 * Does not call payment providers. Does not restock live catalog.
 */

$br08_corr = '550e8400-e29b-41d4-a716-446655440090';

function br08_plugin( Cetech_Pos_Bridge_Fake_Woo_Runtime $runtime ) {
	return new Cetech_Pos_Bridge_Plugin( $runtime->get_environment(), $runtime );
}

function br08_fingerprint( $return_id ) {
	return hash( 'sha256', 'br08-return:' . $return_id );
}

function br08_completed_sale( Cetech_Pos_Bridge_Plugin $plugin, ?Cetech_Pos_Bridge_Fake_Woo_Runtime $runtime = null, array $quote_request = null ) {
	if ( $runtime instanceof Cetech_Pos_Bridge_Fake_Woo_Runtime ) {
		$runtime->reset_cart();
		$runtime->write_bag( '__idle__', array() );
	}
	$quote_http = $plugin->get_quote_controller()->handle(
		new Cetech_Pos_Bridge_Test_Request(
			array( 'X-Correlation-ID' => $GLOBALS['br08_corr'] ),
			'/cetech-pos/v1/quotes',
			$quote_request !== null ? $quote_request : br06_quote_request()
		)
	);
	$payload = br01_payload( $quote_http );
	br01_assert( ! empty( $payload['ok'] ), 'quote for BR-08 sale succeeds' );
	$quote = isset( $payload['data'] ) && is_array( $payload['data'] ) ? $payload['data'] : array();
	$body  = br06_prepare_body( $quote );
	$prep  = br06_dispatch_prepare( $plugin, $body, br06_headers( br06_next_uuid() ) );
	$prep_payload = br01_payload( $prep );
	br01_assert( ! empty( $prep_payload['ok'] ), 'prepare for BR-08 succeeds' );
	$prepared = isset( $prep_payload['data'] ) ? $prep_payload['data'] : array();
	$fin      = br07_dispatch_finalize( $plugin, br07_finalize_body( $prepared, $body ), br07_headers( br06_next_uuid() ) );
	br01_assert_eq( 200, br01_status( $fin ), 'BR-08 original sale finalizes' );
	return array(
		'quote'     => $quote,
		'body'      => $body,
		'prepared'  => $prepared,
		'order_id'  => isset( $prepared['orderReference'] ) ? (string) $prepared['orderReference'] : '',
		'line'      => $quote['lines'][0],
	);
}

function br08_headers( $idempotency_key ) {
	return array(
		'X-Correlation-ID' => $GLOBALS['br08_corr'],
		'Idempotency-Key'  => $idempotency_key,
	);
}

function br08_refund_body( array $sale, array $overrides = array() ) {
	$return_id = isset( $overrides['returnId'] ) ? $overrides['returnId'] : br06_next_uuid();
	$line      = $sale['line'];
	$amount    = $sale['quote']['total'];
	$base      = array(
		'commercialRefundId' => br06_next_uuid(),
		'returnId'           => $return_id,
		'transactionId'      => $sale['body']['transactionId'],
		'saleId'             => $sale['prepared']['saleId'],
		'amount'             => $amount,
		'economicsVersion'   => $sale['prepared']['quoteFingerprint'],
		'fingerprint'        => br08_fingerprint( $return_id ),
		'reason'             => 'customer_return',
		'lineAllocations'    => array(
			array(
				'orderLineId'    => $line['lineId'],
				'quantity'       => $line['quantity'],
				'historicAmount' => $amount,
			),
		),
	);
	return array_merge( $base, $overrides );
}

function br08_stock_body( array $sale, $disposition = 'restock_sellable', array $overrides = array() ) {
	$return_id = isset( $overrides['returnId'] ) ? $overrides['returnId'] : br06_next_uuid();
	$condition = $disposition === 'no_automatic_restock' ? 'damaged' : 'resellable';
	$line      = $sale['line'];
	$base      = array(
		'stockDispositionId' => br06_next_uuid(),
		'returnId'           => $return_id,
		'transactionId'      => $sale['body']['transactionId'],
		'saleId'             => $sale['prepared']['saleId'],
		'economicsVersion'   => $sale['prepared']['quoteFingerprint'],
		'fingerprint'        => br08_fingerprint( $return_id ),
		'lines'              => array(
			array(
				'orderLineId' => $line['lineId'],
				'quantity'    => $line['quantity'],
				'condition'   => $condition,
				'disposition' => $disposition,
			),
		),
	);
	return array_merge( $base, $overrides );
}

function br08_dispatch_refund( Cetech_Pos_Bridge_Plugin $plugin, array $body, array $headers ) {
	$controller = $plugin->get_commercial_refund_controller();
	$request    = new Cetech_Pos_Bridge_Test_Request( $headers, '/cetech-pos/v1/returns/commercial-refund', $body );
	$permission = $controller->permission_callback( $request );
	if ( $permission !== true ) {
		return $plugin->normalize_error_response( $permission, null, $request );
	}
	return $controller->handle( $request );
}

function br08_dispatch_refund_get( Cetech_Pos_Bridge_Plugin $plugin, $id, array $headers ) {
	$controller = $plugin->get_commercial_refund_controller();
	$request    = new Cetech_Pos_Bridge_Test_Request(
		$headers,
		'/cetech-pos/v1/returns/commercial-refund/' . $id,
		array(),
		array( 'commercialRefundId' => $id )
	);
	$permission = $controller->permission_callback( $request );
	if ( $permission !== true ) {
		return $plugin->normalize_error_response( $permission, null, $request );
	}
	return $controller->handle_resolve( $request );
}

function br08_dispatch_stock( Cetech_Pos_Bridge_Plugin $plugin, array $body, array $headers ) {
	$controller = $plugin->get_stock_disposition_controller();
	$request    = new Cetech_Pos_Bridge_Test_Request( $headers, '/cetech-pos/v1/returns/stock-disposition', $body );
	$permission = $controller->permission_callback( $request );
	if ( $permission !== true ) {
		return $plugin->normalize_error_response( $permission, null, $request );
	}
	return $controller->handle( $request );
}

function br08_dispatch_stock_get( Cetech_Pos_Bridge_Plugin $plugin, $id, array $headers ) {
	$controller = $plugin->get_stock_disposition_controller();
	$request    = new Cetech_Pos_Bridge_Test_Request(
		$headers,
		'/cetech-pos/v1/returns/stock-disposition/' . $id,
		array(),
		array( 'stockDispositionId' => $id )
	);
	$permission = $controller->permission_callback( $request );
	if ( $permission !== true ) {
		return $plugin->normalize_error_response( $permission, null, $request );
	}
	return $controller->handle_resolve( $request );
}

function br08_code( $response ) {
	$payload = br01_payload( $response );
	if ( isset( $payload['ok'] ) && $payload['ok'] === true && isset( $payload['data']['status'] ) ) {
		return $payload['data']['status'];
	}
	if ( isset( $payload['error']['code'] ) ) {
		return $payload['error']['code'];
	}
	return null;
}

function br08_data( $response ) {
	$payload = br01_payload( $response );
	return isset( $payload['data'] ) && is_array( $payload['data'] ) ? $payload['data'] : array();
}

function br08_partial_alloc( array $sale, $qty, $minor ) {
	return array(
		array(
			'orderLineId'    => $sale['line']['lineId'],
			'quantity'       => $qty,
			'historicAmount' => Cetech_Pos_Bridge_Money::envelope( $minor, $sale['quote']['total']['currency'] ),
		),
	);
}

function br08_engine_code( $result ) {
	if ( Cetech_Pos_Bridge_Quote_Request::is_error( $result ) ) {
		return $result->get_error_code();
	}
	return isset( $result['status'] ) ? $result['status'] : null;
}

function br08_crashed( $callable, $message ) {
	$crashed = false;
	try {
		$callable();
	} catch ( RuntimeException $e ) {
		$crashed = ( $e->getMessage() === $message );
	}
	br01_assert( $crashed, $message . ' seam fired' );
}

$woo_src    = file_get_contents( dirname( __DIR__, 2 ) . '/wordpress/cetech-pos-bridge/includes/class-woo-runtime.php' );
$engine_src = file_get_contents( dirname( __DIR__, 2 ) . '/wordpress/cetech-pos-bridge/includes/class-return-effect-engine.php' );
br01_assert( strpos( $woo_src, 'wc_create_refund' ) !== false, 'production commercial refund uses wc_create_refund' );
br01_assert( strpos( $woo_src, "'refund_payment' => false" ) !== false, 'production refund_payment=false' );
br01_assert( strpos( $woo_src, "'restock_items'  => false" ) !== false || strpos( $woo_src, "'restock_items' => false" ) !== false, 'production restock_items=false' );
br01_assert( strpos( $woo_src, 'woocommerce_before_order_object_save' ) !== false, 'production binds commercialRefundId during refund save' );
br01_assert( strpos( $woo_src, 'wc_update_product_stock' ) !== false, 'production stock uses wc_update_product_stock' );
br01_assert( strpos( $woo_src, "'increase'" ) !== false, 'production stock increase uses official Woo operator' );
br01_assert( strpos( $engine_src, 'calculate_totals' ) === false, 'return-effect engine does not invoke calculate_totals' );
br01_assert( strpos( $engine_src, 'woodmart' ) === false && strpos( $engine_src, 'b2bking' ) === false, 'return-effect engine does not invoke pricing plugins' );
br01_assert( strpos( $engine_src, '$wpdb' ) === false, 'return-effect engine does not write stock SQL' );
br01_assert( strpos( $woo_src, "update_meta_data( '_stock" ) === false, 'production does not write _stock meta directly' );

/* ---------------------------------------------------------------------------
 * CR-01 happy path
 * ------------------------------------------------------------------------ */

$cr01_runtime = br06_runtime();
$cr01_plugin  = br08_plugin( $cr01_runtime );
$cr01_sale    = br08_completed_sale( $cr01_plugin, $cr01_runtime );
$cr01_stock   = $cr01_runtime->stock['101'];
$cr01_calc    = $cr01_runtime->calculate_totals_calls;
$cr01_body    = br08_refund_body( $cr01_sale );
$cr01_key     = br06_next_uuid();
$cr01         = br08_dispatch_refund( $cr01_plugin, $cr01_body, br08_headers( $cr01_key ) );
br01_assert_eq( 200, br01_status( $cr01 ), 'CR-01 HTTP 200' );
br01_assert_eq( 'completed', br08_code( $cr01 ), 'CR-01 completed' );
br01_assert_eq( $cr01_body['commercialRefundId'], br08_data( $cr01 )['commercialRefundId'], 'CR-01 commercialRefundId' );
br01_assert_eq( 1, $cr01_runtime->native_refund_count_for( $cr01_body['commercialRefundId'] ), 'CR-01 native refund once' );
br01_assert_eq( false, $cr01_runtime->last_refund_flags['refund_payment'], 'CR-28 refund_payment=false' );
br01_assert_eq( false, $cr01_runtime->last_refund_flags['restock_items'], 'CR-29 restock_items=false' );
br01_assert_eq( 0, $cr01_runtime->payment_provider_refund_calls, 'CR-30 payment-provider refunds=0' );
br01_assert_eq( 0, $cr01_runtime->stock_increase_calls, 'CR-31 commercial path stock mutation=0' );
br01_assert_eq( $cr01_stock, $cr01_runtime->stock['101'], 'commercial refund does not change sellable stock' );
br01_assert_eq( 1, $cr01_runtime->pos_order_count(), 'CR-39 original Woo order remains one' );
br01_assert_eq( $cr01_calc, $cr01_runtime->calculate_totals_calls, 'CR-40 calculate_totals not invoked for refund amount' );

$cr02_body          = $cr01_body;
$cr02_body['extra'] = true;
$cr02               = br08_dispatch_refund( $cr01_plugin, $cr02_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $cr02 ), 'CR-02 extra field rejected' );

$cr03_body                  = br08_refund_body( $cr01_sale, array( 'transactionId' => br06_next_uuid() ) );
$cr03                       = br08_dispatch_refund( $cr01_plugin, $cr03_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'NOT_FOUND', br08_code( $cr03 ), 'CR-03 unknown transaction' );

$cr04_body           = br08_refund_body( $cr01_sale, array( 'saleId' => 'sale-other' ) );
$cr04                = br08_dispatch_refund( $cr01_plugin, $cr04_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $cr04 ), 'CR-04 saleId mismatch' );

$cr06_runtime = br06_runtime();
$cr06_plugin  = br08_plugin( $cr06_runtime );
$cr06_quote   = $cr06_plugin->get_quote_controller()->handle(
	new Cetech_Pos_Bridge_Test_Request( array( 'X-Correlation-ID' => $GLOBALS['br08_corr'] ), '/cetech-pos/v1/quotes', br06_quote_request() )
);
$cr06_q       = br01_payload( $cr06_quote )['data'];
$cr06_body    = br06_prepare_body( $cr06_q );
$cr06_prep    = br06_dispatch_prepare( $cr06_plugin, $cr06_body, br06_headers( br06_next_uuid() ) );
$cr06_sale    = array(
	'quote'     => $cr06_q,
	'body'      => $cr06_body,
	'prepared'  => br01_payload( $cr06_prep )['data'],
	'line'      => $cr06_q['lines'][0],
);
$cr06_unpaid = br08_dispatch_refund( $cr06_plugin, br08_refund_body( $cr06_sale ), br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $cr06_unpaid ), 'CR-06 original sale not completed' );

$cr07_body                        = br08_refund_body( $cr01_sale );
$cr07_body['amount']['currency']  = 'USD';
$cr07_body['lineAllocations'][0]['historicAmount']['currency'] = 'USD';
$cr07                             = br08_dispatch_refund( $cr01_plugin, $cr07_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $cr07 ), 'CR-07 currency mismatch' );

$cr08_runtime = br06_runtime();
$cr08_plugin  = br08_plugin( $cr08_runtime );
$cr08_sale    = br08_completed_sale( $cr08_plugin, $cr08_runtime );
$cr08_runtime->force_saved_total_minor = 1;
$cr08         = br08_dispatch_refund( $cr08_plugin, br08_refund_body( $cr08_sale ), br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $cr08 ), 'CR-08 historical grand total mismatch' );
$cr08_runtime->force_saved_total_minor = null;

foreach ( array( 'subtotal' => 'CR-09', 'discount' => 'CR-10', 'tax' => 'CR-11', 'total' => 'CR-12' ) as $field => $label ) {
	$rt  = br06_runtime();
	$pl  = br08_plugin( $rt );
	$sl  = br08_completed_sale( $pl, $rt );
	$rt->inject_line_economics( $sl['order_id'], $sl['line']['lineId'], $field, 1 );
	$res = br08_dispatch_refund( $pl, br08_refund_body( $sl ), br08_headers( br06_next_uuid() ) );
	br01_assert_eq( 'VALIDATION_ERROR', br08_code( $res ), $label . ' historic line mismatch' );
}

$cr13_runtime = br06_runtime();
$cr13_plugin  = br08_plugin( $cr13_runtime );
$cr13_sale    = br08_completed_sale( $cr13_plugin, $cr13_runtime );
$cr13_runtime->inject_line_quantity( $cr13_sale['order_id'], $cr13_sale['line']['lineId'], '9' );
$cr13         = br08_dispatch_refund( $cr13_plugin, br08_refund_body( $cr13_sale ), br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $cr13 ), 'CR-13 historic sold quantity mismatch' );

$cr14_body = br08_refund_body( $cr01_sale );
$cr14_body['lineAllocations'][0]['orderLineId'] = 'not-a-real-line';
$cr14      = br08_dispatch_refund( $cr01_plugin, $cr14_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $cr14 ), 'CR-14 unknown allocation line' );

$cr15_body = br08_refund_body( $cr01_sale );
$cr15_body['lineAllocations'][] = $cr15_body['lineAllocations'][0];
$cr15_body['amount']            = Cetech_Pos_Bridge_Money::envelope( $cr01_sale['quote']['total']['minor'] * 2 );
$cr15      = br08_dispatch_refund( $cr01_plugin, $cr15_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $cr15 ), 'CR-15 duplicate lineId' );

$cr16_body = br08_refund_body( $cr01_sale );
$cr16_body['lineAllocations'][0]['quantity'] = '2';
$cr16      = br08_dispatch_refund( $cr01_plugin, $cr16_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $cr16 ), 'CR-16 allocation quantity exceeds remaining' );

$cr17_body = br08_refund_body( $cr01_sale );
$cr17_body['lineAllocations'][0]['historicAmount'] = Cetech_Pos_Bridge_Money::envelope( $cr01_sale['quote']['total']['minor'] + 1 );
$cr17_body['amount'] = $cr17_body['lineAllocations'][0]['historicAmount'];
$cr17      = br08_dispatch_refund( $cr01_plugin, $cr17_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $cr17 ), 'CR-17 allocation amount exceeds remaining' );

$cr18_body = br08_refund_body( $cr01_sale );
$cr18_body['amount'] = Cetech_Pos_Bridge_Money::envelope( 1 );
$cr18      = br08_dispatch_refund( $cr01_plugin, $cr18_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $cr18 ), 'CR-18 top amount != allocation sum' );

$cr19 = br08_dispatch_refund( $cr01_plugin, $cr01_body, br08_headers( $cr01_key ) );
br01_assert_eq( 'completed', br08_code( $cr19 ), 'CR-19 same key same request replay' );
br01_assert_eq( br08_data( $cr01 ), br08_data( $cr19 ), 'CR-19 replay state identical' );
br01_assert_eq( 1, $cr01_runtime->native_refund_count_for( $cr01_body['commercialRefundId'] ), 'CR-19 no second native refund' );

$cr20_body           = $cr01_body;
$cr20_body['reason'] = 'different-reason';
$cr20                = br08_dispatch_refund( $cr01_plugin, $cr20_body, br08_headers( $cr01_key ) );
br01_assert_eq( 'IDEMPOTENCY_CONFLICT', br08_code( $cr20 ), 'CR-20 same key different request' );

$cr21 = br08_dispatch_refund( $cr01_plugin, $cr01_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'completed', br08_code( $cr21 ), 'CR-21 same effect different key recovers' );
br01_assert_eq( 1, $cr01_runtime->native_refund_count_for( $cr01_body['commercialRefundId'] ), 'CR-21 one effect' );

$cr22_body           = $cr01_body;
$cr22_body['reason'] = 'other-body';
$cr22                = br08_dispatch_refund( $cr01_plugin, $cr22_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'REQUIRES_ATTENTION', br08_code( $cr22 ), 'CR-22 same effect different body fail closed' );

$partial_runtime = br06_runtime();
$partial_plugin  = br08_plugin( $partial_runtime );
$partial_sale    = br08_completed_sale( $partial_plugin, $partial_runtime );
$total_minor     = (int) $partial_sale['quote']['total']['minor'];
$cr23_body       = br08_refund_body(
	$partial_sale,
	array(
		'lineAllocations' => br08_partial_alloc( $partial_sale, '0.4', 400 ),
		'amount'          => Cetech_Pos_Bridge_Money::envelope( 400 ),
	)
);
$cr23 = br08_dispatch_refund( $partial_plugin, $cr23_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'completed', br08_code( $cr23 ), 'CR-23 partial A succeeds' );
$cr24_body = br08_refund_body(
	$partial_sale,
	array(
		'lineAllocations' => br08_partial_alloc( $partial_sale, '0.6', $total_minor - 400 ),
		'amount'          => Cetech_Pos_Bridge_Money::envelope( $total_minor - 400 ),
	)
);
$cr24 = br08_dispatch_refund( $partial_plugin, $cr24_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'completed', br08_code( $cr24 ), 'CR-24 partial B consumes remaining' );
$cr25_body = br08_refund_body(
	$partial_sale,
	array(
		'lineAllocations' => br08_partial_alloc( $partial_sale, '0.1', 100 ),
		'amount'          => Cetech_Pos_Bridge_Money::envelope( 100 ),
	)
);
$cr25_creates = $partial_runtime->commercial_refund_creates;
$cr25         = br08_dispatch_refund( $partial_plugin, $cr25_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $cr25 ), 'CR-25 partial C exceeds remaining' );
br01_assert_eq( $cr25_creates, $partial_runtime->commercial_refund_creates, 'CR-25 no provider effect' );

$lock_runtime = br06_runtime();
$lock_plugin  = br08_plugin( $lock_runtime );
$lock_sale    = br08_completed_sale( $lock_plugin, $lock_runtime );
$lock_store   = $lock_plugin->get_return_effect_engine()->get_store();
$lock_store->acquire_domain_lock( 'commercial_refund', $lock_sale['body']['transactionId'] );
$lock_res     = br08_dispatch_refund( $lock_plugin, br08_refund_body( $lock_sale ), br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'OPERATION_IN_PROGRESS', br08_code( $lock_res ), 'CR-26 lock miss is OPERATION_IN_PROGRESS' );
$lock_store->release_domain_lock( 'commercial_refund', $lock_sale['body']['transactionId'] );
$lock_ok = br08_dispatch_refund( $lock_plugin, br08_refund_body( $lock_sale ), br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'completed', br08_code( $lock_ok ), 'CR-26 serialized retry completes within cap' );
br01_assert_eq( 1, $lock_runtime->commercial_refund_creates, 'CR-26/CR-27 native refund created once' );

$r1_runtime = br06_runtime();
$r1_plugin  = br08_plugin( $r1_runtime );
$r1_sale    = br08_completed_sale( $r1_plugin, $r1_runtime );
$r1_body    = br08_refund_body( $r1_sale );
$r1_key     = br06_next_uuid();
$r1_runtime->after_commercial_claim = br07_thrower( 'R1 crash' );
br08_crashed(
	function () use ( $r1_plugin, $r1_body, $r1_key ) {
		$r1_plugin->get_return_effect_engine()->apply_commercial_refund( $r1_body, $r1_key );
	},
	'R1 crash'
);
br01_assert_eq( 0, $r1_runtime->commercial_refund_creates, 'CR-32 R1 no native refund yet' );
$r1_retry = $r1_plugin->get_return_effect_engine()->apply_commercial_refund( $r1_body, $r1_key );
br01_assert_eq( 'completed', br08_engine_code( $r1_retry ), 'CR-32 R1 retry completes' );
br01_assert_eq( 1, $r1_runtime->native_refund_count_for( $r1_body['commercialRefundId'] ), 'CR-32 one native refund' );

$r3_runtime = br06_runtime();
$r3_plugin  = br08_plugin( $r3_runtime );
$r3_sale    = br08_completed_sale( $r3_plugin, $r3_runtime );
$r3_body    = br08_refund_body( $r3_sale );
$r3_key     = br06_next_uuid();
$r3_runtime->after_refund_native = br07_thrower( 'R3 crash' );
br08_crashed(
	function () use ( $r3_plugin, $r3_body, $r3_key ) {
		$r3_plugin->get_return_effect_engine()->apply_commercial_refund( $r3_body, $r3_key );
	},
	'R3 crash'
);
br01_assert_eq( 1, $r3_runtime->native_refund_count_for( $r3_body['commercialRefundId'] ), 'CR-33 native refund exists after lost response' );
$r3_retry = $r3_plugin->get_return_effect_engine()->apply_commercial_refund( $r3_body, $r3_key );
br01_assert_eq( 'completed', br08_engine_code( $r3_retry ), 'CR-33/CR-34 recover same refund' );
br01_assert_eq( 1, $r3_runtime->native_refund_count_for( $r3_body['commercialRefundId'] ), 'CR-33 no second refund' );

$amb_runtime = br06_runtime();
$amb_plugin  = br08_plugin( $amb_runtime );
$amb_sale    = br08_completed_sale( $amb_plugin, $amb_runtime );
$amb_body    = br08_refund_body( $amb_sale );
$amb_key     = br06_next_uuid();
$amb_runtime->duplicate_refund_on_create = true;
$amb_runtime->throw_after_refund_create  = true;
br08_crashed(
	function () use ( $amb_plugin, $amb_body, $amb_key ) {
		$amb_plugin->get_return_effect_engine()->apply_commercial_refund( $amb_body, $amb_key );
	},
	'wc_create_refund threw after native refund'
);
$amb_retry = $amb_plugin->get_return_effect_engine()->apply_commercial_refund( $amb_body, $amb_key );
br01_assert_eq( 'REQUIRES_ATTENTION', br08_engine_code( $amb_retry ), 'CR-35 ambiguous provider evidence' );
br01_assert_eq( 1, $amb_runtime->commercial_refund_creates, 'CR-35 no second wc_create_refund' );
br01_assert_eq( 2, $amb_runtime->native_refund_count_for( $amb_body['commercialRefundId'] ), 'CR-35 existing ambiguous pair retained' );

$get_headers = array( 'X-Correlation-ID' => $GLOBALS['br08_corr'] );
$mut_before  = $cr01_runtime->woo_mutation_counts();
$cr36        = br08_dispatch_refund_get( $cr01_plugin, $cr01_body['commercialRefundId'], $get_headers );
br01_assert_eq( 'completed', br08_code( $cr36 ), 'CR-36 GET completed' );
br01_assert_eq( $mut_before, $cr01_runtime->woo_mutation_counts(), 'CR-36 GET read-only' );
$cr36b = br08_dispatch_refund_get( $cr01_plugin, $cr01_body['commercialRefundId'], $get_headers );
br01_assert_eq( br08_data( $cr36 ), br08_data( $cr36b ), 'CR-36 repeated GET observational' );

$pend = br08_dispatch_refund_get( $r1_plugin, $r1_body['commercialRefundId'], $get_headers );
br01_assert_eq( 'completed', br08_code( $pend ), 'R1 recovered GET completed' );

$r1b_runtime = br06_runtime();
$r1b_plugin  = br08_plugin( $r1b_runtime );
$r1b_sale    = br08_completed_sale( $r1b_plugin, $r1b_runtime );
$r1b_body    = br08_refund_body( $r1b_sale );
$r1b_runtime->after_commercial_claim = br07_thrower( 'R1b' );
br08_crashed(
	function () use ( $r1b_plugin, $r1b_body ) {
		$r1b_plugin->get_return_effect_engine()->apply_commercial_refund( $r1b_body, br06_next_uuid() );
	},
	'R1b'
);
$cr37_mut = $r1b_runtime->woo_mutation_counts();
$cr37     = br08_dispatch_refund_get( $r1b_plugin, $r1b_body['commercialRefundId'], $get_headers );
br01_assert_eq( 'pending', br08_code( $cr37 ), 'CR-37 GET pending' );
br01_assert_eq( $cr37_mut, $r1b_runtime->woo_mutation_counts(), 'CR-37 GET pending read-only' );
br01_assert_eq( 0, $r1b_runtime->commercial_refund_creates, 'CR-37 GET does not create refund' );

$cr38 = br08_dispatch_refund_get( $cr01_plugin, br06_next_uuid(), $get_headers );
br01_assert_eq( 404, br01_status( $cr38 ), 'CR-38 GET unknown HTTP 404' );
br01_assert_eq( 'NOT_FOUND', br08_code( $cr38 ), 'CR-38 GET unknown NOT_FOUND' );

/* ---------------------------------------------------------------------------
 * Stock disposition
 * ------------------------------------------------------------------------ */

$sd01_runtime = br06_runtime();
$sd01_plugin  = br08_plugin( $sd01_runtime );
$sd01_sale    = br08_completed_sale( $sd01_plugin, $sd01_runtime );
$sd01_before  = $sd01_runtime->stock['101'];
$sd01_body    = br08_stock_body( $sd01_sale, 'restock_sellable' );
$sd01_key     = br06_next_uuid();
$sd01         = br08_dispatch_stock( $sd01_plugin, $sd01_body, br08_headers( $sd01_key ) );
br01_assert_eq( 'completed', br08_code( $sd01 ), 'SD-01 restock_sellable completed' );
br01_assert_eq( $sd01_before + 1, $sd01_runtime->stock['101'], 'SD-01 authoritative stock incremented once' );
br01_assert_eq( 1, $sd01_runtime->stock_increase_calls, 'SD-01 stock API once' );
br01_assert_eq( 0, $sd01_runtime->commercial_refund_creates, 'SD-29 stock does not create Woo refund' );
br01_assert_eq( 0, $sd01_runtime->payment_provider_refund_calls, 'SD-30 stock does not call provider refund' );

$sd02_runtime = br06_runtime();
$sd02_plugin  = br08_plugin( $sd02_runtime );
$sd02_sale    = br08_completed_sale( $sd02_plugin, $sd02_runtime );
$sd02_before  = $sd02_runtime->stock['101'];
$sd02_body    = br08_stock_body( $sd02_sale, 'no_automatic_restock' );
$sd02         = br08_dispatch_stock( $sd02_plugin, $sd02_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'completed', br08_code( $sd02 ), 'SD-02 no_automatic_restock completed' );
br01_assert_eq( $sd02_before, $sd02_runtime->stock['101'], 'SD-02 sellable stock unchanged' );
br01_assert_eq( 0, $sd02_runtime->stock_increase_calls, 'SD-02 zero sellable mutation' );

$sd03_body          = $sd01_body;
$sd03_body['extra'] = true;
$sd03               = br08_dispatch_stock( $sd01_plugin, $sd03_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $sd03 ), 'SD-03 extra field rejected' );

$sd04 = br08_dispatch_stock( $sd01_plugin, br08_stock_body( $sd01_sale, 'restock_sellable', array( 'transactionId' => br06_next_uuid() ) ), br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'NOT_FOUND', br08_code( $sd04 ), 'SD-04 unknown transaction' );

$sd05 = br08_dispatch_stock( $sd01_plugin, br08_stock_body( $sd01_sale, 'restock_sellable', array( 'saleId' => 'sale-other' ) ), br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $sd05 ), 'SD-05 saleId mismatch' );

$sd06 = br08_dispatch_stock( $cr06_plugin, br08_stock_body( $cr06_sale, 'restock_sellable' ), br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $sd06 ), 'SD-06 original sale not completed' );

$sd07_body = br08_stock_body( $sd01_sale, 'restock_sellable' );
$sd07_body['lines'][0]['orderLineId'] = 'unknown-line';
$sd07      = br08_dispatch_stock( $sd01_plugin, $sd07_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $sd07 ), 'SD-07 unknown lineId' );

$sd08_runtime = br06_runtime();
$sd08_plugin  = br08_plugin( $sd08_runtime );
$sd08_sale    = br08_completed_sale( $sd08_plugin, $sd08_runtime );
$sd08_runtime->inject_wrong_product_for_line( $sd08_sale['order_id'], $sd08_sale['line']['lineId'], '999' );
$sd08         = br08_dispatch_stock( $sd08_plugin, br08_stock_body( $sd08_sale, 'restock_sellable' ), br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $sd08 ), 'SD-08 product mismatch' );

$sd09_runtime = br06_runtime();
$sd09_plugin  = br08_plugin( $sd09_runtime );
$sd09_sale    = br08_completed_sale( $sd09_plugin, $sd09_runtime );
$sd09_runtime->inject_line_variation( $sd09_sale['order_id'], $sd09_sale['line']['lineId'], '202' );
$sd09         = br08_dispatch_stock( $sd09_plugin, br08_stock_body( $sd09_sale, 'restock_sellable' ), br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $sd09 ), 'SD-09 variation mismatch' );

$sd10_body = br08_stock_body( $sd01_sale, 'restock_sellable' );
$sd10_body['lines'][0]['quantity'] = '2';
$sd10      = br08_dispatch_stock( $sd01_plugin, $sd10_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $sd10 ), 'SD-10 quantity exceeds remaining' );

$cap_runtime = br06_runtime();
$cap_runtime->catalog['walkin']['101']['2'] = array(
	'unitPrice'   => '10.00',
	'subtotal'    => '20.00',
	'discount'    => '0.00',
	'tax'         => '0.00',
	'stockStatus' => 'in_stock',
	'purchasable' => true,
);
$cap_runtime->stock['101'] = 10;
$cap_plugin = br08_plugin( $cap_runtime );
$cap_req    = br06_quote_request();
$cap_req['lines'][0]['quantity'] = '2';
$cap_sale   = br08_completed_sale( $cap_plugin, $cap_runtime, $cap_req );
$sd11_a     = br08_stock_body( $cap_sale, 'restock_sellable' );
$sd11_a['lines'][0]['quantity'] = '1';
$sd11_ar    = br08_dispatch_stock( $cap_plugin, $sd11_a, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'completed', br08_code( $sd11_ar ), 'SD-11 first partial within cap' );
$sd11_b     = br08_stock_body( $cap_sale, 'no_automatic_restock' );
$sd11_b['lines'][0]['quantity'] = '1';
$sd11_br    = br08_dispatch_stock( $cap_plugin, $sd11_b, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'completed', br08_code( $sd11_br ), 'SD-11 second partial within cap' );
$sd12       = br08_dispatch_stock( $cap_plugin, br08_stock_body( $cap_sale, 'restock_sellable' ), br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $sd12 ), 'SD-12 exceeds cap' );

$sd13_runtime = br06_runtime();
$sd13_plugin  = br08_plugin( $sd13_runtime );
$sd13_sale    = br08_completed_sale( $sd13_plugin, $sd13_runtime );
br08_dispatch_stock( $sd13_plugin, br08_stock_body( $sd13_sale, 'no_automatic_restock' ), br08_headers( br06_next_uuid() ) );
$sd13         = br08_dispatch_stock( $sd13_plugin, br08_stock_body( $sd13_sale, 'restock_sellable' ), br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'VALIDATION_ERROR', br08_code( $sd13 ), 'SD-13 no_automatic_restock consumes cap' );

$sd14      = br08_dispatch_stock( $sd01_plugin, $sd01_body, br08_headers( $sd01_key ) );
$sd14b     = br08_dispatch_stock( $sd01_plugin, $sd01_body, br08_headers( $sd01_key ) );
br01_assert_eq( 'completed', br08_code( $sd14b ), 'SD-14 same key same body replay' );
br01_assert_eq( 1, $sd01_runtime->stock_increase_calls, 'SD-14 no second increment' );

$sd15_body = $sd01_body;
$sd15_body['fingerprint'] = br08_fingerprint( br06_next_uuid() );
$sd15      = br08_dispatch_stock( $sd01_plugin, $sd15_body, br08_headers( $sd01_key ) );
br01_assert_eq( 'IDEMPOTENCY_CONFLICT', br08_code( $sd15 ), 'SD-15 same key different body' );

$sd16 = br08_dispatch_stock( $sd01_plugin, $sd01_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'completed', br08_code( $sd16 ), 'SD-16 same effect different key' );
br01_assert_eq( 1, $sd01_runtime->stock_increase_calls, 'SD-16 same effect' );

$sd17_body = $sd01_body;
$sd17_body['fingerprint'] = br08_fingerprint( br06_next_uuid() );
$sd17      = br08_dispatch_stock( $sd01_plugin, $sd17_body, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'REQUIRES_ATTENTION', br08_code( $sd17 ), 'SD-17 same effect different request' );

$sd18_store = $cap_plugin->get_return_effect_engine()->get_store();
$sd18_tx    = $cap_sale['body']['transactionId'];
$sd18_store->acquire_domain_lock( 'stock_disposition', $sd18_tx );
$sd18       = br08_dispatch_stock( $cap_plugin, br08_stock_body( $cap_sale, 'restock_sellable' ), br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'OPERATION_IN_PROGRESS', br08_code( $sd18 ), 'SD-18 concurrent lock miss' );
$sd18_store->release_domain_lock( 'stock_disposition', $sd18_tx );

$var_runtime = br06_runtime();
$var_runtime->catalog['walkin']['101:202']['1'] = array(
	'unitPrice'   => '10.00',
	'subtotal'    => '10.00',
	'discount'    => '0.00',
	'tax'         => '0.00',
	'stockStatus' => 'in_stock',
	'purchasable' => true,
);
$var_runtime->stock['101'] = 10;
$var_runtime->stock['202'] = 0;
$var_runtime->product_stock_rules['202'] = array(
	'managing_stock'     => true,
	'backorders_allowed' => false,
	'stock_managed_by'   => '101',
);
$var_plugin = br08_plugin( $var_runtime );
$var_req    = br06_quote_request();
$var_req['lines'][0]['variationId'] = '202';
$var_sale   = br08_completed_sale( $var_plugin, $var_runtime, $var_req );
$var_before_parent = $var_runtime->stock['101'];
$var_before_var    = $var_runtime->stock['202'];
$var_res    = br08_dispatch_stock( $var_plugin, br08_stock_body( $var_sale, 'restock_sellable' ), br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'completed', br08_code( $var_res ), 'SD-19 variation restock completed' );
br01_assert_eq( $var_before_parent + 1, $var_runtime->stock['101'], 'SD-19 parent stock owner incremented' );
br01_assert_eq( $var_before_var, $var_runtime->stock['202'], 'SD-19 variation bucket unchanged' );

$s1_runtime = br06_runtime();
$s1_plugin  = br08_plugin( $s1_runtime );
$s1_sale    = br08_completed_sale( $s1_plugin, $s1_runtime );
$s1_body    = br08_stock_body( $s1_sale, 'restock_sellable' );
$s1_key     = br06_next_uuid();
$s1_runtime->after_stock_claim = br07_thrower( 'S1 crash' );
br08_crashed(
	function () use ( $s1_plugin, $s1_body, $s1_key ) {
		$s1_plugin->get_return_effect_engine()->apply_stock_disposition( $s1_body, $s1_key );
	},
	'S1 crash'
);
br01_assert_eq( 0, $s1_runtime->stock_increase_calls, 'SD-21 S1 no stock API yet' );
$s1_retry = $s1_plugin->get_return_effect_engine()->apply_stock_disposition( $s1_body, $s1_key );
br01_assert_eq( 'completed', br08_engine_code( $s1_retry ), 'SD-21 S1 safe retry' );
br01_assert_eq( 1, $s1_runtime->stock_increase_calls, 'SD-21 increment once' );

$s3_runtime = br06_runtime();
$s3_plugin  = br08_plugin( $s3_runtime );
$s3_sale    = br08_completed_sale( $s3_plugin, $s3_runtime );
$s3_body    = br08_stock_body( $s3_sale, 'restock_sellable' );
$s3_key     = br06_next_uuid();
$s3_runtime->after_stock_line_mutated = br07_thrower( 'S3 crash' );
br08_crashed(
	function () use ( $s3_plugin, $s3_body, $s3_key ) {
		$s3_plugin->get_return_effect_engine()->apply_stock_disposition( $s3_body, $s3_key );
	},
	'S3 crash'
);
br01_assert_eq( 1, $s3_runtime->stock_increase_calls, 'SD-22 increment already happened' );
$s3_retry = $s3_plugin->get_return_effect_engine()->apply_stock_disposition( $s3_body, $s3_key );
br01_assert_eq( 'REQUIRES_ATTENTION', br08_engine_code( $s3_retry ), 'SD-22 post-increment crash is attention' );
br01_assert_eq( 1, $s3_runtime->stock_increase_calls, 'SD-22/SD-23 no second increment' );

$s3_mut = $s3_runtime->woo_mutation_counts();
$sd27   = br08_dispatch_stock_get( $s3_plugin, $s3_body['stockDispositionId'], $get_headers );
br01_assert_eq( 'requires_attention', br08_code( $sd27 ), 'SD-27 GET ambiguous' );
br01_assert_eq( $s3_mut, $s3_runtime->woo_mutation_counts(), 'SD-27 GET read-only' );

$sd24 = br08_dispatch_stock( $sd01_plugin, $sd01_body, br08_headers( $sd01_key ) );
br01_assert_eq( 'completed', br08_code( $sd24 ), 'SD-24 completed retry' );
br01_assert_eq( 1, $sd01_runtime->stock_increase_calls, 'SD-24 no second increment' );

$ml_runtime = br06_runtime();
$ml_runtime->catalog['walkin']['102']['1'] = array(
	'unitPrice'   => '5.00',
	'subtotal'    => '5.00',
	'discount'    => '0.00',
	'tax'         => '0.00',
	'stockStatus' => 'in_stock',
	'purchasable' => true,
);
$ml_runtime->stock['101'] = 10;
$ml_runtime->stock['102'] = 10;
$ml_plugin = br08_plugin( $ml_runtime );
$ml_req    = br06_quote_request();
$ml_req['lines'][] = array(
	'lineId'    => br06_next_uuid(),
	'productId' => '102',
	'quantity'  => '1',
);
$ml_sale   = br08_completed_sale( $ml_plugin, $ml_runtime, $ml_req );
$ml_body   = br08_stock_body( $ml_sale, 'restock_sellable' );
$ml_body['lines'] = array(
	array(
		'orderLineId' => $ml_sale['quote']['lines'][0]['lineId'],
		'quantity'    => '1',
		'condition'   => 'resellable',
		'disposition' => 'restock_sellable',
	),
	array(
		'orderLineId' => $ml_sale['quote']['lines'][1]['lineId'],
		'quantity'    => '1',
		'condition'   => 'resellable',
		'disposition' => 'restock_sellable',
	),
);
$ml_key = br06_next_uuid();
$ml_runtime->throw_on_stock_increase_n = 2;
br08_crashed(
	function () use ( $ml_plugin, $ml_body, $ml_key ) {
		$ml_plugin->get_return_effect_engine()->apply_stock_disposition( $ml_body, $ml_key );
	},
	'stock increase threw after native mutation'
);
$ml_inc = $ml_runtime->stock_increase_calls;
$ml_retry = $ml_plugin->get_return_effect_engine()->apply_stock_disposition( $ml_body, $ml_key );
br01_assert_eq( 'REQUIRES_ATTENTION', br08_engine_code( $ml_retry ), 'SD-25 multi-line attention' );
br01_assert_eq( $ml_inc, $ml_runtime->stock_increase_calls, 'SD-25 completed line A never re-applied' );

$sd26_mut = $sd01_runtime->woo_mutation_counts();
$sd26     = br08_dispatch_stock_get( $sd01_plugin, $sd01_body['stockDispositionId'], $get_headers );
br01_assert_eq( 'completed', br08_code( $sd26 ), 'SD-26 GET completed' );
br01_assert_eq( $sd26_mut, $sd01_runtime->woo_mutation_counts(), 'SD-26 GET read-only' );

$sd28 = br08_dispatch_stock_get( $sd01_plugin, br06_next_uuid(), $get_headers );
br01_assert_eq( 'NOT_FOUND', br08_code( $sd28 ), 'SD-28 GET unknown' );

$ind_runtime = br06_runtime();
$ind_plugin  = br08_plugin( $ind_runtime );
$ind_sale    = br08_completed_sale( $ind_plugin, $ind_runtime );
$ind_stock   = $ind_runtime->stock['101'];
$ind_refund  = br08_dispatch_refund( $ind_plugin, br08_refund_body( $ind_sale ), br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'completed', br08_code( $ind_refund ), 'independence commercial completed' );
br01_assert_eq( $ind_stock, $ind_runtime->stock['101'], 'commercial without stock command leaves stock unchanged' );
$ind_no_stock = br08_dispatch_stock( $ind_plugin, br08_stock_body( $ind_sale, 'no_automatic_restock' ), br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'completed', br08_code( $ind_no_stock ), 'independence no_automatic_restock' );
br01_assert_eq( $ind_stock, $ind_runtime->stock['101'], 'commercial + no_automatic_restock stock unchanged' );
br01_assert_eq( 1, $ind_runtime->commercial_refund_creates, 'independence one commercial refund' );

$ind2_runtime = br06_runtime();
$ind2_plugin  = br08_plugin( $ind2_runtime );
$ind2_sale    = br08_completed_sale( $ind2_plugin, $ind2_runtime );
br08_dispatch_refund( $ind2_plugin, br08_refund_body( $ind2_sale ), br08_headers( br06_next_uuid() ) );
$ind2_before = $ind2_runtime->stock['101'];
$ind2_stock  = br08_dispatch_stock( $ind2_plugin, br08_stock_body( $ind2_sale, 'restock_sellable' ), br08_headers( br06_next_uuid() ) );
br01_assert_eq( 'completed', br08_code( $ind2_stock ), 'independence restock_sellable with commercial' );
br01_assert_eq( $ind2_before + 1, $ind2_runtime->stock['101'], 'independence one intended stock increment' );
br01_assert_eq( 1, $ind2_runtime->commercial_refund_creates, 'independence still one commercial refund' );
br01_assert_eq( 1, $ind2_runtime->stock_increase_calls, 'independence one stock increment' );
