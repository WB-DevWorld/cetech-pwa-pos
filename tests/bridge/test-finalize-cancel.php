<?php
/**
 * BR-07 / issue #19 — verified commercial finalize and safe cancel.
 *
 * Local PHP assertions against an injected Woo runtime. Not live WordPress/Woo
 * evidence. Not a real DB concurrency PASS. Does not set pricingParityVerified.
 * Does not call payment providers.
 */

$br07_corr = '550e8400-e29b-41d4-a716-446655440080';

function br07_plugin( Cetech_Pos_Bridge_Fake_Woo_Runtime $runtime ) {
	return new Cetech_Pos_Bridge_Plugin( $runtime->get_environment(), $runtime );
}

function br07_quote_and_prepare( Cetech_Pos_Bridge_Plugin $plugin, ?Cetech_Pos_Bridge_Fake_Woo_Runtime $runtime = null ) {
	if ( $runtime instanceof Cetech_Pos_Bridge_Fake_Woo_Runtime ) {
		$runtime->reset_cart();
		$runtime->write_bag( '__idle__', array() );
	}
	$quote_http = $plugin->get_quote_controller()->handle(
		new Cetech_Pos_Bridge_Test_Request(
			array( 'X-Correlation-ID' => $GLOBALS['br07_corr'] ),
			'/cetech-pos/v1/quotes',
			br06_quote_request()
		)
	);
	$payload = br01_payload( $quote_http );
	br01_assert( ! empty( $payload['ok'] ), 'quote for BR-07 prepare succeeds' );
	$quote = isset( $payload['data'] ) && is_array( $payload['data'] ) ? $payload['data'] : array();
	$body  = br06_prepare_body( $quote );
	$key   = br06_next_uuid();
	$prep  = br06_dispatch_prepare( $plugin, $body, br06_headers( $key ) );
	$prep_payload = br01_payload( $prep );
	br01_assert( ! empty( $prep_payload['ok'] ), 'prepare for BR-07 succeeds' );
	return array(
		'quote'     => $quote,
		'body'      => $body,
		'prepared'  => isset( $prep_payload['data'] ) ? $prep_payload['data'] : array(),
		'prep_key'  => $key,
	);
}

function br07_headers( $idempotency_key ) {
	return array(
		'X-Correlation-ID' => $GLOBALS['br07_corr'],
		'Idempotency-Key'  => $idempotency_key,
	);
}

function br07_cash_evidence( array $prepared, array $body, $payment_id = null, $evidence_id = null ) {
	return array(
		'evidenceId'          => $evidence_id !== null ? $evidence_id : br06_next_uuid(),
		'transactionId'       => $body['transactionId'],
		'paymentId'           => $payment_id !== null ? $payment_id : br06_next_uuid(),
		'saleId'              => $prepared['saleId'],
		'amount'              => $prepared['total'],
		'tender'              => 'cash',
		'verifiedAt'          => '2026-09-14T12:00:00Z',
		'verificationSource'  => 'cash_ledger',
	);
}

function br07_finalize_body( array $prepared, array $body, $payment_id = null, $evidence_id = null ) {
	return array(
		'transactionId' => $body['transactionId'],
		'payment'       => br07_cash_evidence( $prepared, $body, $payment_id, $evidence_id ),
	);
}

function br07_dispatch_finalize( Cetech_Pos_Bridge_Plugin $plugin, array $body, array $headers ) {
	$controller = $plugin->get_finalize_controller();
	$request    = new Cetech_Pos_Bridge_Test_Request( $headers, '/cetech-pos/v1/sales/finalize', $body );
	$permission = $controller->permission_callback( $request );
	if ( $permission !== true ) {
		return $plugin->normalize_error_response( $permission, null, $request );
	}
	return $controller->handle( $request );
}

function br07_dispatch_cancel( Cetech_Pos_Bridge_Plugin $plugin, array $body, array $headers ) {
	$controller = $plugin->get_cancel_controller();
	$request    = new Cetech_Pos_Bridge_Test_Request( $headers, '/cetech-pos/v1/sales/cancel', $body );
	$permission = $controller->permission_callback( $request );
	if ( $permission !== true ) {
		return $plugin->normalize_error_response( $permission, null, $request );
	}
	return $controller->handle( $request );
}

function br07_code( $response ) {
	if ( Cetech_Pos_Bridge_Quote_Request::is_error( $response ) ) {
		return $response->get_error_code();
	}
	$payload = br01_payload( $response );
	if ( isset( $payload['ok'] ) && $payload['ok'] === false && isset( $payload['error']['code'] ) ) {
		return $payload['error']['code'];
	}
	if ( isset( $payload['ok'] ) && $payload['ok'] === true && isset( $payload['data']['status'] ) ) {
		return $payload['data']['status'];
	}
	return null;
}

function br07_data( $response ) {
	$payload = br01_payload( $response );
	return isset( $payload['data'] ) && is_array( $payload['data'] ) ? $payload['data'] : array();
}

function br07_engine_code( $result ) {
	if ( Cetech_Pos_Bridge_Quote_Request::is_error( $result ) ) {
		return $result->get_error_code();
	}
	if ( is_array( $result ) && isset( $result['status'] ) ) {
		return $result['status'];
	}
	return null;
}

function br07_thrower( $message ) {
	return function () use ( $message ) {
		throw new RuntimeException( $message );
	};
}

$woo_src = file_get_contents( dirname( __DIR__, 2 ) . '/wordpress/cetech-pos-bridge/includes/class-woo-runtime.php' );
br01_assert( strpos( $woo_src, 'payment_complete' ) !== false, 'production finalize uses WC_Order::payment_complete' );
br01_assert( strpos( $woo_src, 'wc_release_stock_for_order' ) !== false, 'production cancel uses wc_release_stock_for_order' );
br01_assert( strpos( $woo_src, 'wp_insert_post' ) === false, 'production commercial path does not wp_insert_post' );
br01_assert( strpos( $woo_src, 'inspect_commercial_snapshot' ) !== false, 'production exposes observational commercial inspect' );

