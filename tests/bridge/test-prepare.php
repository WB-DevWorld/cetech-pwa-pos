<?php
/**
 * BR-06 / issue #18 — HPOS-safe idempotent prepare and resolve.
 *
 * Local PHP assertions against an injected Woo runtime. Not live WordPress/Woo
 * evidence. Does not set pricingParityVerified. Database uniqueness is proven
 * by the CREATE TABLE UNIQUE indexes; in-memory interleaving is not a DB
 * concurrency PASS.
 */

$br06_corr     = '550e8400-e29b-41d4-a716-446655440070';
$br06_location = 'loc-training-1';
$br06_seq      = 70;

function br06_uuid( $n ) {
	return sprintf( 'aaaaaaaa-aaaa-4aaa-8aaa-%012d', (int) $n );
}

function br06_next_uuid() {
	global $br06_seq;
	++$br06_seq;
	return br06_uuid( $br06_seq );
}

function br06_runtime() {
	$env              = br01_authorized_env();
	$runtime          = new Cetech_Pos_Bridge_Fake_Woo_Runtime( $env );
	$runtime->bag_key = 'cetech_pos_fake_wc_br06_' . bin2hex( random_bytes( 4 ) );
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
	$runtime->stock['101']                                = 10;
	$runtime->hold_stock_minutes                          = 60;
	return $runtime;
}

function br06_stack( Cetech_Pos_Bridge_Fake_Woo_Runtime $runtime ) {
	$store  = new Cetech_Pos_Bridge_Quote_Store();
	$quotes = new Cetech_Pos_Bridge_Quote_Engine( $runtime, $store );
	$claims = new Cetech_Pos_Bridge_Claim_Store();
	$prep   = new Cetech_Pos_Bridge_Prepare_Engine( $runtime, $quotes, $store, $claims );
	return array(
		'quotes' => $quotes,
		'prep'   => $prep,
		'claims' => $claims,
		'store'  => $store,
	);
}

function br06_quote_request() {
	return array(
		'cartId'       => br06_next_uuid(),
		'cartRevision' => 1,
		'customer'     => array( 'kind' => 'walkin' ),
		'locationId'   => $GLOBALS['br06_location'],
		'lines'        => array(
			array(
				'lineId'    => br06_next_uuid(),
				'productId' => '101',
				'quantity'  => '1',
			),
		),
	);
}

function br06_prepare_body( array $quote, $transaction_id = null ) {
	return array(
		'transactionId'    => $transaction_id !== null ? $transaction_id : br06_next_uuid(),
		'registerId'       => 'reg-training-1',
		'shiftId'          => br06_next_uuid(),
		'deviceId'         => br06_next_uuid(),
		'quoteId'          => $quote['id'],
		'quoteFingerprint' => $quote['fingerprint'],
	);
}

function br06_headers( $idempotency_key ) {
	return array(
		'X-Correlation-ID' => $GLOBALS['br06_corr'],
		'Idempotency-Key'  => $idempotency_key,
	);
}

function br06_dispatch_prepare( Cetech_Pos_Bridge_Plugin $plugin, array $body, array $headers ) {
	$controller = $plugin->get_prepare_controller();
	$request    = new Cetech_Pos_Bridge_Test_Request( $headers, '/cetech-pos/v1/sales/prepare', $body );
	$permission = $controller->permission_callback( $request );
	if ( $permission !== true ) {
		return $plugin->normalize_error_response( $permission, null, $request );
	}
	return $controller->handle( $request );
}

function br06_dispatch_resolve( Cetech_Pos_Bridge_Plugin $plugin, $transaction_id, array $headers ) {
	$controller = $plugin->get_resolve_controller();
	$request    = new Cetech_Pos_Bridge_Test_Request(
		$headers,
		'/cetech-pos/v1/sales/' . $transaction_id,
		array(),
		array( 'transactionId' => $transaction_id )
	);
	$permission = $controller->permission_callback( $request );
	if ( $permission !== true ) {
		return $plugin->normalize_error_response( $permission, null, $request );
	}
	return $controller->handle( $request );
}

function br06_error_code( $result ) {
	if ( Cetech_Pos_Bridge_Quote_Request::is_error( $result ) ) {
		return $result->get_error_code();
	}
	return null;
}

function br06_thrower( $message ) {
	return function () use ( $message ) {
		throw new RuntimeException( $message );
	};
}

function br06_prepare_crashed( $prep, array $body, $key, $message ) {
	$crashed = false;
	try {
		$prep->prepare( $body, $key );
	} catch ( RuntimeException $e ) {
		$crashed = ( $e->getMessage() === $message );
	}
	br01_assert( $crashed, $message . ' seam fired' );
}

function br06_order_reserved( Cetech_Pos_Bridge_Fake_Woo_Runtime $runtime ) {
	foreach ( $runtime->orders as $order ) {
		if ( ! empty( $order['pos'] ) && ! empty( $order['reserved'] ) ) {
			return true;
		}
	}
	return false;
}

function br06_assert_honest_commitment( $result, Cetech_Pos_Bridge_Fake_Woo_Runtime $runtime, $label ) {
	if ( is_array( $result ) && isset( $result['stockCommitment'] ) ) {
		br01_assert(
			$result['stockCommitment'] === 'reserved' || $result['stockCommitment'] === 'reduced',
			$label . ' reports only a contract stockCommitment'
		);
		br01_assert( br06_order_reserved( $runtime ), $label . ' reports reserved only when reservation is proven' );
	}
}

$br06_schema = Cetech_Pos_Bridge_Schema::instance();

/* ---------------------------------------------------------------------------
 * Contract / hashing / SQL uniqueness (not live DB concurrency)
 * ------------------------------------------------------------------------ */

$hash_a = Cetech_Pos_Bridge_Request_Hash::hash( array( 'b' => 1, 'a' => array( 'z' => 2, 'y' => 3 ) ) );
$hash_b = Cetech_Pos_Bridge_Request_Hash::hash( array( 'a' => array( 'y' => 3, 'z' => 2 ), 'b' => 1 ) );
br01_assert_eq( $hash_a, $hash_b, 'semantic request hash is key-order independent' );
br01_assert_eq( 64, strlen( $hash_a ), 'request hash is SHA-256 hex' );

