<?php

$valid_correlation = '550e8400-e29b-41d4-a716-446655440000';

function br01_dispatch( Cetech_Pos_Bridge_Test_Environment $env, array $headers ) {
	$plugin = new Cetech_Pos_Bridge_Plugin( $env );
	$plugin->register_routes();
	$controller = $plugin->get_controller();
	$request    = new Cetech_Pos_Bridge_Test_Request( $headers );
	$permission = $controller->permission_callback( $request );
	if ( $permission !== true ) {
		return Cetech_Pos_Bridge_Response::from_wp_error( $permission, Cetech_Pos_Bridge_Correlation::generate_uuid() );
	}
	return $controller->handle( $request );
}

function br01_payload( $response ) {
	return Cetech_Pos_Bridge_Response::extract_payload( $response );
}

function br01_status( $response ) {
	return Cetech_Pos_Bridge_Response::extract_status( $response );
}

function br01_authorized_env() {
	$env              = new Cetech_Pos_Bridge_Test_Environment();
	$env->logged_in   = true;
	$env->capability  = Cetech_Pos_Bridge_Constants::CAPABILITY;
	$env->woo         = true;
	$env->woodmart    = true;
	$env->b2bking     = true;
	return $env;
}

$plugin = new Cetech_Pos_Bridge_Plugin( new Cetech_Pos_Bridge_Test_Environment() );
$plugin->register_routes();
$routes = $plugin->get_registered_routes();
br01_assert( count( $routes ) === 1, 'registers exactly one route' );
br01_assert_eq( 'cetech-pos/v1', $routes[0]['namespace'], 'route namespace' );
br01_assert_eq( '/health', $routes[0]['route'], 'route path' );
br01_assert_eq( 'GET', $routes[0]['args']['methods'], 'route method' );
br01_assert( isset( $routes[0]['args']['permission_callback'] ), 'permission_callback present' );
br01_assert( isset( $GLOBALS['cetech_pos_registered_routes'][0] ), 'register_rest_route invoked' );
br01_assert_eq( 'cetech-pos/v1', $GLOBALS['cetech_pos_registered_routes'][0]['namespace'], 'captured namespace' );

$unauth = br01_dispatch( new Cetech_Pos_Bridge_Test_Environment(), array( 'X-Correlation-ID' => $valid_correlation ) );
$unauth_payload = br01_payload( $unauth );
br01_assert_eq( 401, br01_status( $unauth ), 'unauthenticated HTTP status' );
br01_assert_eq( false, $unauth_payload['ok'], 'unauthenticated ok=false' );
br01_assert_eq( 'AUTH_REQUIRED', $unauth_payload['error']['code'], 'unauthenticated code' );
br01_assert_eq( false, $unauth_payload['error']['retryable'], 'unauthenticated retryable' );
br01_assert_eq( 'reauthenticate', $unauth_payload['error']['nextAction'], 'unauthenticated nextAction' );

$admin_without_cap              = new Cetech_Pos_Bridge_Test_Environment();
$admin_without_cap->logged_in   = true;
$admin_without_cap->capability  = 'manage_options';
$denied = br01_dispatch( $admin_without_cap, array( 'X-Correlation-ID' => $valid_correlation ) );
$denied_payload = br01_payload( $denied );
br01_assert_eq( 403, br01_status( $denied ), 'authenticated without capability HTTP status' );
br01_assert_eq( 'FORBIDDEN', $denied_payload['error']['code'], 'authenticated without capability code' );
br01_assert_eq( false, $denied_payload['error']['retryable'], 'forbidden retryable' );
br01_assert_eq( 'none', $denied_payload['error']['nextAction'], 'forbidden nextAction' );

$allowed = br01_dispatch( br01_authorized_env(), array( 'X-Correlation-ID' => $valid_correlation ) );
$allowed_payload = br01_payload( $allowed );
br01_assert_eq( 200, br01_status( $allowed ), 'authenticated with capability HTTP status' );
br01_assert_eq( true, $allowed_payload['ok'], 'authenticated with capability ok=true' );

$missing = br01_dispatch( br01_authorized_env(), array() );
$missing_payload = br01_payload( $missing );
br01_assert_eq( 400, br01_status( $missing ), 'missing correlation HTTP status' );
br01_assert_eq( 'VALIDATION_ERROR', $missing_payload['error']['code'], 'missing correlation code' );
br01_assert_eq( 'X-Correlation-ID', $missing_payload['error']['details']['field'], 'missing correlation field' );
br01_assert( preg_match( Cetech_Pos_Bridge_Constants::UUID_PATTERN, $missing_payload['correlationId'] ) === 1, 'rejected missing correlation generates contract UUID' );
br01_assert( $missing_payload['correlationId'] !== $valid_correlation, 'generated UUID is not an echo of a missing header' );