$sql = Cetech_Pos_Bridge_Schema_Install::create_command_table_sql( 'wp_cetech_pos_command_claims' );
br01_assert( strpos( $sql, 'UNIQUE KEY uniq_idempotency (site_scope, operation_type, idempotency_key)' ) !== false, 'command table UNIQUE idempotency' );
br01_assert( strpos( $sql, 'UNIQUE KEY uniq_command (site_scope, transaction_id, operation_type)' ) !== false, 'command table UNIQUE transaction+operation' );
br01_assert( strpos( $sql, 'UNIQUE KEY uniq_payment (site_scope, payment_id)' ) !== false, 'command table UNIQUE paymentId' );
br01_assert( strpos( $sql, 'UNIQUE KEY uniq_evidence (site_scope, evidence_id)' ) !== false, 'command table UNIQUE evidenceId' );
br01_assert_eq( 'wp_cetech_pos_command_claims', Cetech_Pos_Bridge_Schema_Install::command_table_name( (object) array( 'prefix' => 'wp_' ) ), 'command table name' );
br01_assert_eq( $sql, Cetech_Pos_Bridge_Schema_Install::create_command_table_sql( 'wp_cetech_pos_command_claims' ), 'command CREATE TABLE is deterministic' );

/* ---------------------------------------------------------------------------
 * Happy-path cash finalize
 * ------------------------------------------------------------------------ */

$br07_ok_runtime = br06_runtime();
$br07_ok_plugin  = br07_plugin( $br07_ok_runtime );
$br07_ok         = br07_quote_and_prepare( $br07_ok_plugin );
$br07_fin_body   = br07_finalize_body( $br07_ok['prepared'], $br07_ok['body'] );
$br07_fin_key    = br06_next_uuid();
$br07_fin        = br07_dispatch_finalize( $br07_ok_plugin, $br07_fin_body, br07_headers( $br07_fin_key ) );
br01_assert_eq( 200, br01_status( $br07_fin ), 'cash finalize HTTP 200' );
br01_assert_eq( 'completed', br07_code( $br07_fin ), 'cash_ledger evidence completes prepared sale' );
$br07_fin_data = br07_data( $br07_fin );
br01_assert_eq( $br07_ok['body']['transactionId'], $br07_fin_data['transactionId'], 'completed resolution transactionId' );
br01_assert_eq( $br07_ok['prepared']['saleId'], $br07_fin_data['saleId'], 'completed resolution saleId' );
br01_assert_eq( $br07_ok['prepared']['orderReference'], $br07_fin_data['orderReference'], 'completed resolution orderReference' );
br01_assert_eq( $br07_fin_body['payment']['paymentId'], $br07_fin_data['paymentId'], 'completed resolution paymentId' );
br01_assert( ! isset( $br07_fin_data['receiptId'] ), 'bridge completion does not create receiptId' );
br01_assert_eq( 1, $br07_ok_runtime->pos_order_count(), 'happy path Woo order count remains 1' );
br01_assert_eq( 1, $br07_ok_runtime->create_calls, 'happy path provider create count 1' );
br01_assert_eq( 1, $br07_ok_runtime->payment_complete_calls, 'payment_complete exactly once' );
br01_assert_eq( 1, $br07_ok_runtime->stock_reduce_calls, 'stock commit exactly once' );
br01_assert_eq( (int) $br07_ok['prepared']['total']['minor'], (int) br06_last_pos_order( $br07_ok_runtime )['total_minor'], 'Woo saved total equals PreparedSale.total' );

$br07_replay = br07_dispatch_finalize( $br07_ok_plugin, $br07_fin_body, br07_headers( $br07_fin_key ) );
br01_assert_eq( 'completed', br07_code( $br07_replay ), 'same key same request replay returns completed' );
br01_assert_eq( $br07_fin_data, br07_data( $br07_replay ), 'same-key replay SaleResolution is identical' );
br01_assert_eq( 1, $br07_ok_runtime->payment_complete_calls, 'replay does not payment_complete again' );

$br07_conflict_body = $br07_fin_body;
$br07_conflict_body['payment']['verifiedAt'] = '2026-09-14T12:00:01Z';
$br07_conflict = br07_dispatch_finalize( $br07_ok_plugin, $br07_conflict_body, br07_headers( $br07_fin_key ) );
br01_assert_eq( 'IDEMPOTENCY_CONFLICT', br07_code( $br07_conflict ), 'same key different request is IDEMPOTENCY_CONFLICT' );
br01_assert_eq( 409, br01_status( $br07_conflict ), 'idempotency conflict HTTP 409' );

$br07_same_pay = br07_dispatch_finalize( $br07_ok_plugin, $br07_fin_body, br07_headers( br06_next_uuid() ) );
br01_assert_eq( 'completed', br07_code( $br07_same_pay ), 'different key same payment recovers completed once' );
br01_assert_eq( 1, $br07_ok_runtime->payment_complete_calls, 'different-key same payment does not complete again' );

$br07_other_pay = $br07_fin_body;
$br07_other_pay['payment']['paymentId']  = br06_next_uuid();
$br07_other_pay['payment']['evidenceId'] = br06_next_uuid();
$br07_other = br07_dispatch_finalize( $br07_ok_plugin, $br07_other_pay, br07_headers( br06_next_uuid() ) );
br01_assert_eq( 'requires_attention', br07_code( $br07_other ), 'different paymentId same sale is requires_attention' );
br01_assert_eq( 1, $br07_ok_runtime->payment_complete_calls, 'different payment does not complete again' );

$br07_before_get = $br07_ok_runtime->snapshot_woo_state();
$br07_resolve    = br06_dispatch_resolve( $br07_ok_plugin, $br07_ok['body']['transactionId'], array( 'X-Correlation-ID' => $br07_corr ) );
br01_assert_eq( 'completed', br07_code( $br07_resolve ), 'GET resolve after completion is completed' );
br07_assert_woo_frozen( $br07_ok_runtime, $br07_before_get, 'GET after completed' );

function br07_assert_woo_frozen( Cetech_Pos_Bridge_Fake_Woo_Runtime $runtime, array $before, $label ) {
	br06_assert_woo_frozen( $runtime, $before, $label );
}

/* ---------------------------------------------------------------------------
 * Schema / binding rejections — no Woo effect
 * ------------------------------------------------------------------------ */