$sql = Cetech_Pos_Bridge_Schema_Install::create_table_sql( 'wp_cetech_pos_prepare_claims' );
br01_assert( strpos( $sql, 'UNIQUE KEY uniq_idempotency (site_scope, operation_type, idempotency_key)' ) !== false, 'claim table UNIQUE idempotency identity' );
br01_assert( strpos( $sql, 'UNIQUE KEY uniq_transaction (site_scope, transaction_id)' ) !== false, 'claim table UNIQUE transaction identity' );
br01_assert( strpos( $sql, 'woo_create_entered tinyint(1) NOT NULL DEFAULT 0' ) !== false, 'claim table persists woo_create_entered before wc_create_order' );
br01_assert_eq( '2', Cetech_Pos_Bridge_Constants::DB_VERSION, 'claim schema version includes woo_create_entered' );
br01_assert_eq( $sql, Cetech_Pos_Bridge_Schema_Install::create_table_sql( 'wp_cetech_pos_prepare_claims' ), 'CREATE TABLE SQL is deterministic across calls' );
br01_assert_eq( 'wp_cetech_pos_prepare_claims', Cetech_Pos_Bridge_Schema_Install::table_name( (object) array( 'prefix' => 'wp_' ) ), 'bridge-owned table name' );

$install_src = file_get_contents( dirname( __DIR__, 2 ) . '/wordpress/cetech-pos-bridge/includes/class-schema-install.php' );
br01_assert( strpos( $install_src, 'function maybe_upgrade' ) !== false, 'install has a version-gated maybe_upgrade' );
br01_assert( strpos( $install_src, 'cetech_pos_bridge_db_version' ) !== false, 'install versions the claim table' );

$woo_src = file_get_contents( dirname( __DIR__, 2 ) . '/wordpress/cetech-pos-bridge/includes/class-woo-runtime.php' );
br01_assert( strpos( $woo_src, 'wp_insert_post' ) === false, 'production Woo runtime does not wp_insert_post' );
br01_assert( ! preg_match( '/\$wpdb->(insert|update|query).*(posts|postmeta)/', $woo_src ), 'production Woo runtime does not write legacy post tables' );
br01_assert( strpos( $woo_src, 'wc_create_order' ) !== false, 'production create uses wc_create_order' );
br01_assert( strpos( $woo_src, 'update_meta_data' ) !== false, 'production recovery meta uses Woo CRUD' );
br01_assert( strpos( $woo_src, 'wc_reserve_stock_for_order' ) !== false, 'production stock uses wc_reserve_stock_for_order' );
br01_assert( strpos( $woo_src, 'wc_get_orders' ) !== false, 'production recovery lookup uses wc_get_orders' );
br01_assert( strpos( $woo_src, 'after_wc_create' ) !== false, 'production exposes crash seam A after wc_create_order' );
br01_assert( strpos( $woo_src, 'after_meta_save' ) !== false, 'production exposes crash seam B after recovery metadata save' );
br01_assert( strpos( $woo_src, 'wc_reserved_stock' ) !== false, 'production proves reservation from Woo reserved-stock state' );

$prep_src = file_get_contents( dirname( __DIR__, 2 ) . '/wordpress/cetech-pos-bridge/includes/class-prepare-engine.php' );
br01_assert( strpos( $prep_src, 'wp_insert_post' ) === false, 'prepare engine does not insert posts' );
br01_assert( strpos( $prep_src, 'wc_update_product_stock' ) === false, 'prepare engine does not decrement _stock itself' );
br01_assert( strpos( $prep_src, 'woo_create_entered' ) !== false, 'prepare persists create-entered before wc_create_order' );

br01_assert_eq( null, $br06_schema->validate(
	array(
		'transactionId'    => br06_uuid( 1 ),
		'registerId'       => 'reg-1',
		'shiftId'          => br06_uuid( 2 ),
		'deviceId'         => br06_uuid( 3 ),
		'quoteId'          => 'q1',
		'quoteFingerprint' => str_repeat( 'a', 64 ),
	),
	'PrepareSaleRequest'
), 'valid PrepareSaleRequest satisfies the schema' );

$closed_prepare = array(
	'transactionId'    => br06_uuid( 1 ),
	'registerId'       => 'reg-1',
	'shiftId'          => br06_uuid( 2 ),
	'deviceId'         => br06_uuid( 3 ),
	'quoteId'          => 'q1',
	'quoteFingerprint' => str_repeat( 'a', 64 ),
	'rush'             => true,
);
br01_assert( $br06_schema->validate( $closed_prepare, 'PrepareSaleRequest' ) !== null, 'unexpected PrepareSaleRequest field rejected' );
br01_assert( $br06_schema->validate( array(), 'PrepareSaleRequest' ) !== null, 'empty PrepareSaleRequest rejected' );

$closed_prepared = array(
	'transactionId'    => br06_uuid( 1 ),
	'saleId'           => 'sale-1',
	'orderReference'   => '1',
	'quoteFingerprint' => str_repeat( 'a', 64 ),
	'total'            => array( 'minor' => 1000, 'currency' => 'GHS' ),
	'status'           => 'prepared',
	'stockCommitment'  => 'held',
	'preparedAt'       => '2026-09-14T10:00:00Z',
	'expiresAt'        => '2026-09-14T11:00:00Z',
);
br01_assert( $br06_schema->validate( $closed_prepared, 'PreparedSale' ) !== null, 'invalid PreparedSale stockCommitment rejected' );
$closed_prepared['stockCommitment'] = 'reserved';
$closed_prepared['extra']           = 'nope';
br01_assert( $br06_schema->validate( $closed_prepared, 'PreparedSale' ) !== null, 'unexpected PreparedSale field rejected' );

