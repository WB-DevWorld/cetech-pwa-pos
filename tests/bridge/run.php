<?php
/**
 * Lightweight bridge PHP test runner. Executes real assertions.
 * Not live WordPress, Woo, staging, or pricing-gate proof.
 */

error_reporting( E_ALL );
ini_set( 'display_errors', '1' );

$failed = 0;
$passed = 0;

function br01_assert( $condition, $message ) {
	global $failed, $passed;
	if ( $condition ) {
		++$passed;
		echo "PASS {$message}\n";
		return;
	}
	++$failed;
	echo "FAIL {$message}\n";
}

function br01_assert_eq( $expected, $actual, $message ) {
	br01_assert( $expected === $actual, $message . ' expected=' . var_export( $expected, true ) . ' actual=' . var_export( $actual, true ) );
}

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/fake-woo-runtime.php';
require_once __DIR__ . '/test-health.php';
require_once __DIR__ . '/test-quote.php';
require_once __DIR__ . '/test-quote-schema.php';
require_once __DIR__ . '/test-woo-runtime.php';
require_once __DIR__ . '/test-pricing-rules.php';
require_once __DIR__ . '/test-cart-discount.php';
require_once __DIR__ . '/test-prepare.php';
require_once __DIR__ . '/test-finalize-cancel.php';
require_once __DIR__ . '/test-return-effects.php';
require_once __DIR__ . '/test-ws3-generated-return-effects.php';
require_once __DIR__ . '/test-catalog.php';
require_once __DIR__ . '/test-customers.php';

echo "\n{$passed} passed, {$failed} failed\n";
exit( $failed === 0 ? 0 : 1 );