$br07_rej_runtime = br06_runtime();
$br07_rej_plugin  = br07_plugin( $br07_rej_runtime );
$br07_rej         = br07_quote_and_prepare( $br07_rej_plugin );
$br07_rej_body    = br07_finalize_body( $br07_rej['prepared'], $br07_rej['body'] );
$br07_rej_extra   = $br07_rej_body;
$br07_rej_extra['rush'] = true;
br01_assert_eq( 'VALIDATION_ERROR', br07_code( br07_dispatch_finalize( $br07_rej_plugin, $br07_rej_extra, br07_headers( br06_next_uuid() ) ) ), 'BridgeFinalizeRequest extra field rejected' );
$br07_missing = $br07_rej_body;
unset( $br07_missing['payment']['paymentId'] );
br01_assert_eq( 'VALIDATION_ERROR', br07_code( br07_dispatch_finalize( $br07_rej_plugin, $br07_missing, br07_headers( br06_next_uuid() ) ) ), 'missing payment field rejected' );

$br07_tx_mismatch = $br07_rej_body;
$br07_tx_mismatch['payment']['transactionId'] = br06_next_uuid();
br01_assert_eq( 'PAYMENT_NOT_VERIFIED', br07_code( br07_dispatch_finalize( $br07_rej_plugin, $br07_tx_mismatch, br07_headers( br06_next_uuid() ) ) ), 'transaction mismatch is PAYMENT_NOT_VERIFIED' );

$br07_sale_mismatch = $br07_rej_body;
$br07_sale_mismatch['payment']['saleId'] = 'sale-other';
br01_assert_eq( 'PAYMENT_NOT_VERIFIED', br07_code( br07_dispatch_finalize( $br07_rej_plugin, $br07_sale_mismatch, br07_headers( br06_next_uuid() ) ) ), 'saleId mismatch is PAYMENT_NOT_VERIFIED' );

$br07_amt = $br07_rej_body;
$br07_amt['payment']['amount']['minor'] = (int) $br07_rej['prepared']['total']['minor'] + 1;
br01_assert_eq( 'PAYMENT_NOT_VERIFIED', br07_code( br07_dispatch_finalize( $br07_rej_plugin, $br07_amt, br07_headers( br06_next_uuid() ) ) ), 'amount mismatch is PAYMENT_NOT_VERIFIED' );

$br07_cur = $br07_rej_body;
$br07_cur['payment']['amount']['currency'] = 'USD';
br01_assert_eq( 'PAYMENT_NOT_VERIFIED', br07_code( br07_dispatch_finalize( $br07_rej_plugin, $br07_cur, br07_headers( br06_next_uuid() ) ) ), 'currency mismatch is PAYMENT_NOT_VERIFIED' );

$br07_unknown = br07_finalize_body(
	array(
		'saleId'         => 'sale-x',
		'orderReference' => '1',
		'total'          => array( 'minor' => 1000, 'currency' => 'GHS' ),
	),
	array( 'transactionId' => br06_next_uuid() )
);
br01_assert_eq( 'NOT_FOUND', br07_code( br07_dispatch_finalize( $br07_rej_plugin, $br07_unknown, br07_headers( br06_next_uuid() ) ) ), 'unknown transaction is NOT_FOUND' );
br01_assert_eq( 0, $br07_rej_runtime->payment_complete_calls, 'rejected finalize does not payment_complete' );
br01_assert_eq( 1, $br07_rej_runtime->pos_order_count(), 'rejected finalize does not create another order' );

$br07_div_runtime = br06_runtime();
$br07_div_plugin  = br07_plugin( $br07_div_runtime );
$br07_div         = br07_quote_and_prepare( $br07_div_plugin );
$br07_div_runtime->force_saved_total_minor = (int) $br07_div['prepared']['total']['minor'] + 50;
$br07_div_fin = br07_dispatch_finalize( $br07_div_plugin, br07_finalize_body( $br07_div['prepared'], $br07_div['body'] ), br07_headers( br06_next_uuid() ) );
br01_assert_eq( 'requires_attention', br07_code( $br07_div_fin ), 'Woo saved total mismatch is requires_attention' );
br01_assert_eq( 0, $br07_div_runtime->payment_complete_calls, 'divergent totals do not payment_complete' );

$br07_id_runtime = br06_runtime();
$br07_id_plugin  = br07_plugin( $br07_id_runtime );
$br07_id         = br07_quote_and_prepare( $br07_id_plugin );
foreach ( $br07_id_runtime->orders as $i => $row ) {
	if ( ! empty( $row['pos'] ) ) {
		$br07_id_runtime->orders[ $i ]['transaction_id'] = 'not-this-sale';
		$br07_id_runtime->orders[ $i ]['created_via']    = 'checkout';
	}
}
$br07_id_fin = br07_dispatch_finalize( $br07_id_plugin, br07_finalize_body( $br07_id['prepared'], $br07_id['body'] ), br07_headers( br06_next_uuid() ) );
br01_assert_eq( 'requires_attention', br07_code( $br07_id_fin ), 'Woo identity mismatch is requires_attention' );
br01_assert_eq( 0, $br07_id_runtime->payment_complete_calls, 'identity mismatch does not payment_complete' );

$br07_diff_paid_runtime = br06_runtime();
$br07_diff_paid_plugin  = br07_plugin( $br07_diff_paid_runtime );
$br07_diff_paid         = br07_quote_and_prepare( $br07_diff_paid_plugin );
$br07_diff_paid_runtime->mark_paid_with_payment( br06_last_pos_order( $br07_diff_paid_runtime )['id'], br06_next_uuid() );
$br07_diff_paid_fin = br07_dispatch_finalize( $br07_diff_paid_plugin, br07_finalize_body( $br07_diff_paid['prepared'], $br07_diff_paid['body'] ), br07_headers( br06_next_uuid() ) );
br01_assert_eq( 'requires_attention', br07_code( $br07_diff_paid_fin ), 'already paid different payment is requires_attention' );

$br07_same_paid_runtime = br06_runtime();
$br07_same_paid_plugin  = br07_plugin( $br07_same_paid_runtime );
$br07_same_paid         = br07_quote_and_prepare( $br07_same_paid_plugin );
$br07_same_body         = br07_finalize_body( $br07_same_paid['prepared'], $br07_same_paid['body'] );
$br07_same_paid_runtime->mark_paid_with_payment( br06_last_pos_order( $br07_same_paid_runtime )['id'], $br07_same_body['payment']['paymentId'] );
$br07_same_paid_fin = br07_dispatch_finalize( $br07_same_paid_plugin, $br07_same_body, br07_headers( br06_next_uuid() ) );
br01_assert_eq( 'completed', br07_code( $br07_same_paid_fin ), 'already paid same payment recovers completed' );
br01_assert_eq( 0, $br07_same_paid_runtime->payment_complete_calls, 'already-paid same payment does not payment_complete again' );

