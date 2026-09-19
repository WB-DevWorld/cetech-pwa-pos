<?php
/**
 * Plugin Name: CETECH POS Bridge
 * Description: Server-only CETECH POS WooCommerce bridge. Isolated quote uses Woo runtime totals; it does not copy WoodMart/B2BKing formulas.
 * Version: 0.6.0-stg05
 * Requires at least: 6.0
 * Requires PHP: 8.0
 * Text Domain: cetech-pos-bridge
 *
 * Do not install this plugin on production or training without an authorized environment task.
 * This file does not create users, Application Passwords, or capabilities.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'CETECH_POS_BRIDGE_FILE' ) ) {
	define( 'CETECH_POS_BRIDGE_FILE', __FILE__ );
}

if ( ! defined( 'CETECH_POS_BRIDGE_DIR' ) ) {
	define( 'CETECH_POS_BRIDGE_DIR', __DIR__ );
}

require_once CETECH_POS_BRIDGE_DIR . '/includes/class-constants.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-environment.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-auth.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-correlation.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-detector.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-response.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-schema.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-health-controller.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-money.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-cart-discount.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-ephemeral-session.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-woo-runtime.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-quote-request.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-quote-store.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-quote-engine.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-quote-controller.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-request-hash.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-schema-install.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-claim-store.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-command-store.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-prepare-engine.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-prepare-controller.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-resolve-controller.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-command-engine.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-finalize-controller.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-cancel-controller.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-return-effect-store.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-return-effect-engine.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-commercial-refund-controller.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-stock-disposition-controller.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-catalog-engine.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-catalog-controller.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-customers-engine.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-customers-controller.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-pricing-rules.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-plugin.php';

if ( function_exists( 'register_activation_hook' ) ) {
	register_activation_hook( CETECH_POS_BRIDGE_FILE, array( 'Cetech_Pos_Bridge_Schema_Install', 'activate' ) );
}

Cetech_Pos_Bridge_Plugin::instance()->boot();