$closed_resolution = array(
	'transactionId' => br06_uuid( 1 ),
	'status'        => 'prepared',
	'secretDump'    => 'nope',
);
br01_assert( $br06_schema->validate( $closed_resolution, 'SaleResolution' ) !== null, 'unexpected SaleResolution field rejected' );
br01_assert_eq( null, $br06_schema->validate( array( 'transactionId' => br06_uuid( 1 ), 'status' => 'not_found' ), 'SaleResolution' ), 'minimal SaleResolution is valid' );

/* ---------------------------------------------------------------------------
 * Ingress rejects before claim / order effects
 * ------------------------------------------------------------------------ */

$br06_runtime = br06_runtime();
$br06_stack   = br06_stack( $br06_runtime );
$br06_key     = br06_next_uuid();
$br06_invalid = $br06_stack['prep']->prepare(
	array(
		'transactionId' => 'not-a-uuid',
	),
	$br06_key
);
br01_assert_eq( 'VALIDATION_ERROR', br06_error_code( $br06_invalid ), 'malformed PrepareSaleRequest is VALIDATION_ERROR' );
br01_assert_eq( null, $br06_stack['claims']->get_by_idempotency( Cetech_Pos_Bridge_Constants::OPERATION_PREPARE, $br06_key ), 'malformed request creates no claim' );
br01_assert_eq( 0, $br06_runtime->pos_order_count(), 'malformed request creates no Woo order' );
br01_assert_eq( 0, $br06_runtime->side_effect_counts()['stock'], 'malformed request mutates no stock' );

$br06_extra = $br06_stack['prep']->prepare(
	array(
		'transactionId'    => br06_next_uuid(),
		'registerId'       => 'reg-training-1',
		'shiftId'          => br06_next_uuid(),
		'deviceId'         => br06_next_uuid(),
		'quoteId'          => 'q1',
		'quoteFingerprint' => str_repeat( 'b', 64 ),
		'rush'             => true,
	),
	br06_next_uuid()
);
br01_assert_eq( 'VALIDATION_ERROR', br06_error_code( $br06_extra ), 'closed-schema extra field rejected before effects' );
br01_assert_eq( 0, $br06_runtime->pos_order_count(), 'closed-schema rejection creates no order' );

/* ---------------------------------------------------------------------------
 * Happy path + HTTP headers + replay
 * ------------------------------------------------------------------------ */

$br06_ok_runtime = br06_runtime();
$br06_ok_plugin  = new Cetech_Pos_Bridge_Plugin( $br06_ok_runtime->get_environment(), $br06_ok_runtime );
$br06_quote_http = $br06_ok_plugin->get_quote_controller()->handle(
	new Cetech_Pos_Bridge_Test_Request(
		array( 'X-Correlation-ID' => $br06_corr ),
		'/cetech-pos/v1/quotes',
		br06_quote_request()
	)
);
$br06_quote_payload = br01_payload( $br06_quote_http );
br01_assert_eq( true, $br06_quote_payload['ok'], 'quote for prepare succeeds' );
$br06_quote = $br06_quote_payload['data'];
$br06_body  = br06_prepare_body( $br06_quote );
$br06_key   = br06_next_uuid();
$br06_first = br06_dispatch_prepare( $br06_ok_plugin, $br06_body, br06_headers( $br06_key ) );
$br06_first_payload = br01_payload( $br06_first );
br01_assert_eq( 200, br01_status( $br06_first ), 'first prepare HTTP 200' );
br01_assert_eq( true, $br06_first_payload['ok'], 'first prepare ok=true' );
br01_assert_eq( null, $br06_schema->validate( $br06_first_payload['data'], 'PreparedSale' ), 'PreparedSale egress satisfies schema' );
br01_assert_eq( 'prepared', $br06_first_payload['data']['status'], 'PreparedSale status is prepared' );
br01_assert_eq( 'reserved', $br06_first_payload['data']['stockCommitment'], 'truthful reserved commitment' );
br01_assert_eq( 1, $br06_ok_runtime->pos_order_count(), 'first prepare creates exactly one POS order' );
br01_assert_eq( 1, $br06_ok_runtime->side_effect_counts()['stock'], 'stock committed once' );
br01_assert_eq( 0, $br06_ok_runtime->side_effect_counts()['payments'], 'prepare takes no payment' );
br01_assert_eq( 0, $br06_ok_runtime->side_effect_counts()['mail'], 'prepare sends no mail' );
br01_assert_eq( 'pending', $br06_ok_runtime->orders[0]['status'], 'Woo order remains unpaid pending' );
br01_assert( isset( $br06_first->headers['Cache-Control'] ) && $br06_first->headers['Cache-Control'] === 'no-store', 'prepare Cache-Control no-store' );

$br06_replay = br06_dispatch_prepare( $br06_ok_plugin, $br06_body, br06_headers( $br06_key ) );
$br06_replay_payload = br01_payload( $br06_replay );
br01_assert_eq( true, $br06_replay_payload['ok'], 'same-key same-request replay ok' );
br01_assert_eq( $br06_first_payload['data']['saleId'], $br06_replay_payload['data']['saleId'], 'replay returns the original saleId' );
br01_assert_eq( $br06_first_payload['data']['orderReference'], $br06_replay_payload['data']['orderReference'], 'replay returns the original orderReference' );
br01_assert_eq( 1, $br06_ok_runtime->pos_order_count(), 'replay creates zero additional orders' );
br01_assert_eq( 1, $br06_ok_runtime->side_effect_counts()['stock'], 'replay does not reserve again' );

$br06_conflict_body                      = $br06_body;
$br06_conflict_body['quoteFingerprint']  = str_repeat( 'c', 64 );
$br06_conflict                             = br06_dispatch_prepare( $br06_ok_plugin, $br06_conflict_body, br06_headers( $br06_key ) );
$br06_conflict_payload                     = br01_payload( $br06_conflict );
br01_assert_eq( 409, br01_status( $br06_conflict ), 'same-key different-request HTTP 409' );
br01_assert_eq( 'IDEMPOTENCY_CONFLICT', $br06_conflict_payload['error']['code'], 'same-key different-request IDEMPOTENCY_CONFLICT' );
br01_assert_eq( false, $br06_conflict_payload['error']['retryable'], 'idempotency conflict retryable=false' );
br01_assert_eq( 'contact_manager', $br06_conflict_payload['error']['nextAction'], 'idempotency conflict nextAction' );
br01_assert_eq( 1, $br06_ok_runtime->pos_order_count(), 'conflict creates no second order' );
br01_assert_eq( 1, $br06_ok_runtime->side_effect_counts()['stock'], 'conflict has no additional stock effect' );