/* ---------------------------------------------------------------------------
 * Reused paymentId / evidenceId across sales
 * ------------------------------------------------------------------------ */

$br07_commands = new Cetech_Pos_Bridge_Command_Store();
$br07_reuse_a_runtime = br06_runtime();
$br07_reuse_a_stack   = br06_stack( $br07_reuse_a_runtime );
$br07_reuse_a_engine  = new Cetech_Pos_Bridge_Command_Engine( $br07_reuse_a_runtime, $br07_reuse_a_stack['claims'], $br07_commands );
$br07_reuse_a_quote   = $br07_reuse_a_stack['quotes']->quote( br06_quote_request() );
br01_assert( is_array( $br07_reuse_a_quote ) && isset( $br07_reuse_a_quote['id'] ), 'reuse sale A quote succeeds' );
$br07_reuse_a_body    = br06_prepare_body( $br07_reuse_a_quote );
$br07_reuse_a_prep    = $br07_reuse_a_stack['prep']->prepare( $br07_reuse_a_body, br06_next_uuid() );
br01_assert( is_array( $br07_reuse_a_prep ) && isset( $br07_reuse_a_prep['saleId'] ), 'reuse sale A prepare succeeds' );
$br07_shared_pay      = br06_next_uuid();
$br07_shared_ev       = br06_next_uuid();
$br07_reuse_a_fin     = $br07_reuse_a_engine->finalize( br07_finalize_body( $br07_reuse_a_prep, $br07_reuse_a_body, $br07_shared_pay, $br07_shared_ev ), br06_next_uuid() );
br01_assert_eq( 'completed', br07_engine_code( $br07_reuse_a_fin ), 'first sale completes with paymentId' );

$br07_reuse_b_runtime = br06_runtime();
$br07_reuse_b_stack   = br06_stack( $br07_reuse_b_runtime );
$br07_reuse_b_engine  = new Cetech_Pos_Bridge_Command_Engine( $br07_reuse_b_runtime, $br07_reuse_b_stack['claims'], $br07_commands );
$br07_reuse_b_quote   = $br07_reuse_b_stack['quotes']->quote( br06_quote_request() );
br01_assert( is_array( $br07_reuse_b_quote ) && isset( $br07_reuse_b_quote['id'] ), 'reuse sale B quote succeeds' );
$br07_reuse_b_body    = br06_prepare_body( $br07_reuse_b_quote );
$br07_reuse_b_prep    = $br07_reuse_b_stack['prep']->prepare( $br07_reuse_b_body, br06_next_uuid() );
$br07_reuse_pay       = $br07_reuse_b_engine->finalize( br07_finalize_body( $br07_reuse_b_prep, $br07_reuse_b_body, $br07_shared_pay, br06_next_uuid() ), br06_next_uuid() );
br01_assert_eq( 'PAYMENT_NOT_VERIFIED', br07_engine_code( $br07_reuse_pay ), 'reused paymentId on another sale is rejected' );

$br07_reuse_c_runtime = br06_runtime();
$br07_reuse_c_stack   = br06_stack( $br07_reuse_c_runtime );
$br07_reuse_c_engine  = new Cetech_Pos_Bridge_Command_Engine( $br07_reuse_c_runtime, $br07_reuse_c_stack['claims'], $br07_commands );
$br07_reuse_c_quote   = $br07_reuse_c_stack['quotes']->quote( br06_quote_request() );
br01_assert( is_array( $br07_reuse_c_quote ) && isset( $br07_reuse_c_quote['id'] ), 'reuse sale C quote succeeds' );
$br07_reuse_c_body    = br06_prepare_body( $br07_reuse_c_quote );
$br07_reuse_c_prep    = $br07_reuse_c_stack['prep']->prepare( $br07_reuse_c_body, br06_next_uuid() );
$br07_reuse_ev        = $br07_reuse_c_engine->finalize( br07_finalize_body( $br07_reuse_c_prep, $br07_reuse_c_body, br06_next_uuid(), $br07_shared_ev ), br06_next_uuid() );
br01_assert_eq( 'PAYMENT_NOT_VERIFIED', br07_engine_code( $br07_reuse_ev ), 'reused evidenceId on another sale is rejected' );
br01_assert_eq( 1, $br07_reuse_a_runtime->payment_complete_calls, 'reused identities do not complete a second sale' );
br01_assert_eq( 0, $br07_reuse_b_runtime->payment_complete_calls, 'reused paymentId sale B has no payment_complete' );
br01_assert_eq( 0, $br07_reuse_c_runtime->payment_complete_calls, 'reused evidenceId sale C has no payment_complete' );

/* ---------------------------------------------------------------------------
 * Non-cash evidence shape (no provider execution)
 * ------------------------------------------------------------------------ */

$br07_mm_runtime = br06_runtime();
$br07_mm_plugin  = br07_plugin( $br07_mm_runtime );
$br07_mm         = br07_quote_and_prepare( $br07_mm_plugin );
$br07_mm_body    = br07_finalize_body( $br07_mm['prepared'], $br07_mm['body'] );
$br07_mm_body['payment']['tender']             = 'mobile_money';
$br07_mm_body['payment']['verificationSource'] = 'provider_server_verification';
$violation = Cetech_Pos_Bridge_Schema::instance()->validate( $br07_mm_body, 'BridgeFinalizeRequest' );
br01_assert_eq( null, $violation, 'mobile_money VerifiedPaymentEvidence satisfies schema' );
$br07_mm_fin = br07_dispatch_finalize( $br07_mm_plugin, $br07_mm_body, br07_headers( br06_next_uuid() ) );
br01_assert_eq( 'completed', br07_code( $br07_mm_fin ), 'non-cash verified evidence finalizes without a provider call' );
br01_assert_eq( 1, $br07_mm_runtime->payment_complete_calls, 'non-cash evidence still payment_complete once locally' );

$br07_card = $br07_mm_body;
$br07_card['payment']['tender'] = 'card';
br01_assert_eq( null, Cetech_Pos_Bridge_Schema::instance()->validate( $br07_card, 'BridgeFinalizeRequest' ), 'card evidence satisfies schema' );
$br07_ext = $br07_mm_body;
$br07_ext['payment']['tender'] = 'external_electronic';
br01_assert_eq( null, Cetech_Pos_Bridge_Schema::instance()->validate( $br07_ext, 'BridgeFinalizeRequest' ), 'external_electronic evidence satisfies schema' );

