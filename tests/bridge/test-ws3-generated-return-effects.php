<?php
/**
 * R8-01 — actual WS3-generated commercial-refund / stock-disposition commands
 * consumed by the actual WS2 schema validator and return-effect producer.
 *
 * Not live Woo/Paystack. The PHP side creates a completed sale, asks the WS3
 * builder (same TypeScript used by executeReturn) to emit commands, then feeds
 * those JSON artifacts unmodified into schema validation and the producer.
 */

function r8_ws3_node_bin() {
	$from_env = getenv( 'NODE' );
	if ( is_string( $from_env ) && $from_env !== '' ) {
		return $from_env;
	}
	return 'node';
}

function r8_ws3_run_builder( array $meta, $out_dir ) {
	$root   = dirname( __DIR__, 2 );
	$script = $root . '/apps/pos-web/scripts/run-ws3-return-commands.mjs';
	$meta_f = $out_dir . '/sale-meta.json';
	if ( ! is_dir( $out_dir ) ) {
		mkdir( $out_dir, 0777, true );
	}
	file_put_contents( $meta_f, json_encode( $meta ) );
	$prev = getcwd();
	chdir( $root . '/apps/pos-web' );
	$cmd = r8_ws3_node_bin()
		. ' ' . escapeshellarg( $script )
		. ' ' . escapeshellarg( $meta_f )
		. ' ' . escapeshellarg( $out_dir );
	$output = array();
	$code   = 0;
	exec( $cmd . ' 2>&1', $output, $code );
	if ( is_string( $prev ) && $prev !== '' ) {
		chdir( $prev );
	}
	return array(
		'code'   => $code,
		'output' => implode( "\n", $output ),
	);
}

function r8_ws3_load( $dir, $name ) {
	$raw = file_get_contents( $dir . '/' . $name );
	br01_assert( is_string( $raw ) && $raw !== '', 'WS3 fixture ' . $name . ' exists' );
	$decoded = json_decode( $raw, true );
	br01_assert( is_array( $decoded ), 'WS3 fixture ' . $name . ' is JSON' );
	return $decoded;
}

function r8_ws3_qty2_request() {
	$req = br06_quote_request();
	$req['lines'][0]['quantity'] = '2';
	return $req;
}

$r8_runtime = br06_runtime();
$r8_runtime->catalog['walkin']['101']['2'] = array(
	'unitPrice'   => '10.00',
	'subtotal'    => '20.00',
	'discount'    => '0.00',
	'tax'         => '0.00',
	'stockStatus' => 'in_stock',
	'purchasable' => true,
);
$r8_runtime->stock['101'] = 10;
$r8_plugin = br08_plugin( $r8_runtime );
$r8_sale   = br08_completed_sale( $r8_plugin, $r8_runtime, r8_ws3_qty2_request() );
$r8_line   = $r8_sale['line'];
$r8_meta   = array(
	'transactionId'    => $r8_sale['body']['transactionId'],
	'saleId'           => $r8_sale['prepared']['saleId'],
	'quoteFingerprint' => $r8_sale['prepared']['quoteFingerprint'],
	'orderLineId'      => $r8_line['lineId'],
	'quantity'         => $r8_line['quantity'],
	'lineTotalMinor'   => (int) $r8_sale['quote']['total']['minor'],
	'currency'         => $r8_sale['quote']['total']['currency'],
);

$r8_out = sys_get_temp_dir() . '/cetech-r8-ws3-' . bin2hex( random_bytes( 4 ) );
$r8_run = r8_ws3_run_builder( $r8_meta, $r8_out );
br01_assert_eq( 0, $r8_run['code'], 'WS3 command builder exits 0 ' . $r8_run['output'] );

$r8_partial1 = r8_ws3_load( $r8_out, 'commercial-partial-1.json' );
$r8_partial2 = r8_ws3_load( $r8_out, 'commercial-partial-2.json' );
$r8_stock    = r8_ws3_load( $r8_out, 'stock-disposition.json' );
$r8_manifest = r8_ws3_load( $r8_out, 'manifest.json' );