$br06_other_key = br06_dispatch_prepare( $br06_ok_plugin, $br06_body, br06_headers( br06_next_uuid() ) );
$br06_other_payload = br01_payload( $br06_other_key );
br01_assert_eq( 409, br01_status( $br06_other_key ), 'same transaction different key HTTP 409' );
br01_assert_eq( 'REQUIRES_ATTENTION', $br06_other_payload['error']['code'], 'same transaction different key REQUIRES_ATTENTION' );
br01_assert_eq( 1, $br06_ok_runtime->pos_order_count(), 'second key cannot map the transaction to another Woo order' );

$br06_missing_key = br06_dispatch_prepare(
	$br06_ok_plugin,
	$br06_body,
	array( 'X-Correlation-ID' => $br06_corr )
);
br01_assert_eq( 400, br01_status( $br06_missing_key ), 'missing Idempotency-Key HTTP 400' );
br01_assert_eq( 'VALIDATION_ERROR', br01_payload( $br06_missing_key )['error']['code'], 'missing Idempotency-Key VALIDATION_ERROR' );
br01_assert_eq( 'Idempotency-Key', br01_payload( $br06_missing_key )['error']['details']['field'], 'missing Idempotency-Key field' );

$br06_bad_key = br06_dispatch_prepare(
	$br06_ok_plugin,
	$br06_body,
	array(
		'X-Correlation-ID' => $br06_corr,
		'Idempotency-Key'  => 'NOT-A-UUID',
	)
);
br01_assert_eq( 400, br01_status( $br06_bad_key ), 'malformed Idempotency-Key HTTP 400' );
br01_assert( br01_payload( $br06_bad_key )['correlationId'] === $br06_corr, 'correlation remains distinct from the rejected idempotency key' );

/* ---------------------------------------------------------------------------
 * Resolve
 * ------------------------------------------------------------------------ */

$br06_unknown = br06_dispatch_resolve(
	$br06_ok_plugin,
	br06_next_uuid(),
	array( 'X-Correlation-ID' => $br06_corr )
);
$br06_unknown_payload = br01_payload( $br06_unknown );
br01_assert_eq( 200, br01_status( $br06_unknown ), 'unknown transaction resolve HTTP 200' );
br01_assert_eq( 'not_found', $br06_unknown_payload['data']['status'], 'unknown transaction not_found' );
br01_assert_eq( null, $br06_schema->validate( $br06_unknown_payload['data'], 'SaleResolution' ), 'not_found SaleResolution satisfies schema' );
br01_assert_eq( 1, $br06_ok_runtime->pos_order_count(), 'unknown resolve creates no order' );

$br06_resolved = br06_dispatch_resolve(
	$br06_ok_plugin,
	$br06_body['transactionId'],
	array( 'X-Correlation-ID' => $br06_corr )
);
$br06_resolved_payload = br01_payload( $br06_resolved );
br01_assert_eq( 'prepared', $br06_resolved_payload['data']['status'], 'prepared resolve status' );
br01_assert_eq( $br06_first_payload['data']['saleId'], $br06_resolved_payload['data']['saleId'], 'resolve echoes original saleId' );
br01_assert_eq( $br06_first_payload['data']['orderReference'], $br06_resolved_payload['data']['orderReference'], 'resolve echoes original orderReference' );

$br06_stock_before = $br06_ok_runtime->side_effect_counts()['stock'];
$br06_again        = br06_dispatch_resolve(
	$br06_ok_plugin,
	$br06_body['transactionId'],
	array( 'X-Correlation-ID' => $br06_corr )
);
br01_assert_eq( 'prepared', br01_payload( $br06_again )['data']['status'], 'repeated resolve stays prepared' );
br01_assert_eq( 1, $br06_ok_runtime->pos_order_count(), 'repeated resolve creates no order' );
br01_assert_eq( $br06_stock_before, $br06_ok_runtime->side_effect_counts()['stock'], 'repeated resolve changes no stock' );

$br06_prep_runtime = br06_runtime();
$br06_prep_stack   = br06_stack( $br06_prep_runtime );
$br06_prep_quote   = $br06_prep_stack['quotes']->quote( br06_quote_request() );
$br06_prep_body    = br06_prepare_body( $br06_prep_quote );
$br06_in_progress  = null;
$br06_prep_stack['prep']->after_claim = function ( $eng ) use ( $br06_prep_body, &$br06_in_progress ) {
	$br06_in_progress = $eng->resolve( $br06_prep_body['transactionId'] );
};
$br06_prep_stack['prep']->prepare( $br06_prep_body, br06_next_uuid() );
br01_assert( is_array( $br06_in_progress ), 'in-progress resolve returned a payload' );
br01_assert_eq( 'preparing', $br06_in_progress['status'], 'active claim resolves as preparing' );
br01_assert_eq( null, $br06_schema->validate( $br06_in_progress, 'SaleResolution' ), 'preparing SaleResolution satisfies schema' );

$br06_attn_runtime = br06_runtime();
$br06_attn_stack   = br06_stack( $br06_attn_runtime );
$br06_attn_quote   = $br06_attn_stack['quotes']->quote( br06_quote_request() );
$br06_attn_body    = br06_prepare_body( $br06_attn_quote );
$br06_attn_key     = br06_next_uuid();
$br06_attn_stack['claims']->insert_preparing(
	array(
		'operation_type'  => Cetech_Pos_Bridge_Constants::OPERATION_PREPARE,
		'idempotency_key' => $br06_attn_key,
		'transaction_id'  => $br06_attn_body['transactionId'],
		'request_hash'    => Cetech_Pos_Bridge_Request_Hash::hash( $br06_attn_body ),
		'quote_id'        => $br06_attn_quote['id'],
	)
);
$br06_attn_runtime->inject_duplicate_transaction_order( $br06_attn_body['transactionId'] );
$br06_attn_runtime->inject_duplicate_transaction_order( $br06_attn_body['transactionId'] );
$br06_attn = $br06_attn_stack['prep']->resolve( $br06_attn_body['transactionId'] );
br01_assert_eq( 'requires_attention', $br06_attn['status'], 'duplicate Woo recovery identity is requires_attention' );
br01_assert_eq( null, $br06_schema->validate( $br06_attn, 'SaleResolution' ), 'requires_attention SaleResolution satisfies schema' );

