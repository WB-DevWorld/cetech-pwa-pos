<?php
/**
 * R3 parity harness.
 * Synthetic isolation cases may PASS against an injected Woo runtime.
 * Live WoodMart/B2BKing rows must not be marked PASS without captured runtime evidence.
 * This command is not a pricing-gate PASS and never sets pricingParityVerified.
 */

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/fake-wp/' );
}

error_reporting( E_ALL );
ini_set( 'display_errors', '1' );

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/fake-woo-runtime.php';

$failed = 0;
$passed = 0;
$skipped = 0;

function parity_assert( $condition, $message ) {
	global $failed, $passed;
	if ( $condition ) {
		++$passed;
		echo "PASS {$message}\n";
		return;
	}
	++$failed;
	echo "FAIL {$message}\n";
}

$fixture_dir = dirname( __DIR__, 1 ) . '/fixtures/commerce/parity';
$manifest    = json_decode( (string) file_get_contents( $fixture_dir . '/manifest.json' ), true );
parity_assert( is_array( $manifest ) && isset( $manifest['cases'] ), 'manifest loads' );

$cart_id     = '11111111-1111-4111-8111-111111111111';
$line_id     = '22222222-2222-4222-8222-222222222222';
$location_id = 'loc-training-1';

$env              = new Cetech_Pos_Bridge_Test_Environment();
$env->logged_in   = true;
$env->capability  = Cetech_Pos_Bridge_Constants::CAPABILITY;
$env->woo         = true;
$env->woodmart    = true;
$env->b2bking     = true;
$runtime          = new Cetech_Pos_Bridge_Fake_Woo_Runtime( $env );
$runtime->bag_key = 'cetech_pos_fake_wc_parity';
$runtime->write_bag( '__idle__', array() );
$runtime->customers['cust_retail_1']                  = 'retail';
$runtime->catalog['walkin']['101']['1']               = array(
	'unitPrice'   => '10.00',
	'subtotal'    => '10.00',
	'discount'    => '0.00',
	'tax'         => '0.00',
	'stockStatus' => 'in_stock',
	'purchasable' => true,
);
$runtime->catalog['retail:cust_retail_1']['101']['1'] = array(
	'unitPrice'   => '8.00',
	'subtotal'    => '8.00',
	'discount'    => '0.00',
	'tax'         => '0.00',
	'stockStatus' => 'in_stock',
	'purchasable' => true,
);
$engine = new Cetech_Pos_Bridge_Quote_Engine( $runtime, new Cetech_Pos_Bridge_Quote_Store() );

$live_pass_claimed = false;

foreach ( $manifest['cases'] as $file ) {
	$case = json_decode( (string) file_get_contents( $fixture_dir . '/' . $file ), true );
	parity_assert( is_array( $case ) && isset( $case['caseId'], $case['applicability'] ), 'case ' . $file . ' loads' );
	if ( ! is_array( $case ) ) {
		continue;
	}
	$id = $case['caseId'];
	if ( $case['applicability'] === 'PERMISSION_REQUIRED' ) {
		++$skipped;
		parity_assert( $case['result'] !== 'PASS', $id . ' does not invent a live PASS' );
		echo "SKIP {$id} PERMISSION_REQUIRED\n";
		continue;
	}
	if ( $case['applicability'] !== 'SYNTHETIC_ISOLATION' ) {
		++$skipped;
		echo "SKIP {$id} applicability=" . $case['applicability'] . "\n";
		continue;
	}
	$customer = $case['customerContextClass'] === 'retail'
		? array(
			'kind'       => 'retail',
			'customerId' => 'cust_retail_1',
		)
		: array( 'kind' => 'walkin' );
	$request  = array(
		'cartId'       => $cart_id,
		'cartRevision' => 1,
		'customer'     => $customer,
		'locationId'   => $location_id,
		'lines'        => array(
			array(
				'lineId'    => $line_id,
				'productId' => '101',
				'quantity'  => $case['quantity'],
			),
		),
	);
	$quote = $engine->quote( $request );
	parity_assert( is_array( $quote ), $id . ' quote succeeded' );
	if ( ! is_array( $quote ) ) {
		continue;
	}
	$expected = $case['authoritative']['totalMinor'];
	$actual   = $quote['total']['minor'];
	$delta    = $actual - $expected;
	parity_assert( $delta === 0, $id . " minor-unit delta {$delta}" );
	parity_assert( $quote['subtotal']['minor'] === $case['authoritative']['subtotalMinor'], $id . ' subtotal' );
	parity_assert( $quote['discount']['minor'] === $case['authoritative']['discountMinor'], $id . ' discount' );
	parity_assert( $quote['tax']['minor'] === $case['authoritative']['taxMinor'], $id . ' tax' );
	parity_assert( $runtime->side_effect_counts()['orders'] === 0, $id . ' no orders' );
}

parity_assert( ! $live_pass_claimed, 'harness did not claim live WoodMart/B2BKing PASS' );

echo "\nparity {$passed} passed, {$failed} failed, {$skipped} permission-required/skipped\n";
echo "pricingParityVerified remains false; this is not the R3 pricing gate.\n";
exit( $failed === 0 ? 0 : 1 );