$r8_schema = Cetech_Pos_Bridge_Schema::instance();
br01_assert_eq( null, $r8_schema->validate( $r8_partial1, 'BridgeCommercialRefundRequest' ), 'WS3 partial-1 schema valid' );
br01_assert_eq( null, $r8_schema->validate( $r8_partial2, 'BridgeCommercialRefundRequest' ), 'WS3 partial-2 schema valid' );
br01_assert_eq( null, $r8_schema->validate( $r8_stock, 'BridgeStockDispositionRequest' ), 'WS3 stock schema valid' );

br01_assert_eq( $r8_meta['quoteFingerprint'], $r8_partial1['economicsVersion'], 'partial-1 economicsVersion is quoteFingerprint' );
br01_assert_eq( $r8_meta['quoteFingerprint'], $r8_partial2['economicsVersion'], 'partial-2 economicsVersion is quoteFingerprint' );
br01_assert_eq( $r8_meta['quoteFingerprint'], $r8_stock['economicsVersion'], 'stock economicsVersion is quoteFingerprint' );
br01_assert_eq( $r8_partial1['amount']['minor'], $r8_partial1['lineAllocations'][0]['historicAmount']['minor'], 'partial-1 allocation sum equals amount' );
br01_assert_eq( $r8_partial2['amount']['minor'], $r8_partial2['lineAllocations'][0]['historicAmount']['minor'], 'partial-2 allocation sum equals amount' );
br01_assert_eq(
	$r8_meta['lineTotalMinor'],
	(int) $r8_partial1['amount']['minor'] + (int) $r8_partial2['amount']['minor'],
	'cumulative WS3 allocations equal historic line total'
);

$r8_key1  = br06_next_uuid();
$r8_first = br08_dispatch_refund( $r8_plugin, $r8_partial1, br08_headers( $r8_key1 ) );
br01_assert_eq( 200, br01_status( $r8_first ), 'WS2 producer accepts WS3 first partial' );
br01_assert_eq( 'completed', br08_code( $r8_first ), 'WS2 first partial completes' );

$r8_replay = br08_dispatch_refund( $r8_plugin, $r8_partial1, br08_headers( $r8_key1 ) );
br01_assert_eq( 'completed', br08_code( $r8_replay ), 'WS2 first partial replay is idempotent' );

$r8_second = br08_dispatch_refund( $r8_plugin, $r8_partial2, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 200, br01_status( $r8_second ), 'WS2 producer accepts WS3 second partial' );
br01_assert_eq( 'completed', br08_code( $r8_second ), 'WS2 second partial completes' );

$r8_over = $r8_partial2;
$r8_over['commercialRefundId'] = br06_next_uuid();
$r8_over['returnId']           = br06_next_uuid();
$r8_third = br08_dispatch_refund( $r8_plugin, $r8_over, br08_headers( br06_next_uuid() ) );
br01_assert( br01_status( $r8_third ) >= 400, 'third partial exceeding quantity is rejected' );

$r8_wrong_econ = $r8_partial1;
$r8_wrong_econ['commercialRefundId'] = br06_next_uuid();
$r8_wrong_econ['returnId']           = br06_next_uuid();
$r8_wrong_econ['economicsVersion']   = 'ffffffffffffffffffffffffffffffff';
$r8_econ_fail = br08_dispatch_refund( $r8_plugin, $r8_wrong_econ, br08_headers( br06_next_uuid() ) );
br01_assert( br01_status( $r8_econ_fail ) >= 400, 'changed economicsVersion fails closed' );

$r8_stock_ok = br08_dispatch_stock( $r8_plugin, $r8_stock, br08_headers( br06_next_uuid() ) );
br01_assert_eq( 200, br01_status( $r8_stock_ok ), 'WS2 producer accepts WS3 stock disposition' );

$r8_stock_bad = $r8_stock;
$r8_stock_bad['stockDispositionId'] = br06_next_uuid();
$r8_stock_bad['returnId']           = br06_next_uuid();
$r8_stock_bad['economicsVersion']   = 'ffffffffffffffffffffffffffffffff';
$r8_stock_fail = br08_dispatch_stock( $r8_plugin, $r8_stock_bad, br08_headers( br06_next_uuid() ) );
br01_assert( br01_status( $r8_stock_fail ) >= 400, 'stock changed economicsVersion fails closed' );