$br06_bad_tx = $br06_ok_plugin->get_prepare_engine()->resolve( 'not-a-uuid' );
br01_assert_eq( 'VALIDATION_ERROR', br06_error_code( $br06_bad_tx ), 'resolve rejects a non-UUID transactionId' );

/* ---------------------------------------------------------------------------
 * Concurrent same-key interleaving (in-memory lock, not DB concurrency)
 * ------------------------------------------------------------------------ */

$br06_conc_runtime = br06_runtime();
$br06_conc_stack   = br06_stack( $br06_conc_runtime );
$br06_conc_quote   = $br06_conc_stack['quotes']->quote( br06_quote_request() );
$br06_conc_body    = br06_prepare_body( $br06_conc_quote );
$br06_conc_key     = br06_next_uuid();
$br06_waiter       = null;
$br06_conc_stack['prep']->after_claim = function ( $eng ) use ( $br06_conc_body, $br06_conc_key, &$br06_waiter ) {
	$br06_waiter = $eng->prepare( $br06_conc_body, $br06_conc_key );
};
$br06_winner = $br06_conc_stack['prep']->prepare( $br06_conc_body, $br06_conc_key );
br01_assert( is_array( $br06_winner ), 'lock holder prepares successfully' );
br01_assert_eq( 'OPERATION_IN_PROGRESS', br06_error_code( $br06_waiter ), 'same-key waiter while in progress is OPERATION_IN_PROGRESS' );
br01_assert_eq( 1, $br06_conc_runtime->pos_order_count(), 'concurrent same-key creates at most one order' );
$br06_waiter_retry = $br06_conc_stack['prep']->prepare( $br06_conc_body, $br06_conc_key );
br01_assert( is_array( $br06_waiter_retry ), 'waiter retry recovers the original PreparedSale' );
br01_assert_eq( $br06_winner['saleId'], $br06_waiter_retry['saleId'], 'waiter retry saleId matches' );

$br06_insert_runtime = br06_runtime();
$br06_insert_stack   = br06_stack( $br06_insert_runtime );
$br06_insert_quote   = $br06_insert_stack['quotes']->quote( br06_quote_request() );
$br06_insert_body    = br06_prepare_body( $br06_insert_quote );
$br06_insert_key     = br06_next_uuid();
$br06_nested         = null;
$br06_insert_stack['claims']->during_insert = function ( $store ) use ( $br06_insert_stack, $br06_insert_body, $br06_insert_key, &$br06_nested ) {
	unset( $store );
	$br06_nested = $br06_insert_stack['prep']->prepare( $br06_insert_body, $br06_insert_key );
};
$br06_outer = $br06_insert_stack['prep']->prepare( $br06_insert_body, $br06_insert_key );
br01_assert( is_array( $br06_nested ) || br06_error_code( $br06_nested ) === 'OPERATION_IN_PROGRESS' || is_array( $br06_outer ), 'during_insert interleaving remains defined' );
br01_assert_eq( 1, $br06_insert_runtime->pos_order_count(), 'during_insert interleaving still creates exactly one order' );

/* ---------------------------------------------------------------------------
 * Crash seams at actual runtime boundaries (A/B/C)
 * A: after wc_create_order, before recovery metadata
 * B: after recovery metadata save, before wc_reserve_stock_for_order
 * C: after reservation succeeds, before claim PreparedSale persistence
 * ------------------------------------------------------------------------ */

$br06_a_runtime = br06_runtime();
$br06_a_stack   = br06_stack( $br06_a_runtime );
$br06_a_quote   = $br06_a_stack['quotes']->quote( br06_quote_request() );
$br06_a_body    = br06_prepare_body( $br06_a_quote );
$br06_a_key     = br06_next_uuid();
$br06_a_runtime->after_wc_create = br06_thrower( 'crash seam A after wc_create_order' );
br06_prepare_crashed( $br06_a_stack['prep'], $br06_a_body, $br06_a_key, 'crash seam A after wc_create_order' );
br01_assert_eq( 1, $br06_a_runtime->pos_order_count(), 'seam A leaves at most one Woo order' );
br01_assert_eq( 1, $br06_a_runtime->create_calls, 'seam A called wc_create_order once' );
br01_assert( ! br06_order_reserved( $br06_a_runtime ), 'seam A does not invent a reservation' );
$br06_a_claim = $br06_a_stack['claims']->get_by_idempotency( Cetech_Pos_Bridge_Constants::OPERATION_PREPARE, $br06_a_key );
br01_assert_eq( 1, (int) $br06_a_claim['woo_create_entered'], 'seam A persisted woo_create_entered before create' );
$br06_a_resolved = $br06_a_stack['prep']->resolve( $br06_a_body['transactionId'] );
br01_assert_eq( 'requires_attention', $br06_a_resolved['status'], 'seam A resolve is requires_attention, not prepared' );
br01_assert( ! isset( $br06_a_resolved['stockCommitment'] ), 'seam A resolve does not report stockCommitment' );
br01_assert_eq( 1, $br06_a_runtime->pos_order_count(), 'seam A resolve creates no second Woo order' );
br01_assert_eq( 1, $br06_a_runtime->create_calls, 'seam A resolve does not call wc_create_order' );
$br06_a_retry = $br06_a_stack['prep']->prepare( $br06_a_body, $br06_a_key );
br01_assert_eq( 'REQUIRES_ATTENTION', br06_error_code( $br06_a_retry ), 'seam A retry does not create order #2' );
br06_assert_honest_commitment( $br06_a_retry, $br06_a_runtime, 'seam A retry' );
br01_assert_eq( 1, $br06_a_runtime->pos_order_count(), 'seam A retry creates no second Woo order' );
br01_assert_eq( 1, $br06_a_runtime->create_calls, 'ambiguous seam A recovery does not call wc_create_order again' );

