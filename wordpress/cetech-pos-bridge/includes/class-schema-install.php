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
			woo_create_entered tinyint(1) NOT NULL DEFAULT 0,
			woo_recovery_token char(64) NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (claim_id),
			UNIQUE KEY uniq_idempotency (site_scope, operation_type, idempotency_key),
			UNIQUE KEY uniq_transaction (site_scope, transaction_id),
			UNIQUE KEY uniq_recovery_token (site_scope, woo_recovery_token)
		) $charset;";
	}

	public static function command_table_name( $wpdb = null ) {
		if ( $wpdb === null && isset( $GLOBALS['wpdb'] ) ) {
			$wpdb = $GLOBALS['wpdb'];
		}
		$prefix = ( is_object( $wpdb ) && isset( $wpdb->prefix ) ) ? (string) $wpdb->prefix : 'wp_';
		return $prefix . 'cetech_pos_command_claims';
	}

	/**
	 * Durable finalize/cancel command claims. Separate from prepare claims so
	 * UNIQUE(site_scope, transaction_id) on prepare is not overloaded.
	 */
	public static function create_command_table_sql( $table ) {
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
			payment_id char(36) NULL,
			evidence_id char(36) NULL,
			internal_status varchar(32) NOT NULL,
			outcome_json longtext NULL,
			error_code varchar(64) NULL,
			error_message varchar(255) NULL,
			error_details_json text NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (claim_id),
			UNIQUE KEY uniq_idempotency (site_scope, operation_type, idempotency_key),
			UNIQUE KEY uniq_command (site_scope, transaction_id, operation_type),
			UNIQUE KEY uniq_payment (site_scope, payment_id),
			UNIQUE KEY uniq_evidence (site_scope, evidence_id)
		) $charset;";
	}

	public static function return_effect_table_name( $wpdb = null ) {
		if ( $wpdb === null && isset( $GLOBALS['wpdb'] ) ) {
			$wpdb = $GLOBALS['wpdb'];
		}
		$prefix = ( is_object( $wpdb ) && isset( $wpdb->prefix ) ) ? (string) $wpdb->prefix : 'wp_';
		return $prefix . 'cetech_pos_return_effect_claims';
	}

	public static function return_effect_line_table_name( $wpdb = null ) {
		if ( $wpdb === null && isset( $GLOBALS['wpdb'] ) ) {
			$wpdb = $GLOBALS['wpdb'];
		}
		$prefix = ( is_object( $wpdb ) && isset( $wpdb->prefix ) ) ? (string) $wpdb->prefix : 'wp_';
		return $prefix . 'cetech_pos_return_effect_lines';
	}

	/**
	 * Independent commercial-refund / stock-disposition claims.
	 * Multiple partial effects per original transaction are legitimate.
	 * Uniqueness is effect identity and Idempotency-Key, never transaction_id.
	 */
	public static function create_return_effect_table_sql( $table ) {
		$charset = 'DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci';
		if ( isset( $GLOBALS['wpdb'] ) && is_object( $GLOBALS['wpdb'] ) && method_exists( $GLOBALS['wpdb'], 'get_charset_collate' ) ) {
			$charset = $GLOBALS['wpdb']->get_charset_collate();
		}
		return 'CREATE TABLE ' . $table . " (
			claim_id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			site_scope varchar(64) NOT NULL,
			operation_type varchar(32) NOT NULL,
			effect_id char(36) NOT NULL,
			idempotency_key char(36) NOT NULL,
			request_hash char(64) NOT NULL,
			transaction_id char(36) NOT NULL,
			return_request_id char(36) NOT NULL,
			sale_id varchar(128) NOT NULL,
			order_reference varchar(128) NULL,
			provider_reference varchar(128) NULL,
			internal_status varchar(32) NOT NULL,
			woo_effect_entered tinyint(1) NOT NULL DEFAULT 0,
			request_json longtext NULL,
			outcome_json longtext NULL,
			error_code varchar(64) NULL,
			error_message varchar(255) NULL,
			error_details_json text NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (claim_id),
			UNIQUE KEY uniq_idempotency (site_scope, operation_type, idempotency_key),
			UNIQUE KEY uniq_effect (site_scope, operation_type, effect_id)
		) $charset;";
	}

	/**
	 * Durable per-line stock-disposition progress. Not process memory.
	 */
	public static function create_return_effect_line_table_sql( $table ) {
		$charset = 'DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci';
		if ( isset( $GLOBALS['wpdb'] ) && is_object( $GLOBALS['wpdb'] ) && method_exists( $GLOBALS['wpdb'], 'get_charset_collate' ) ) {
			$charset = $GLOBALS['wpdb']->get_charset_collate();
		}
		return 'CREATE TABLE ' . $table . " (
			line_progress_id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			site_scope varchar(64) NOT NULL,
			operation_type varchar(32) NOT NULL,
			effect_id char(36) NOT NULL,
			line_id varchar(128) NOT NULL,
			product_id varchar(128) NULL,
			variation_id varchar(128) NULL,
			quantity varchar(32) NOT NULL,
			disposition varchar(32) NOT NULL,
			internal_status varchar(32) NOT NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (line_progress_id),
			UNIQUE KEY uniq_effect_line (site_scope, operation_type, effect_id, line_id)
		) $charset;";
	}

	public static function activate() {
		global $wpdb;
		$prepare_sql = self::create_table_sql( self::table_name( $wpdb ) );
		$command_sql = self::create_command_table_sql( self::command_table_name( $wpdb ) );
		$effect_sql  = self::create_return_effect_table_sql( self::return_effect_table_name( $wpdb ) );
		$line_sql    = self::create_return_effect_line_table_sql( self::return_effect_line_table_name( $wpdb ) );
		if ( function_exists( 'dbDelta' ) ) {
			dbDelta( $prepare_sql );
			dbDelta( $command_sql );
			dbDelta( $effect_sql );
			dbDelta( $line_sql );
		} elseif ( is_object( $wpdb ) && method_exists( $wpdb, 'query' ) ) {
			$wpdb->query( $prepare_sql );
			$wpdb->query( $command_sql );
			$wpdb->query( $effect_sql );
			$wpdb->query( $line_sql );
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
