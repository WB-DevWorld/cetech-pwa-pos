<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Durable independent return-effect claims and per-line stock progress.
 *
 * Uniqueness:
 *   site_scope + operation_type + Idempotency-Key
 *   site_scope + operation_type + effect_id
 *
 * There is intentionally no UNIQUE(site_scope, transaction_id, operation_type).
 * Partial commercial refunds and stock dispositions against one original sale
 * are legitimate. Domain locks serialize remaining-capacity checks per
 * (site, original transaction, effect domain).
 */
class Cetech_Pos_Bridge_Return_Effect_Store {
	const STATUS_PENDING            = 'pending';
	const STATUS_IN_PROGRESS        = 'in_progress';
	const STATUS_COMPLETED          = 'completed';
	const STATUS_TERMINAL_FAILURE   = 'terminal_failure';
	const STATUS_REQUIRES_ATTENTION = 'requires_attention';

	const LINE_NOT_STARTED          = 'not_started';
	const LINE_APPLYING             = 'applying';
	const LINE_COMPLETED            = 'completed';
	const LINE_REQUIRES_ATTENTION   = 'requires_attention';

	const INSERT_CREATED            = 'created';
	const INSERT_DUPLICATE_KEY      = 'duplicate_key';
	const INSERT_DUPLICATE_EFFECT   = 'duplicate_effect';

	const DOMAIN_COMMERCIAL_REFUND  = 'commercial_refund';
	const DOMAIN_STOCK_DISPOSITION  = 'stock_disposition';

	/** @var array<string,bool> */
	private $locks = array();

	/** @var array<string,array<string,mixed>> */
	private $by_key = array();

	/** @var array<string,string> */
	private $effect_index = array();

	/** @var array<string,array<string,mixed>> */
	private $lines = array();

	/** @var callable|null */
	public $during_insert = null;

	public function site_scope() {
		if ( function_exists( 'get_current_blog_id' ) ) {
			return (string) get_current_blog_id();
		}
		return '1';
	}

	/**
	 * @param array<string,mixed> $row
	 * @return string
	 */
	public function insert_effect( array $row ) {
		$scope  = $this->site_scope();
		$key    = $this->key_index( $scope, $row['operation_type'], $row['idempotency_key'] );
		$effect = $this->effect_index_key( $scope, $row['operation_type'], $row['effect_id'] );
		if ( is_callable( $this->during_insert ) ) {
			$cb                  = $this->during_insert;
			$this->during_insert = null;
			$cb( $this );
		}
		if ( $this->has_wpdb() ) {
			return $this->insert_wpdb( $scope, $row );
		}
		if ( isset( $this->by_key[ $key ] ) ) {
			return self::INSERT_DUPLICATE_KEY;
		}
		if ( isset( $this->effect_index[ $effect ] ) ) {
			return self::INSERT_DUPLICATE_EFFECT;
		}
		$now  = gmdate( 'Y-m-d H:i:s' );
		$full = array_merge(
			$row,
			array(
				'site_scope'         => $scope,
				'internal_status'    => self::STATUS_PENDING,
				'provider_reference' => isset( $row['provider_reference'] ) ? $row['provider_reference'] : null,
				'woo_effect_entered' => isset( $row['woo_effect_entered'] ) ? (int) $row['woo_effect_entered'] : 0,
				'outcome_json'       => null,
				'error_code'         => null,
				'error_message'      => null,
				'error_details_json' => null,
				'created_at'         => $now,
				'updated_at'         => $now,
			)
		);
		$this->by_key[ $key ]          = $full;
		$this->effect_index[ $effect ] = $key;
		return self::INSERT_CREATED;
	}

	public function get_by_idempotency( $operation, $idempotency_key ) {
		$scope = $this->site_scope();
		$key   = $this->key_index( $scope, $operation, $idempotency_key );
		if ( $this->has_wpdb() ) {
			return $this->row_wpdb(
				'site_scope = %s AND operation_type = %s AND idempotency_key = %s',
				array( $scope, $operation, $idempotency_key )
			);
		}
		return isset( $this->by_key[ $key ] ) ? $this->by_key[ $key ] : null;
	}