$br06_b_runtime = br06_runtime();
$br06_b_stack   = br06_stack( $br06_b_runtime );
$br06_b_quote   = $br06_b_stack['quotes']->quote( br06_quote_request() );
$br06_b_body    = br06_prepare_body( $br06_b_quote );
$br06_b_key     = br06_next_uuid();
$br06_b_runtime->after_meta_save = br06_thrower( 'crash seam B after recovery metadata save' );
br06_prepare_crashed( $br06_b_stack['prep'], $br06_b_body, $br06_b_key, 'crash seam B after recovery metadata save' );
br01_assert_eq( 1, $br06_b_runtime->pos_order_count(), 'seam B leaves at most one Woo order' );
br01_assert_eq( 1, $br06_b_runtime->create_calls, 'seam B called wc_create_order once' );
br01_assert( ! br06_order_reserved( $br06_b_runtime ), 'seam B reservation is incomplete' );
$br06_b_resolved = $br06_b_stack['prep']->resolve( $br06_b_body['transactionId'] );
br01_assert_eq( 'preparing', $br06_b_resolved['status'], 'seam B resolve does not report prepared without reservation' );
br01_assert( ! isset( $br06_b_resolved['stockCommitment'] ), 'seam B resolve does not report stockCommitment' );
br01_assert( ! br06_order_reserved( $br06_b_runtime ), 'seam B resolve does not complete or invent reservation' );
br01_assert_eq( 1, $br06_b_runtime->pos_order_count(), 'seam B resolve creates no second Woo order' );
br01_assert_eq( 1, $br06_b_runtime->create_calls, 'seam B resolve does not call wc_create_order' );
$br06_b_retry = $br06_b_stack['prep']->prepare( $br06_b_body, $br06_b_key );
br01_assert( is_array( $br06_b_retry ), 'seam B retry recovers PreparedSale after completing reservation' );
br01_assert_eq( 'prepared', $br06_b_retry['status'], 'seam B retry is prepared' );
br01_assert_eq( 'reserved', $br06_b_retry['stockCommitment'], 'seam B retry reports reserved only after proven reservation' );
br06_assert_honest_commitment( $br06_b_retry, $br06_b_runtime, 'seam B retry' );
br01_assert_eq( 1, $br06_b_runtime->pos_order_count(), 'seam B retry creates no second Woo order' );
br01_assert_eq( 1, $br06_b_runtime->create_calls, 'seam B retry does not call wc_create_order again' );
$br06_b_resolved_ok = $br06_b_stack['prep']->resolve( $br06_b_body['transactionId'] );
br01_assert_eq( 'prepared', $br06_b_resolved_ok['status'], 'seam B resolve after repair is prepared' );
br01_assert_eq( 1, $br06_b_runtime->pos_order_count(), 'seam B post-repair resolve creates no second Woo order' );

$br06_c_runtime = br06_runtime();
$br06_c_stack   = br06_stack( $br06_c_runtime );
$br06_c_quote   = $br06_c_stack['quotes']->quote( br06_quote_request() );
$br06_c_body    = br06_prepare_body( $br06_c_quote );
$br06_c_key     = br06_next_uuid();
$br06_c_stack['prep']->after_order_create = br06_thrower( 'crash seam C after reservation before claim persist' );
br06_prepare_crashed( $br06_c_stack['prep'], $br06_c_body, $br06_c_key, 'crash seam C after reservation before claim persist' );
br01_assert_eq( 1, $br06_c_runtime->pos_order_count(), 'seam C leaves at most one Woo order' );
br01_assert_eq( 1, $br06_c_runtime->create_calls, 'seam C called wc_create_order once' );
br01_assert( br06_order_reserved( $br06_c_runtime ), 'seam C reservation is proven before claim persist' );
$br06_c_claim = $br06_c_stack['claims']->get_by_idempotency( Cetech_Pos_Bridge_Constants::OPERATION_PREPARE, $br06_c_key );
br01_assert_eq( Cetech_Pos_Bridge_Claim_Store::STATUS_PREPARING, $br06_c_claim['internal_status'], 'seam C claim remains preparing before repair' );
$br06_c_resolved = $br06_c_stack['prep']->resolve( $br06_c_body['transactionId'] );
br01_assert_eq( 'prepared', $br06_c_resolved['status'], 'seam C resolve recovers prepared from proven reservation' );
br01_assert_eq( 1, $br06_c_runtime->pos_order_count(), 'seam C resolve creates no second Woo order' );
br01_assert_eq( 1, $br06_c_runtime->create_calls, 'seam C resolve does not call wc_create_order' );
$br06_c_retry = $br06_c_stack['prep']->prepare( $br06_c_body, $br06_c_key );
br01_assert( is_array( $br06_c_retry ), 'seam C retry returns the recovered PreparedSale' );
br01_assert_eq( 'prepared', $br06_c_retry['status'], 'seam C retry is prepared' );
br01_assert_eq( 'reserved', $br06_c_retry['stockCommitment'], 'seam C retry reports reserved from proven reservation' );
br06_assert_honest_commitment( $br06_c_retry, $br06_c_runtime, 'seam C retry' );
br01_assert_eq( (string) $br06_c_runtime->orders[0]['id'], $br06_c_retry['orderReference'], 'seam C recovery maps the original Woo order' );
br01_assert_eq( 1, $br06_c_runtime->pos_order_count(), 'seam C retry creates no second Woo order' );
br01_assert_eq( 1, $br06_c_runtime->create_calls, 'seam C retry does not call wc_create_order again' );

