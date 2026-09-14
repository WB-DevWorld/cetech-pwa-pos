<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Bridge-owned prepare-claim table. Not Woo HPOS storage.
 *
 * Versioned option `cetech_pos_bridge_db_version` skips DDL on every request.
 * dbDelta is idempotent. UNIQUE indexes are the atomic claim, not order meta.
 */
final class Cetech_Pos_Bridge_Schema_Install {
	public static function table_name( $wpdb = null ) {
		if ( $wpdb === null && isset( $GLOBALS['wpdb'] ) ) {
			$wpdb = $GLOBALS['wpdb'];
		}
		$prefix = ( is_object( $wpdb ) && isset( $wpdb->prefix ) ) ? (string) $wpdb->prefix : 'wp_';
		return $prefix . 'cetech_pos_prepare_claims';
	}

	/**
	 * CREATE TABLE used by dbDelta / tests. UNIQUE (site_scope, operation, key)
	 * and UNIQUE (site_scope, transaction_id) are required.
	 */
	public static function create_table_sql( $table ) {
		$charset = 'DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci';
		if ( isset( $GLOBALS['wpdb'] ) && is_object( $GLOBALS['wpdb'] ) && method_exists( $GLOBALS['wpdb'], 'get_charset_collate' ) ) {
			$charset = $GLOBALS['wpdb']->get_charset_collate();
		}
		return 'CREATE TABLE ' . $table . " (
			claim_id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			site_scope varchar(64) NOT NULL,
			operation_type varchar(32) NOT NULL,
			idempotency_key char(36) NOT NULL,
			transaction_id char(36) NOT NULL,
			request_hash char(64) NOT NULL,
			quote_id varchar(128) NULL,
			internal_status varchar(32) NOT NULL,
			woo_order_id varchar(64) NULL,
			sale_id varchar(128) NULL,
			outcome_json longtext NULL,
			error_code varchar(64) NULL,
			error_message varchar(255) NULL,
			error_details_json text NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (claim_id),
			UNIQUE KEY uniq_idempotency (site_scope, operation_type, idempotency_key),
			UNIQUE KEY uniq_transaction (site_scope, transaction_id)
		) $charset;";
	}

	public static function activate() {
		global $wpdb;
		$table = self::table_name( $wpdb );
		$sql   = self::create_table_sql( $table );
		if ( function_exists( 'dbDelta' ) ) {
			dbDelta( $sql );
		} elseif ( is_object( $wpdb ) && method_exists( $wpdb, 'query' ) ) {
			$wpdb->query( $sql );
		}
		if ( function_exists( 'update_option' ) ) {
			update_option( Cetech_Pos_Bridge_Constants::DB_VERSION_OPTION, Cetech_Pos_Bridge_Constants::DB_VERSION, true );
		}
	}

	/**
	 * Cheap version gate. Does not run DDL when the installed version matches.
	 */
	public static function maybe_upgrade() {
		$current = function_exists( 'get_option' )
			? (string) get_option( Cetech_Pos_Bridge_Constants::DB_VERSION_OPTION, '' )
			: '';
		if ( $current === Cetech_Pos_Bridge_Constants::DB_VERSION ) {
			return;
		}
		if ( function_exists( 'dbDelta' ) ) {
			self::activate();
			return;
		}
		$upgrade = ABSPATH . 'wp-admin/includes/upgrade.php';
		if ( defined( 'ABSPATH' ) && is_readable( $upgrade ) ) {
			require_once $upgrade;
		}
		self::activate();
	}
}