	public function get_by_effect_id( $operation, $effect_id ) {
		$scope  = $this->site_scope();
		$effect = $this->effect_index_key( $scope, $operation, $effect_id );
		if ( $this->has_wpdb() ) {
			return $this->row_wpdb(
				'site_scope = %s AND operation_type = %s AND effect_id = %s',
				array( $scope, $operation, $effect_id )
			);
		}
		if ( ! isset( $this->effect_index[ $effect ] ) ) {
			return null;
		}
		$key = $this->effect_index[ $effect ];
		return isset( $this->by_key[ $key ] ) ? $this->by_key[ $key ] : null;
	}

	/**
	 * @param string $transaction_id
	 * @param string $operation
	 * @return array<int,array<string,mixed>>
	 */
	public function list_by_transaction_operation( $transaction_id, $operation ) {
		$scope = $this->site_scope();
		if ( $this->has_wpdb() ) {
			$wpdb  = $GLOBALS['wpdb'];
			$table = Cetech_Pos_Bridge_Schema_Install::return_effect_table_name( $wpdb );
			$sql   = $wpdb->prepare(
				'SELECT * FROM ' . $table . ' WHERE site_scope = %s AND transaction_id = %s AND operation_type = %s',
				$scope,
				$transaction_id,
				$operation
			);
			$rows = $wpdb->get_results( $sql, ARRAY_A );
			return is_array( $rows ) ? $rows : array();
		}
		$out = array();
		foreach ( $this->by_key as $row ) {
			if ( (string) $row['site_scope'] === $scope
				&& (string) $row['transaction_id'] === (string) $transaction_id
				&& (string) $row['operation_type'] === (string) $operation ) {
				$out[] = $row;
			}
		}
		return $out;
	}

	public function save( array $row ) {
		$scope             = $this->site_scope();
		$row['site_scope'] = $scope;
		$row['updated_at'] = gmdate( 'Y-m-d H:i:s' );
		if ( $this->has_wpdb() ) {
			$wpdb  = $GLOBALS['wpdb'];
			$table = Cetech_Pos_Bridge_Schema_Install::return_effect_table_name( $wpdb );
			$wpdb->update(
				$table,
				array(
					'internal_status'    => $row['internal_status'],
					'provider_reference' => isset( $row['provider_reference'] ) ? $row['provider_reference'] : null,
					'woo_effect_entered' => isset( $row['woo_effect_entered'] ) ? (int) $row['woo_effect_entered'] : 0,
					'request_json'       => isset( $row['request_json'] ) ? $row['request_json'] : null,
					'outcome_json'       => isset( $row['outcome_json'] ) ? $row['outcome_json'] : null,
					'error_code'         => isset( $row['error_code'] ) ? $row['error_code'] : null,
					'error_message'      => isset( $row['error_message'] ) ? $row['error_message'] : null,
					'error_details_json' => isset( $row['error_details_json'] ) ? $row['error_details_json'] : null,
					'updated_at'         => $row['updated_at'],
				),
				array(
					'site_scope'     => $scope,
					'operation_type' => $row['operation_type'],
					'effect_id'      => $row['effect_id'],
				)
			);
			return;
		}
		$key                  = $this->key_index( $scope, $row['operation_type'], $row['idempotency_key'] );
		$this->by_key[ $key ] = $row;
		$this->effect_index[ $this->effect_index_key( $scope, $row['operation_type'], $row['effect_id'] ) ] = $key;
	}

