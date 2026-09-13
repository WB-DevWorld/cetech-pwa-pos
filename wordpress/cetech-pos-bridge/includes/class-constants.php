<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Cetech_Pos_Bridge_Constants {
	const NAMESPACE           = 'cetech-pos/v1';
	const HEALTH_ROUTE        = '/health';
	const QUOTE_ROUTE         = '/quotes';
	const CAPABILITY          = 'cetech_pos_bridge_access';
	const CONTRACT            = '1.0.0';
	const UUID_PATTERN        = '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/';
	const ID_PATTERN          = '/^[A-Za-z0-9][A-Za-z0-9._:-]*$/';
	const QUANTITY_PATTERN    = '/^(0\.[0-9]{0,5}[1-9]|[1-9][0-9]{0,8}(\.[0-9]{0,5}[1-9])?)$/';
	const TIMESTAMP_PATTERN   = '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/';
	const SETTLEMENT_CURRENCY = 'GHS';
	const PRICE_DECIMALS      = 2;
	const QUOTE_TTL_SECONDS   = 900;

	/**
	 * Official WooCommerce plugin basename.
	 */
	const WOO_PLUGIN_BASENAME = 'woocommerce/woocommerce.php';

	/**
	 * Public theme identifiers used by WordPress theme APIs (stylesheet or parent template).
	 */
	const WOODMART_THEME_SLUG = 'woodmart';

	/**
	 * Conservative public plugin basenames. The authenticated CP-04 audit recorded
	 * B2BKing Core/Pro by name/version, not a committed basename. These are official
	 * WordPress.org / vendor file names, not pricing APIs.
	 */
	const B2BKING_PLUGIN_BASENAMES = array(
		'b2bking/b2bking.php',
		'b2bking-wholesale-for-woocommerce/b2bking.php',
		'b2bking-wholesale-for-woocommerce/b2bking-wholesale-for-woocommerce.php',
	);
}