/* ---------------------------------------------------------------------------
 * Crash recovery F1–F3 + ambiguous exception
 * ------------------------------------------------------------------------ */

$br07_f1_runtime = br06_runtime();
$br07_f1_plugin  = br07_plugin( $br07_f1_runtime );
$br07_f1         = br07_quote_and_prepare( $br07_f1_plugin );
$br07_f1_body    = br07_finalize_body( $br07_f1['prepared'], $br07_f1['body'] );
$br07_f1_key     = br06_next_uuid();
$br07_f1_plugin->get_command_engine()->after_finalize_claim = br07_thrower( 'F1' );
$br07_f1_crashed = false;
try {
	$br07_f1_plugin->get_command_engine()->finalize( $br07_f1_body, $br07_f1_key );
} catch ( RuntimeException $e ) {
	$br07_f1_crashed = ( $e->getMessage() === 'F1' );
}
br01_assert( $br07_f1_crashed, 'F1 seam fired after finalize claim before Woo payment' );
br01_assert_eq( 0, $br07_f1_runtime->payment_complete_calls, 'F1 does not payment_complete' );
$br07_f1_retry = $br07_f1_plugin->get_command_engine()->finalize( $br07_f1_body, $br07_f1_key );
br01_assert_eq( 'completed', br07_engine_code( $br07_f1_retry ), 'F1 retry completes' );
br01_assert_eq( 1, $br07_f1_runtime->payment_complete_calls, 'F1 retry payment_complete once' );
br01_assert_eq( 1, $br07_f1_runtime->pos_order_count(), 'F1 retry no second order' );

$br07_f2_runtime = br06_runtime();
$br07_f2_plugin  = br07_plugin( $br07_f2_runtime );
$br07_f2         = br07_quote_and_prepare( $br07_f2_plugin );
$br07_f2_body    = br07_finalize_body( $br07_f2['prepared'], $br07_f2['body'] );
$br07_f2_key     = br06_next_uuid();
$br07_f2_runtime->after_payment_binding = br07_thrower( 'F2' );
$br07_f2_crashed = false;
try {
	$br07_f2_plugin->get_command_engine()->finalize( $br07_f2_body, $br07_f2_key );
} catch ( RuntimeException $e ) {
	$br07_f2_crashed = ( $e->getMessage() === 'F2' );
}
br01_assert( $br07_f2_crashed, 'F2 seam fired after payment binding before payment_complete' );
br01_assert_eq( 0, $br07_f2_runtime->payment_complete_calls, 'F2 does not payment_complete' );
$br07_f2_retry = $br07_f2_plugin->get_command_engine()->finalize( $br07_f2_body, $br07_f2_key );
br01_assert_eq( 'completed', br07_engine_code( $br07_f2_retry ), 'F2 retry completes' );
br01_assert_eq( 1, $br07_f2_runtime->payment_complete_calls, 'F2 retry payment_complete once' );

$br07_f3_runtime = br06_runtime();
$br07_f3_plugin  = br07_plugin( $br07_f3_runtime );
$br07_f3         = br07_quote_and_prepare( $br07_f3_plugin );
$br07_f3_body    = br07_finalize_body( $br07_f3['prepared'], $br07_f3['body'] );
$br07_f3_key     = br06_next_uuid();
$br07_f3_runtime->after_payment_complete = br07_thrower( 'F3' );
$br07_f3_crashed = false;
try {
	$br07_f3_plugin->get_command_engine()->finalize( $br07_f3_body, $br07_f3_key );
} catch ( RuntimeException $e ) {
	$br07_f3_crashed = ( $e->getMessage() === 'F3' );
}
br01_assert( $br07_f3_crashed, 'F3 seam fired after payment_complete before outcome persist' );
br01_assert_eq( 1, $br07_f3_runtime->payment_complete_calls, 'F3 already payment_complete once' );
$br07_f3_retry = $br07_f3_plugin->get_command_engine()->finalize( $br07_f3_body, $br07_f3_key );
br01_assert_eq( 'completed', br07_engine_code( $br07_f3_retry ), 'F3 retry recovers completed' );
br01_assert_eq( 1, $br07_f3_runtime->payment_complete_calls, 'F3 retry does not payment_complete again' );
br01_assert_eq( 1, $br07_f3_runtime->stock_reduce_calls, 'F3 retry does not reduce stock again' );

$br07_f4_runtime = br06_runtime();
$br07_f4_plugin  = br07_plugin( $br07_f4_runtime );
$br07_f4         = br07_quote_and_prepare( $br07_f4_plugin );
$br07_f4_body    = br07_finalize_body( $br07_f4['prepared'], $br07_f4['body'] );
$br07_f4_runtime->throw_after_payment_complete = true;
$br07_f4_res = $br07_f4_plugin->get_command_engine()->finalize( $br07_f4_body, br06_next_uuid() );
br01_assert_eq( 'completed', br07_engine_code( $br07_f4_res ), 'ambiguous exception after proven same payment recovers completed' );
br01_assert_eq( 1, $br07_f4_runtime->payment_complete_calls, 'ambiguous recovery does not complete twice' );

/* ---------------------------------------------------------------------------
 * Expired reservation + verified money; cancelled + late payment
 * ------------------------------------------------------------------------ */

$br07_exp_runtime = br06_runtime();
$br07_exp_plugin  = br07_plugin( $br07_exp_runtime );
$br07_exp         = br07_quote_and_prepare( $br07_exp_plugin );
$br07_exp_runtime->expire_reservations( br06_last_pos_order( $br07_exp_runtime )['id'] );
$br07_exp_fin = br07_dispatch_finalize( $br07_exp_plugin, br07_finalize_body( $br07_exp['prepared'], $br07_exp['body'] ), br07_headers( br06_next_uuid() ) );
br01_assert_eq( 'requires_attention', br07_code( $br07_exp_fin ), 'expired reservation + verified money is requires_attention' );
br01_assert_eq( 0, $br07_exp_runtime->payment_complete_calls, 'expired reservation does not blindly payment_complete' );