	/**
	 * @param array<string,mixed> $row
	 */
	public function upsert_line( array $row ) {
		$scope = $this->site_scope();
		$idx   = $this->line_index( $scope, $row['operation_type'], $row['effect_id'], $row['line_id'] );
		$now   = gmdate( 'Y-m-d H:i:s' );
		$full  = array_merge(
			$row,
			array(
				'site_scope' => $scope,
				'created_at' => isset( $this->lines[ $idx ]['created_at'] ) ? $this->lines[ $idx ]['created_at'] : $now,
				'updated_at' => $now,
			)
		);
		if ( $this->has_wpdb() ) {
			$existing = $this->get_line( $row['operation_type'], $row['effect_id'], $row['line_id'] );
			$wpdb     = $GLOBALS['wpdb'];
			$table    = Cetech_Pos_Bridge_Schema_Install::return_effect_line_table_name( $wpdb );
			if ( is_array( $existing ) ) {
				$wpdb->update(
					$table,
					array(
						'product_id'      => isset( $full['product_id'] ) ? $full['product_id'] : null,
						'variation_id'    => isset( $full['variation_id'] ) ? $full['variation_id'] : null,
						'quantity'        => $full['quantity'],
						'disposition'     => $full['disposition'],
						'internal_status' => $full['internal_status'],
						'updated_at'      => $full['updated_at'],
					),
					array(
						'site_scope'     => $scope,
						'operation_type' => $full['operation_type'],
						'effect_id'      => $full['effect_id'],
						'line_id'        => $full['line_id'],
					)
				);
				return;
			}
			$wpdb->insert(
				$table,
				array(
					'site_scope'      => $scope,
					'operation_type'  => $full['operation_type'],
					'effect_id'       => $full['effect_id'],
					'line_id'         => $full['line_id'],
					'product_id'      => isset( $full['product_id'] ) ? $full['product_id'] : null,
					'variation_id'    => isset( $full['variation_id'] ) ? $full['variation_id'] : null,
					'quantity'        => $full['quantity'],
					'disposition'     => $full['disposition'],
					'internal_status' => $full['internal_status'],
					'created_at'      => $full['created_at'],
					'updated_at'      => $full['updated_at'],
				)
			);
			return;
		}
		$this->lines[ $idx ] = $full;
	}

	public function get_line( $operation, $effect_id, $line_id ) {
		$scope = $this->site_scope();
		if ( $this->has_wpdb() ) {
			$wpdb  = $GLOBALS['wpdb'];
			$table = Cetech_Pos_Bridge_Schema_Install::return_effect_line_table_name( $wpdb );
			$sql   = $wpdb->prepare(
				'SELECT * FROM ' . $table . ' WHERE site_scope = %s AND operation_type = %s AND effect_id = %s AND line_id = %s LIMIT 1',
				$scope,
				$operation,
				$effect_id,
				$line_id
			);
			$row = $wpdb->get_row( $sql, ARRAY_A );
			return is_array( $row ) ? $row : null;
		}
		$idx = $this->line_index( $scope, $operation, $effect_id, $line_id );
		return isset( $this->lines[ $idx ] ) ? $this->lines[ $idx ] : null;
	}

	/**
	 * @param string $operation
	 * @param string $effect_id
	 * @return array<int,array<string,mixed>>
	 */
	public function list_lines( $operation, $effect_id ) {
		$scope = $this->site_scope();
		if ( $this->has_wpdb() ) {
			$wpdb  = $GLOBALS['wpdb'];
			$table = Cetech_Pos_Bridge_Schema_Install::return_effect_line_table_name( $wpdb );
			$sql   = $wpdb->prepare(
				'SELECT * FROM ' . $table . ' WHERE site_scope = %s AND operation_type = %s AND effect_id = %s',
				$scope,
				$operation,
				$effect_id
			);
			$rows = $wpdb->get_results( $sql, ARRAY_A );
			return is_array( $rows ) ? $rows : array();
		}
		$out = array();
		foreach ( $this->lines as $row ) {
			if ( (string) $row['site_scope'] === $scope
				&& (string) $row['operation_type'] === (string) $operation
				&& (string) $row['effect_id'] === (string) $effect_id ) {
				$out[] = $row;
			}
		}
		return $out;
	}

	/**
	 * @param string $transaction_id
	 * @param string $operation
	 * @return array<int,array<string,mixed>>
	 */
	public function list_lines_for_transaction( $transaction_id, $operation ) {
		$claims = $this->list_by_transaction_operation( $transaction_id, $operation );
		$out    = array();
		foreach ( $claims as $claim ) {
			foreach ( $this->list_lines( $operation, $claim['effect_id'] ) as $line ) {
				$line['_claim'] = $claim;
				$out[]          = $line;
			}
		}
		return $out;
	}