$malformed = br01_dispatch( br01_authorized_env(), array( 'X-Correlation-ID' => 'NOT-A-UUID' ) );
$malformed_payload = br01_payload( $malformed );
br01_assert_eq( 400, br01_status( $malformed ), 'malformed correlation HTTP status' );
br01_assert_eq( 'VALIDATION_ERROR', $malformed_payload['error']['code'], 'malformed correlation code' );
br01_assert( $malformed_payload['correlationId'] !== 'NOT-A-UUID', 'malformed correlation is not echoed' );

$uppercase = br01_dispatch( br01_authorized_env(), array( 'X-Correlation-ID' => strtoupper( $valid_correlation ) ) );
$uppercase_payload = br01_payload( $uppercase );
br01_assert_eq( 400, br01_status( $uppercase ), 'uppercase UUID fails the frozen lowercase Uuid pattern' );
br01_assert_eq( 'VALIDATION_ERROR', $uppercase_payload['error']['code'], 'uppercase UUID code' );
br01_assert( $uppercase_payload['correlationId'] !== strtoupper( $valid_correlation ), 'invalid uppercase ID is not echoed' );

$success = br01_payload( br01_dispatch( br01_authorized_env(), array( 'X-Correlation-ID' => $valid_correlation ) ) );
br01_assert_eq( $valid_correlation, $success['correlationId'], 'valid correlation ID echoed unchanged' );
br01_assert_eq( array( 'ok', 'data', 'correlationId' ), array_keys( $success ), 'success envelope keys only' );
br01_assert_eq(
	array( 'status', 'contractVersion', 'wooDetected', 'woodmartDetected', 'b2bkingDetected', 'pricingParityVerified' ),
	array_keys( $success['data'] ),
	'BridgeHealth keys only'
);
br01_assert_eq( '1.0.0', $success['data']['contractVersion'], 'contractVersion exactly 1.0.0' );
br01_assert_eq( false, $success['data']['pricingParityVerified'], 'pricingParityVerified always false on success' );

$no_woo            = br01_authorized_env();
$no_woo->woo       = false;
$no_woo_payload    = br01_payload( br01_dispatch( $no_woo, array( 'X-Correlation-ID' => $valid_correlation ) ) );
br01_assert_eq( false, $no_woo_payload['data']['wooDetected'], 'woo false' );
br01_assert_eq( 'unavailable', $no_woo_payload['data']['status'], 'Woo absent → unavailable' );
br01_assert_eq( false, $no_woo_payload['data']['pricingParityVerified'], 'unavailable is not parity' );

$woo_only          = br01_authorized_env();
$woo_only->woodmart = false;
$woo_only->b2bking  = false;
$woo_only_payload  = br01_payload( br01_dispatch( $woo_only, array( 'X-Correlation-ID' => $valid_correlation ) ) );
br01_assert_eq( true, $woo_only_payload['data']['wooDetected'], 'woo true' );
br01_assert_eq( 'degraded', $woo_only_payload['data']['status'], 'Woo present without integrations → degraded' );

$missing_b2b         = br01_authorized_env();
$missing_b2b->b2bking = false;
$missing_b2b_payload = br01_payload( br01_dispatch( $missing_b2b, array( 'X-Correlation-ID' => $valid_correlation ) ) );
br01_assert_eq( false, $missing_b2b_payload['data']['b2bkingDetected'], 'b2bking false' );
br01_assert_eq( 'degraded', $missing_b2b_payload['data']['status'], 'missing B2BKing → degraded' );

$missing_wood         = br01_authorized_env();
$missing_wood->woodmart = false;
$missing_wood_payload = br01_payload( br01_dispatch( $missing_wood, array( 'X-Correlation-ID' => $valid_correlation ) ) );
br01_assert_eq( false, $missing_wood_payload['data']['woodmartDetected'], 'woodmart false' );
br01_assert_eq( 'degraded', $missing_wood_payload['data']['status'], 'missing WoodMart → degraded' );

$all_present_payload = br01_payload( br01_dispatch( br01_authorized_env(), array( 'X-Correlation-ID' => $valid_correlation ) ) );
br01_assert_eq( true, $all_present_payload['data']['wooDetected'], 'woo detected true' );
br01_assert_eq( true, $all_present_payload['data']['woodmartDetected'], 'woodmart detected true' );
br01_assert_eq( true, $all_present_payload['data']['b2bkingDetected'], 'b2bking detected true' );
br01_assert_eq( 'healthy', $all_present_payload['data']['status'], 'all detected → healthy' );
br01_assert_eq( false, $all_present_payload['data']['pricingParityVerified'], 'healthy detection is not parity' );