$br07_late_runtime = br06_runtime();
$br07_late_plugin  = br07_plugin( $br07_late_runtime );
$br07_late         = br07_quote_and_prepare( $br07_late_plugin );
$br07_late_cancel  = br07_dispatch_cancel(
	$br07_late_plugin,
	array( 'transactionId' => $br07_late['body']['transactionId'], 'reason' => 'customer abandoned' ),
	br07_headers( br06_next_uuid() )
);
br01_assert_eq( 'cancelled', br07_code( $br07_late_cancel ), 'unpaid prepared sale cancels' );
$br07_late_fin = br07_dispatch_finalize( $br07_late_plugin, br07_finalize_body( $br07_late['prepared'], $br07_late['body'] ), br07_headers( br06_next_uuid() ) );
br01_assert_eq( 'requires_attention', br07_code( $br07_late_fin ), 'cancelled order + late verified payment is requires_attention' );
br01_assert_eq( 1, $br07_late_runtime->pos_order_count(), 'late success does not create a second order' );
br01_assert_eq( 0, $br07_late_runtime->payment_complete_calls, 'late success does not silently reopen money' );

/* ---------------------------------------------------------------------------
 * Concurrent same-finalize (in-memory interleaving, not DB concurrency)
 * ------------------------------------------------------------------------ */

$br07_c_runtime = br06_runtime();
$br07_c_plugin  = br07_plugin( $br07_c_runtime );
$br07_c         = br07_quote_and_prepare( $br07_c_plugin );
$br07_c_body    = br07_finalize_body( $br07_c['prepared'], $br07_c['body'] );
$br07_c_key     = br06_next_uuid();
$br07_c_nested  = null;
$br07_c_plugin->get_command_engine()->after_finalize_claim = function ( $engine ) use ( $br07_c_body, $br07_c_key, &$br07_c_nested ) {
	$br07_c_nested = $engine->finalize( $br07_c_body, $br07_c_key );
};
$br07_c_first = $br07_c_plugin->get_command_engine()->finalize( $br07_c_body, $br07_c_key );
br01_assert_eq( 'OPERATION_IN_PROGRESS', br07_engine_code( $br07_c_nested ), 'concurrent same-finalize nested call is in progress' );
br01_assert_eq( 'completed', br07_engine_code( $br07_c_first ), 'concurrent same-finalize winner completes' );
br01_assert_eq( 1, $br07_c_runtime->payment_complete_calls, 'concurrent same-finalize one commercial effect' );

$br07_cc_runtime = br06_runtime();
$br07_cc_plugin  = br07_plugin( $br07_cc_runtime );
$br07_cc         = br07_quote_and_prepare( $br07_cc_plugin );
$br07_cc_body    = array( 'transactionId' => $br07_cc['body']['transactionId'], 'reason' => 'concurrent-cancel' );
$br07_cc_key     = br06_next_uuid();
$br07_cc_nested  = null;
$br07_cc_plugin->get_command_engine()->after_cancel_claim = function ( $engine ) use ( $br07_cc_body, $br07_cc_key, &$br07_cc_nested ) {
	$br07_cc_nested = $engine->cancel( $br07_cc_body, $br07_cc_key );
};
$br07_cc_first = $br07_cc_plugin->get_command_engine()->cancel( $br07_cc_body, $br07_cc_key );
br01_assert_eq( 'OPERATION_IN_PROGRESS', br07_engine_code( $br07_cc_nested ), 'concurrent same-cancel nested call is in progress' );
br01_assert_eq( 'cancelled', br07_engine_code( $br07_cc_first ), 'concurrent same-cancel winner cancels' );
br01_assert_eq( 1, $br07_cc_runtime->order_cancel_calls, 'concurrent same-cancel one Woo cancel' );
br01_assert_eq( 1, $br07_cc_runtime->reservation_release_calls, 'concurrent same-cancel one reservation release' );

/* ---------------------------------------------------------------------------
 * Cancel matrix
 * ------------------------------------------------------------------------ */

$br07_can_runtime = br06_runtime();
$br07_can_plugin  = br07_plugin( $br07_can_runtime );
$br07_can         = br07_quote_and_prepare( $br07_can_plugin );
$br07_can_body    = array( 'transactionId' => $br07_can['body']['transactionId'], 'reason' => 'customer left' );
$br07_can_extra   = $br07_can_body;
$br07_can_extra['note'] = 'nope';
br01_assert_eq( 'VALIDATION_ERROR', br07_code( br07_dispatch_cancel( $br07_can_plugin, $br07_can_extra, br07_headers( br06_next_uuid() ) ) ), 'CancelSaleRequest extra field rejected' );
br01_assert_eq( 'VALIDATION_ERROR', br07_code( br07_dispatch_cancel( $br07_can_plugin, array( 'transactionId' => $br07_can['body']['transactionId'], 'reason' => '' ), br07_headers( br06_next_uuid() ) ) ), 'empty reason rejected' );
br01_assert_eq( 'VALIDATION_ERROR', br07_code( br07_dispatch_cancel( $br07_can_plugin, array( 'transactionId' => $br07_can['body']['transactionId'], 'reason' => str_repeat( 'x', 501 ) ), br07_headers( br06_next_uuid() ) ) ), 'reason >500 rejected' );
br01_assert_eq( 'NOT_FOUND', br07_code( br07_dispatch_cancel( $br07_can_plugin, array( 'transactionId' => br06_next_uuid(), 'reason' => 'gone' ), br07_headers( br06_next_uuid() ) ) ), 'unknown cancel transaction is NOT_FOUND' );

$br07_can_key = br06_next_uuid();
$br07_can_ok  = br07_dispatch_cancel( $br07_can_plugin, $br07_can_body, br07_headers( $br07_can_key ) );
br01_assert_eq( 'cancelled', br07_code( $br07_can_ok ), 'valid prepared/unpaid reserved sale cancels' );
br01_assert_eq( 1, $br07_can_runtime->reservation_release_calls, 'cancel releases reservation once' );
br01_assert_eq( 1, $br07_can_runtime->order_cancel_calls, 'cancel marks Woo cancelled once' );
$br07_can_replay = br07_dispatch_cancel( $br07_can_plugin, $br07_can_body, br07_headers( $br07_can_key ) );
br01_assert_eq( 'cancelled', br07_code( $br07_can_replay ), 'same-key cancel replay' );
br01_assert_eq( br07_data( $br07_can_ok ), br07_data( $br07_can_replay ), 'cancel replay SaleResolution identical' );
br01_assert_eq( 1, $br07_can_runtime->reservation_release_calls, 'repeated cancel does not release stock twice' );
$br07_can_diff = $br07_can_body;
$br07_can_diff['reason'] = 'other reason';
br01_assert_eq( 'IDEMPOTENCY_CONFLICT', br07_code( br07_dispatch_cancel( $br07_can_plugin, $br07_can_diff, br07_headers( $br07_can_key ) ) ), 'same key different reason is IDEMPOTENCY_CONFLICT' );