	/**
	 * Non-blocking per-domain lock. Commercial and stock domains are independent.
	 *
	 * @param string $domain commercial_refund|stock_disposition
	 * @param string $transaction_id
	 * @return bool
	 */
	public function acquire_domain_lock( $domain, $transaction_id ) {
		$name = $this->domain_lock_name( $domain, $transaction_id );
		if ( $this->has_wpdb() ) {
			$wpdb = $GLOBALS['wpdb'];
			$got  = $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 0)', $name ) );
			return (string) $got === '1';
		}
		if ( ! empty( $this->locks[ $name ] ) ) {
			return false;
		}
		$this->locks[ $name ] = true;
		return true;
	}

	public function release_domain_lock( $domain, $transaction_id ) {
		$name = $this->domain_lock_name( $domain, $transaction_id );
		if ( $this->has_wpdb() ) {
			$wpdb = $GLOBALS['wpdb'];
			$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $name ) );
			return;
		}
		unset( $this->locks[ $name ] );
	}

	public function domain_lock_held( $domain, $transaction_id ) {
		$name = $this->domain_lock_name( $domain, $transaction_id );
		return ! empty( $this->locks[ $name ] );
	}

	private function insert_wpdb( $scope, array $row ) {
		$wpdb  = $GLOBALS['wpdb'];
		$table = Cetech_Pos_Bridge_Schema_Install::return_effect_table_name( $wpdb );
		$now   = gmdate( 'Y-m-d H:i:s' );
		$ok    = $wpdb->insert(
			$table,
			array(
				'site_scope'         => $scope,
				'operation_type'     => $row['operation_type'],
				'effect_id'          => $row['effect_id'],
				'idempotency_key'    => $row['idempotency_key'],
				'request_hash'       => $row['request_hash'],
				'transaction_id'     => $row['transaction_id'],
				'return_request_id'  => $row['return_request_id'],
				'sale_id'            => $row['sale_id'],
				'order_reference'    => isset( $row['order_reference'] ) ? $row['order_reference'] : null,
				'internal_status'    => self::STATUS_PENDING,
				'woo_effect_entered' => 0,
				'request_json'       => isset( $row['request_json'] ) ? $row['request_json'] : null,
				'created_at'         => $now,
				'updated_at'         => $now,
			)
		);
		if ( $ok ) {
			return self::INSERT_CREATED;
		}
		if ( $this->get_by_idempotency( $row['operation_type'], $row['idempotency_key'] ) ) {
			return self::INSERT_DUPLICATE_KEY;
		}
		if ( $this->get_by_effect_id( $row['operation_type'], $row['effect_id'] ) ) {
			return self::INSERT_DUPLICATE_EFFECT;
		}
		return self::INSERT_DUPLICATE_KEY;
	}

	private function row_wpdb( $where, array $args ) {
		$wpdb  = $GLOBALS['wpdb'];
		$table = Cetech_Pos_Bridge_Schema_Install::return_effect_table_name( $wpdb );
		$sql   = $wpdb->prepare( 'SELECT * FROM ' . $table . ' WHERE ' . $where . ' LIMIT 1', $args );
		$row   = $wpdb->get_row( $sql, ARRAY_A );
		return is_array( $row ) ? $row : null;
	}

	private function has_wpdb() {
		return isset( $GLOBALS['wpdb'] ) && is_object( $GLOBALS['wpdb'] ) && method_exists( $GLOBALS['wpdb'], 'insert' );
	}

	private function key_index( $scope, $operation, $idempotency_key ) {
		return $scope . '|' . $operation . '|' . $idempotency_key;
	}

	private function effect_index_key( $scope, $operation, $effect_id ) {
		return $scope . '|fx|' . $operation . '|' . $effect_id;
	}

	private function line_index( $scope, $operation, $effect_id, $line_id ) {
		return $scope . '|ln|' . $operation . '|' . $effect_id . '|' . $line_id;
	}

	private function domain_lock_name( $domain, $transaction_id ) {
		$prefix = $domain === self::DOMAIN_STOCK_DISPOSITION ? 'cetech_pos_sd_' : 'cetech_pos_cr_';
		return $prefix . md5( $this->site_scope() . '|' . $transaction_id );
	}
}