$parent = new Cetech_Pos_Bridge_Test_Theme( 'woodmart', 'woodmart' );
$child  = new Cetech_Pos_Bridge_Test_Theme( 'woodmart-child', 'woodmart', $parent );
$GLOBALS['cetech_pos_test_theme'] = $child;
$theme_env             = br01_authorized_env();
$theme_env->use_theme  = true;
$theme_env->woodmart   = false;
$theme_payload         = br01_payload( br01_dispatch( $theme_env, array( 'X-Correlation-ID' => $valid_correlation ) ) );
br01_assert_eq( true, $theme_payload['data']['woodmartDetected'], 'WoodMart detected via child theme parent/template' );

$unrelated = new Cetech_Pos_Bridge_Test_Theme( 'storefront', 'storefront' );
$GLOBALS['cetech_pos_test_theme'] = $unrelated;
$theme_env->woodmart = false;
$unrelated_payload = br01_payload( br01_dispatch( $theme_env, array( 'X-Correlation-ID' => $valid_correlation ) ) );
br01_assert_eq( false, $unrelated_payload['data']['woodmartDetected'], 'unrelated theme is not WoodMart' );

$direct_parent = new Cetech_Pos_Bridge_Test_Theme( 'woodmart', 'woodmart' );
$GLOBALS['cetech_pos_test_theme'] = $direct_parent;
$direct_payload = br01_payload( br01_dispatch( $theme_env, array( 'X-Correlation-ID' => $valid_correlation ) ) );
br01_assert_eq( true, $direct_payload['data']['woodmartDetected'], 'WoodMart detected as active parent stylesheet' );

$encoded = json_encode( $all_present_payload );
br01_assert( strpos( $encoded, 'cetech_pos_bridge_access' ) === false, 'capability name not leaked in success body' );
br01_assert( stripos( $encoded, 'password' ) === false, 'no password field in success body' );
br01_assert( strpos( $encoded, 'ABSPATH' ) === false, 'no filesystem constant in success body' );
br01_assert( ! isset( $all_present_payload['data']['pluginPath'] ), 'no pluginPath field' );

br01_assert_eq( array(), $no_woo->mutations, 'health performed no recorded commerce mutations' );
br01_assert(
	! function_exists( 'wc_create_order' ) && ! function_exists( 'wc_update_product_stock' ),
	'health harness did not load Woo commerce mutation APIs'
);

$woo_by_constant              = new Cetech_Pos_Bridge_Probe_Environment();
$woo_by_constant->constants[] = 'WC_VERSION';
br01_assert( $woo_by_constant->wc_available(), 'Woo detected via WC_VERSION' );

$woo_by_class            = new Cetech_Pos_Bridge_Probe_Environment();
$woo_by_class->classes[] = 'WooCommerce';
br01_assert( $woo_by_class->wc_available(), 'Woo detected via WooCommerce class' );

$woo_by_plugin            = new Cetech_Pos_Bridge_Probe_Environment();
$woo_by_plugin->plugins[] = Cetech_Pos_Bridge_Constants::WOO_PLUGIN_BASENAME;
br01_assert( $woo_by_plugin->wc_available(), 'Woo detected via official plugin basename' );
br01_assert( ! ( new Cetech_Pos_Bridge_Probe_Environment() )->wc_available(), 'Woo absent when no public signal exists' );

$b2b_by_class            = new Cetech_Pos_Bridge_Probe_Environment();
$b2b_by_class->classes[] = 'B2bking';
br01_assert( $b2b_by_class->b2bking_available(), 'B2BKing detected via public class' );

$b2b_by_plugin            = new Cetech_Pos_Bridge_Probe_Environment();
$b2b_by_plugin->plugins[] = 'b2bking/b2bking.php';
br01_assert( $b2b_by_plugin->b2bking_available(), 'B2BKing detected via conservative official basename' );
br01_assert( ! ( new Cetech_Pos_Bridge_Probe_Environment() )->b2bking_available(), 'B2BKing absent when no public signal exists' );

br01_assert_eq( 'cetech_pos_bridge_access', Cetech_Pos_Bridge_Constants::CAPABILITY, 'dedicated capability name' );

$example = json_decode( file_get_contents( dirname( __DIR__ ) . '/fixtures/commerce/bridge-health.success.example.json' ), true );
br01_assert_eq( false, $example['data']['pricingParityVerified'], 'fixture parity remains false' );
br01_assert_eq( '1.0.0', $example['data']['contractVersion'], 'fixture contract version' );