$br06_hash_runtime = br06_runtime();
$br06_hash_stack   = br06_stack( $br06_hash_runtime );
$br06_hash_quote   = $br06_hash_stack['quotes']->quote( br06_quote_request() );
$br06_hash_body    = br06_prepare_body( $br06_hash_quote );
$br06_hash_key     = br06_next_uuid();
$br06_hash_stack['claims']->insert_preparing(
	array(
		'operation_type'  => Cetech_Pos_Bridge_Constants::OPERATION_PREPARE,
		'idempotency_key' => $br06_hash_key,
		'transaction_id'  => $br06_hash_body['transactionId'],
		'request_hash'    => Cetech_Pos_Bridge_Request_Hash::hash( $br06_hash_body ),
		'quote_id'        => $br06_hash_quote['id'],
	)
);
$br06_hash_runtime->inject_pos_order( $br06_hash_body['transactionId'], 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', true );
$br06_hash_resolved = $br06_hash_stack['prep']->resolve( $br06_hash_body['transactionId'] );
br01_assert_eq( 'requires_attention', $br06_hash_resolved['status'], 'wrong request hash is not accepted as prepared' );
br01_assert_eq( 1, $br06_hash_runtime->pos_order_count(), 'wrong-hash resolve creates no extra Woo order' );
br01_assert_eq( 0, $br06_hash_runtime->create_calls, 'wrong-hash resolve does not call wc_create_order' );
$br06_hash_retry = $br06_hash_stack['prep']->prepare( $br06_hash_body, $br06_hash_key );
br01_assert_eq( 'REQUIRES_ATTENTION', br06_error_code( $br06_hash_retry ), 'wrong request hash is not recovered as PreparedSale' );
br06_assert_honest_commitment( $br06_hash_retry, $br06_hash_runtime, 'wrong-hash retry' );
br01_assert_eq( 1, $br06_hash_runtime->pos_order_count(), 'wrong-hash retry creates no second Woo order' );
br01_assert_eq( 0, $br06_hash_runtime->create_calls, 'wrong-hash retry does not call wc_create_order' );

$br06_id_runtime = br06_runtime();
$br06_id_stack   = br06_stack( $br06_id_runtime );
$br06_id_quote   = $br06_id_stack['quotes']->quote( br06_quote_request() );
$br06_id_body    = br06_prepare_body( $br06_id_quote );
$br06_id_key     = br06_next_uuid();
$br06_id_hash    = Cetech_Pos_Bridge_Request_Hash::hash( $br06_id_body );
$br06_id_stack['claims']->insert_preparing(
	array(
		'operation_type'  => Cetech_Pos_Bridge_Constants::OPERATION_PREPARE,
		'idempotency_key' => $br06_id_key,
		'transaction_id'  => $br06_id_body['transactionId'],
		'request_hash'    => $br06_id_hash,
		'quote_id'        => $br06_id_quote['id'],
	)
);
$br06_id_runtime->inject_pos_order( $br06_id_body['transactionId'], $br06_id_hash, true );
$br06_id_recovered = $br06_id_stack['prep']->prepare( $br06_id_body, $br06_id_key );
br01_assert( is_array( $br06_id_recovered ), 'exactly one tx+hash match with proven reservation recovers PreparedSale' );
br01_assert_eq( 'prepared', $br06_id_recovered['status'], 'identified proven order is prepared' );
br01_assert_eq( 'reserved', $br06_id_recovered['stockCommitment'], 'identified proven order reports reserved' );
br06_assert_honest_commitment( $br06_id_recovered, $br06_id_runtime, 'identified recovery' );
br01_assert_eq( 1, $br06_id_runtime->pos_order_count(), 'identified recovery creates no second Woo order' );
br01_assert_eq( 0, $br06_id_runtime->create_calls, 'identified recovery does not call wc_create_order' );
$br06_id_resolved = $br06_id_stack['prep']->resolve( $br06_id_body['transactionId'] );
br01_assert_eq( 'prepared', $br06_id_resolved['status'], 'identified recovery resolve stays prepared' );
br01_assert_eq( 0, $br06_id_runtime->create_calls, 'identified recovery resolve does not call wc_create_order' );

/* ---------------------------------------------------------------------------
 * Quote revalidation and stock
 * ------------------------------------------------------------------------ */

$br06_fp_runtime = br06_runtime();
$br06_fp_stack   = br06_stack( $br06_fp_runtime );
$br06_fp_quote   = $br06_fp_stack['quotes']->quote( br06_quote_request() );
$br06_fp_body    = br06_prepare_body( $br06_fp_quote );
$br06_fp_body['quoteFingerprint'] = str_repeat( 'd', 64 );
$br06_fp = $br06_fp_stack['prep']->prepare( $br06_fp_body, br06_next_uuid() );
br01_assert_eq( 'QUOTE_CHANGED', br06_error_code( $br06_fp ), 'wrong quoteFingerprint is QUOTE_CHANGED' );
br01_assert_eq( 0, $br06_fp_runtime->pos_order_count(), 'wrong fingerprint creates no order' );
$br06_fp_replay = $br06_fp_stack['prep']->prepare( $br06_fp_body, $br06_fp_stack['claims']->get_by_transaction( $br06_fp_body['transactionId'] )['idempotency_key'] );
br01_assert_eq( 'QUOTE_CHANGED', br06_error_code( $br06_fp_replay ), 'terminal QUOTE_CHANGED is replayed without a second Woo attempt' );
br01_assert_eq( 0, $br06_fp_runtime->pos_order_count(), 'replayed QUOTE_CHANGED still creates no order' );

$br06_exp_runtime = br06_runtime();
$br06_exp_stack   = br06_stack( $br06_exp_runtime );
$br06_exp_quote   = $br06_exp_stack['quotes']->quote( br06_quote_request() );
$br06_exp_quote['expiresAt'] = '2020-01-01T00:00:00Z';
$br06_exp_stack['store']->put( $br06_exp_quote );
$br06_exp = $br06_exp_stack['prep']->prepare( br06_prepare_body( $br06_exp_quote ), br06_next_uuid() );
br01_assert_eq( 'QUOTE_EXPIRED', br06_error_code( $br06_exp ), 'expired quote is QUOTE_EXPIRED' );
br01_assert_eq( 0, $br06_exp_runtime->pos_order_count(), 'expired quote creates no order' );

$br06_chg_runtime = br06_runtime();
$br06_chg_stack   = br06_stack( $br06_chg_runtime );
$br06_chg_quote   = $br06_chg_stack['quotes']->quote( br06_quote_request() );
$br06_chg_runtime->catalog['walkin']['101']['1']['unitPrice'] = '12.00';
$br06_chg_runtime->catalog['walkin']['101']['1']['subtotal']  = '12.00';
$br06_chg = $br06_chg_stack['prep']->prepare( br06_prepare_body( $br06_chg_quote ), br06_next_uuid() );
br01_assert_eq( 'QUOTE_CHANGED', br06_error_code( $br06_chg ), 'authoritative commercial change is QUOTE_CHANGED' );
$br06_chg_data = $br06_chg->get_error_data();
br01_assert( isset( $br06_chg_data['details']['currentQuoteId'] ), 'commercial change may return currentQuoteId' );
br01_assert_eq( 0, $br06_chg_runtime->pos_order_count(), 'commercial change creates no order' );

$br06_st_runtime = br06_runtime();
$br06_st_stack   = br06_stack( $br06_st_runtime );
$br06_st_quote   = $br06_st_stack['quotes']->quote( br06_quote_request() );
$br06_st_runtime->stock['101'] = 0;
$br06_st = $br06_st_stack['prep']->prepare( br06_prepare_body( $br06_st_quote ), br06_next_uuid() );
br01_assert_eq( 'STOCK_CHANGED', br06_error_code( $br06_st ), 'changed stock is STOCK_CHANGED' );
br01_assert_eq( 0, $br06_st_runtime->pos_order_count(), 'changed stock creates no order' );

$br06_hold_runtime = br06_runtime();
$br06_hold_runtime->hold_stock_minutes = 0;
$br06_hold_stack = br06_stack( $br06_hold_runtime );
$br06_hold_quote = $br06_hold_stack['quotes']->quote( br06_quote_request() );
$br06_hold = $br06_hold_stack['prep']->prepare( br06_prepare_body( $br06_hold_quote ), br06_next_uuid() );
br01_assert_eq( 'INTEGRATION_UNAVAILABLE', br06_error_code( $br06_hold ), 'unconfigured hold-stock minutes fails closed' );
br01_assert_eq( 0, $br06_hold_runtime->pos_order_count(), 'unconfigured hold-stock creates no order' );

$br06_bad_sale_runtime = br06_runtime();
$br06_bad_sale_runtime->force_commitment = 'held';
$br06_bad_sale_stack = br06_stack( $br06_bad_sale_runtime );
$br06_bad_sale_quote = $br06_bad_sale_stack['quotes']->quote( br06_quote_request() );
$br06_bad_sale = $br06_bad_sale_stack['prep']->prepare( br06_prepare_body( $br06_bad_sale_quote ), br06_next_uuid() );
br01_assert_eq( 'INTEGRATION_UNAVAILABLE', br06_error_code( $br06_bad_sale ), 'invalid PreparedSale cannot leave as ok' );

/* ---------------------------------------------------------------------------
 * Last-unit race
 * ------------------------------------------------------------------------ */

$br06_lu_runtime = br06_runtime();
$br06_lu_runtime->stock['101'] = 1;
$br06_lu_stack = br06_stack( $br06_lu_runtime );
$br06_lu_quote = $br06_lu_stack['quotes']->quote( br06_quote_request() );
$br06_lu_runtime->during_reserve = function ( $rt ) {
	$rt->competing_checkout( '101', 1 );
};
$br06_lu = $br06_lu_stack['prep']->prepare( br06_prepare_body( $br06_lu_quote ), br06_next_uuid() );
br01_assert_eq( 'STOCK_CHANGED', br06_error_code( $br06_lu ), 'last-unit competing checkout blocks prepare' );
br01_assert_eq( 0, $br06_lu_runtime->pos_order_count(), 'losing prepare does not keep a POS order' );
br01_assert_eq( 1, $br06_lu_runtime->storefront_orders, 'competing checkout took the last unit' );
br01_assert_eq( 0, $br06_lu_runtime->stock['101'], 'last unit is not double-committed' );

$br06_two_runtime = br06_runtime();
$br06_two_runtime->stock['101'] = 1;
$br06_two_stack = br06_stack( $br06_two_runtime );
$br06_two_q1 = $br06_two_stack['quotes']->quote( br06_quote_request() );
$br06_two_q2 = $br06_two_stack['quotes']->quote( br06_quote_request() );
$br06_two_b1 = br06_prepare_body( $br06_two_q1 );
$br06_two_b2 = br06_prepare_body( $br06_two_q2 );
$br06_two_k2 = br06_next_uuid();
$br06_two_second = null;
$br06_two_runtime->during_reserve = function () use ( $br06_two_stack, $br06_two_b2, $br06_two_k2, &$br06_two_second ) {
	$br06_two_second = $br06_two_stack['prep']->prepare( $br06_two_b2, $br06_two_k2 );
};
$br06_two_first = $br06_two_stack['prep']->prepare( $br06_two_b1, br06_next_uuid() );
$br06_two_wins  = 0;
if ( is_array( $br06_two_first ) ) {
	++$br06_two_wins;
}
if ( is_array( $br06_two_second ) ) {
	++$br06_two_wins;
}
br01_assert_eq( 1, $br06_two_wins, 'two competing prepares cannot both commit the last unit' );
br01_assert_eq( 1, $br06_two_runtime->pos_order_count(), 'last-unit POS race leaves exactly one POS order' );
br01_assert_eq( 0, $br06_two_runtime->stock['101'], 'last unit stock is exhausted once' );

br01_assert_eq( 0, $br06_ok_runtime->side_effect_counts()['payments'], 'suite still has no payment side effect on the happy-path runtime' );
br01_assert( strpos( $woo_src, 'WoodMart' ) === false || strpos( $prep_src, 'b2bking_get' ) === false, 'prepare path does not copy B2BKing getters' );
br01_assert( strpos( $prep_src, 'woodmart_get_discount' ) === false, 'prepare path does not copy WoodMart formulas' );