$br07_before_can_get = $br07_can_runtime->snapshot_woo_state();
$br07_can_resolve    = br06_dispatch_resolve( $br07_can_plugin, $br07_can['body']['transactionId'], array( 'X-Correlation-ID' => $br07_corr ) );
br01_assert_eq( 'cancelled', br07_code( $br07_can_resolve ), 'GET after cancel is cancelled' );
br06_assert_woo_frozen( $br07_can_runtime, $br07_before_can_get, 'GET after cancelled' );

$br07_paid_block_runtime = br06_runtime();
$br07_paid_block_plugin  = br07_plugin( $br07_paid_block_runtime );
$br07_paid_block         = br07_quote_and_prepare( $br07_paid_block_plugin );
br07_dispatch_finalize( $br07_paid_block_plugin, br07_finalize_body( $br07_paid_block['prepared'], $br07_paid_block['body'] ), br07_headers( br06_next_uuid() ) );
$br07_paid_cancel = br07_dispatch_cancel(
	$br07_paid_block_plugin,
	array( 'transactionId' => $br07_paid_block['body']['transactionId'], 'reason' => 'too late' ),
	br07_headers( br06_next_uuid() )
);
br01_assert_eq( 'PAYMENT_PENDING', br07_code( $br07_paid_cancel ), 'completed/paid sale blocks cancel' );
br01_assert_eq( 0, $br07_paid_block_runtime->reservation_release_calls, 'paid cancel does not release stock' );

$br07_ev_runtime = br06_runtime();
$br07_ev_plugin  = br07_plugin( $br07_ev_runtime );
$br07_ev         = br07_quote_and_prepare( $br07_ev_plugin );
$br07_ev_body    = br07_finalize_body( $br07_ev['prepared'], $br07_ev['body'] );
$br07_ev_runtime->after_payment_binding = br07_thrower( 'evidence-bound' );
try {
	$br07_ev_plugin->get_command_engine()->finalize( $br07_ev_body, br06_next_uuid() );
} catch ( RuntimeException $e ) {
	unset( $e );
}
$br07_ev_cancel = br07_dispatch_cancel(
	$br07_ev_plugin,
	array( 'transactionId' => $br07_ev['body']['transactionId'], 'reason' => 'abort' ),
	br07_headers( br06_next_uuid() )
);
br01_assert_eq( 'PAYMENT_PENDING', br07_code( $br07_ev_cancel ), 'verified finalize evidence bound on Woo blocks cancel' );

$br07_exp_can_runtime = br06_runtime();
$br07_exp_can_plugin  = br07_plugin( $br07_exp_can_runtime );
$br07_exp_can         = br07_quote_and_prepare( $br07_exp_can_plugin );
$br07_exp_can_runtime->expire_reservations( br06_last_pos_order( $br07_exp_can_runtime )['id'] );
$br07_exp_can_ok = br07_dispatch_cancel(
	$br07_exp_can_plugin,
	array( 'transactionId' => $br07_exp_can['body']['transactionId'], 'reason' => 'expired hold' ),
	br07_headers( br06_next_uuid() )
);
br01_assert_eq( 'cancelled', br07_code( $br07_exp_can_ok ), 'expired reservation + unpaid cancel still cancels' );
br01_assert_eq( 0, $br07_exp_can_runtime->reservation_release_calls, 'expired reservation cancel does not invent a release effect' );

$br07_red_runtime = br06_runtime();
$br07_red_plugin  = br07_plugin( $br07_red_runtime );
$br07_red         = br07_quote_and_prepare( $br07_red_plugin );
$br07_red_runtime->mark_stock_reduced_unpaid( br06_last_pos_order( $br07_red_runtime )['id'] );
$br07_red_cancel = br07_dispatch_cancel(
	$br07_red_plugin,
	array( 'transactionId' => $br07_red['body']['transactionId'], 'reason' => 'unsafe' ),
	br07_headers( br06_next_uuid() )
);
br01_assert_eq( 'requires_attention', br07_code( $br07_red_cancel ), 'unexpected reduced-stock unpaid state fails closed' );

/* ---------------------------------------------------------------------------
 * Cancel crash C1–C3
 * ------------------------------------------------------------------------ */

$br07_c1_runtime = br06_runtime();
$br07_c1_plugin  = br07_plugin( $br07_c1_runtime );
$br07_c1         = br07_quote_and_prepare( $br07_c1_plugin );
$br07_c1_body    = array( 'transactionId' => $br07_c1['body']['transactionId'], 'reason' => 'crash-c1' );
$br07_c1_key     = br06_next_uuid();
$br07_c1_plugin->get_command_engine()->after_cancel_claim = br07_thrower( 'C1' );
$br07_c1_hit = false;
try {
	$br07_c1_plugin->get_command_engine()->cancel( $br07_c1_body, $br07_c1_key );
} catch ( RuntimeException $e ) {
	$br07_c1_hit = ( $e->getMessage() === 'C1' );
}
br01_assert( $br07_c1_hit, 'C1 seam fired' );
br01_assert_eq( 0, $br07_c1_runtime->order_cancel_calls, 'C1 does not cancel Woo' );
$br07_c1_retry = $br07_c1_plugin->get_command_engine()->cancel( $br07_c1_body, $br07_c1_key );
br01_assert_eq( 'cancelled', br07_engine_code( $br07_c1_retry ), 'C1 retry cancels' );
br01_assert_eq( 1, $br07_c1_runtime->pos_order_count(), 'C1 retry no second order' );

