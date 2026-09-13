<?php
/**
 * Plugin Name: CETECH POS Bridge
 * Description: Server-only CETECH POS WooCommerce bridge. Isolated quote uses Woo runtime totals; it does not copy WoodMart/B2BKing formulas.
 * Version: 0.2.6-br02
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
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-health-controller.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-money.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-ephemeral-session.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-woo-runtime.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-quote-request.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-quote-store.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-quote-engine.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-quote-controller.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-pricing-rules.php';
require_once CETECH_POS_BRIDGE_DIR . '/includes/class-plugin.php';

Cetech_Pos_Bridge_Plugin::instance()->boot();