$br07_c2_runtime = br06_runtime();
$br07_c2_plugin  = br07_plugin( $br07_c2_runtime );
$br07_c2         = br07_quote_and_prepare( $br07_c2_plugin );
$br07_c2_body    = array( 'transactionId' => $br07_c2['body']['transactionId'], 'reason' => 'crash-c2' );
$br07_c2_key     = br06_next_uuid();
$br07_c2_runtime->after_reservation_release = br07_thrower( 'C2' );
$br07_c2_hit = false;
try {
	$br07_c2_plugin->get_command_engine()->cancel( $br07_c2_body, $br07_c2_key );
} catch ( RuntimeException $e ) {
	$br07_c2_hit = ( $e->getMessage() === 'C2' );
}
br01_assert( $br07_c2_hit, 'C2 seam fired after reservation release' );
br01_assert_eq( 0, $br07_c2_runtime->order_cancel_calls, 'C2 has not persisted cancelled yet' );
$br07_c2_retry = $br07_c2_plugin->get_command_engine()->cancel( $br07_c2_body, $br07_c2_key );
br01_assert_eq( 'cancelled', br07_engine_code( $br07_c2_retry ), 'C2 retry cancels' );
br01_assert_eq( 1, $br07_c2_runtime->reservation_release_calls, 'C2 retry does not release twice' );

$br07_c3_runtime = br06_runtime();
$br07_c3_plugin  = br07_plugin( $br07_c3_runtime );
$br07_c3         = br07_quote_and_prepare( $br07_c3_plugin );
$br07_c3_body    = array( 'transactionId' => $br07_c3['body']['transactionId'], 'reason' => 'crash-c3' );
$br07_c3_key     = br06_next_uuid();
$br07_c3_runtime->after_order_cancelled = br07_thrower( 'C3' );
$br07_c3_hit = false;
try {
	$br07_c3_plugin->get_command_engine()->cancel( $br07_c3_body, $br07_c3_key );
} catch ( RuntimeException $e ) {
	$br07_c3_hit = ( $e->getMessage() === 'C3' );
}
br01_assert( $br07_c3_hit, 'C3 seam fired after order cancelled' );
$br07_c3_retry = $br07_c3_plugin->get_command_engine()->cancel( $br07_c3_body, $br07_c3_key );
br01_assert_eq( 'cancelled', br07_engine_code( $br07_c3_retry ), 'C3 retry recovers cancelled' );
br01_assert_eq( 1, $br07_c3_runtime->order_cancel_calls, 'C3 retry does not cancel twice' );

/* ---------------------------------------------------------------------------
 * Finalize vs cancel race (deterministic interleaving, not DB concurrency)
 * ------------------------------------------------------------------------ */

$br07_fw_runtime = br06_runtime();
$br07_fw_plugin  = br07_plugin( $br07_fw_runtime );
$br07_fw         = br07_quote_and_prepare( $br07_fw_plugin );
$br07_fw_fin     = br07_finalize_body( $br07_fw['prepared'], $br07_fw['body'] );
$br07_fw_can     = array( 'transactionId' => $br07_fw['body']['transactionId'], 'reason' => 'race-cancel' );
$br07_fw_can_key = br06_next_uuid();
$br07_fw_nested  = null;
$br07_fw_plugin->get_command_engine()->after_finalize_claim = function ( $engine ) use ( $br07_fw_can, $br07_fw_can_key, &$br07_fw_nested ) {
	$br07_fw_nested = $engine->cancel( $br07_fw_can, $br07_fw_can_key );
};
$br07_fw_done = $br07_fw_plugin->get_command_engine()->finalize( $br07_fw_fin, br06_next_uuid() );
br01_assert_eq( 'completed', br07_engine_code( $br07_fw_done ), 'finalize-wins race completes payment' );
br01_assert_eq( 'OPERATION_IN_PROGRESS', br07_engine_code( $br07_fw_nested ), 'finalize-wins nested cancel is in progress while lock held' );
$br07_fw_after = $br07_fw_plugin->get_command_engine()->cancel( $br07_fw_can, $br07_fw_can_key );
br01_assert_eq( 'PAYMENT_PENDING', br07_engine_code( $br07_fw_after ), 'finalize-wins later cancel is blocked' );
br01_assert_eq( 1, $br07_fw_runtime->payment_complete_calls, 'finalize-wins payment once' );
br01_assert_eq( 1, $br07_fw_runtime->stock_reduce_calls, 'finalize-wins stock once' );
br01_assert_eq( 0, $br07_fw_runtime->reservation_release_calls, 'finalize-wins cancel does not release' );

$br07_cw_runtime = br06_runtime();
$br07_cw_plugin  = br07_plugin( $br07_cw_runtime );
$br07_cw         = br07_quote_and_prepare( $br07_cw_plugin );
$br07_cw_fin     = br07_finalize_body( $br07_cw['prepared'], $br07_cw['body'] );
$br07_cw_can     = array( 'transactionId' => $br07_cw['body']['transactionId'], 'reason' => 'race-finalize' );
$br07_cw_fin_key = br06_next_uuid();
$br07_cw_nested  = null;
$br07_cw_plugin->get_command_engine()->after_cancel_claim = function ( $engine ) use ( $br07_cw_fin, $br07_cw_fin_key, &$br07_cw_nested ) {
	$br07_cw_nested = $engine->finalize( $br07_cw_fin, $br07_cw_fin_key );
};
$br07_cw_done = $br07_cw_plugin->get_command_engine()->cancel( $br07_cw_can, br06_next_uuid() );
br01_assert_eq( 'cancelled', br07_engine_code( $br07_cw_done ), 'cancel-wins race cancels unpaid sale' );
br01_assert_eq( 'OPERATION_IN_PROGRESS', br07_engine_code( $br07_cw_nested ), 'cancel-wins nested finalize is in progress while lock held' );
$br07_cw_late = $br07_cw_plugin->get_command_engine()->finalize( $br07_cw_fin, $br07_cw_fin_key );
br01_assert_eq( 'requires_attention', br07_engine_code( $br07_cw_late ), 'cancel-wins late payment is requires_attention' );
br01_assert_eq( 1, $br07_cw_runtime->pos_order_count(), 'cancel-wins no second order' );
br01_assert_eq( 0, $br07_cw_runtime->payment_complete_calls, 'cancel-wins late finalize does not payment_complete' );

$br07_closed = array(
	'transactionId' => $br07_cw['body']['transactionId'],
	'status'        => 'completed',
	'saleId'        => $br07_cw['prepared']['saleId'],
	'orderReference'=> $br07_cw['prepared']['orderReference'],
	'paymentId'     => br06_next_uuid(),
	'unexpected'    => true,
);
br01_assert( Cetech_Pos_Bridge_Schema::instance()->validate( $br07_closed, 'SaleResolution' ) !== null, 'SaleResolution closed schema rejects unexpected fields' );
