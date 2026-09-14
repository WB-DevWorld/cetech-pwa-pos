<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Durable finalize/cancel command claims.
 *
 * Uniqueness:
 *   site_scope + operation_type + Idempotency-Key
 *   site_scope + transaction_id + operation_type
 *   site_scope + payment_id (NULL allowed for cancel)
 *   site_scope + evidence_id (NULL allowed for cancel)
 *
 * Transaction mutation lock is site_scope + transactionId and is shared by
 * finalize and cancel. It is not the prepare creator lock.
 */
class Cetech_Pos_Bridge_Command_Store {
	const STATUS_PENDING            = 'pending';
	const STATUS_IN_PROGRESS        = 'in_progress';
	const STATUS_COMPLETED          = 'completed';
	const STATUS_TERMINAL_FAILURE   = 'terminal_failure';
	const STATUS_REQUIRES_ATTENTION = 'requires_attention';

	const INSERT_CREATED             = 'created';
	const INSERT_DUPLICATE_KEY       = 'duplicate_key';
	const INSERT_DUPLICATE_COMMAND   = 'duplicate_command';
	const INSERT_DUPLICATE_PAYMENT   = 'duplicate_payment';
	const INSERT_DUPLICATE_EVIDENCE  = 'duplicate_evidence';

	/** @var array<string,bool> */
	private $locks = array();

	/** @var array<string,array<string,mixed>> */
	private $by_key = array();

	/** @var array<string,string> */
	private $command_index = array();

	/** @var array<string,string> */
	private $payment_index = array();

	/** @var array<string,string> */
	private $evidence_index = array();

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
	 * @return string One of INSERT_* constants
	 */
	public function insert_command( array $row ) {
		$scope = $this->site_scope();
		$key   = $this->key_index( $scope, $row['operation_type'], $row['idempotency_key'] );
		$cmd   = $this->command_index_key( $scope, $row['transaction_id'], $row['operation_type'] );
		if ( is_callable( $this->during_insert ) ) {
			$cb = $this->during_insert;
			$this->during_insert = null;
			$cb( $this );
		}
		if ( $this->has_wpdb() ) {
			return $this->insert_wpdb( $scope, $row );
		}
		if ( isset( $this->by_key[ $key ] ) ) {
			return self::INSERT_DUPLICATE_KEY;
		}
		if ( isset( $this->command_index[ $cmd ] ) ) {
			return self::INSERT_DUPLICATE_COMMAND;
		}
		$payment_id  = isset( $row['payment_id'] ) && is_string( $row['payment_id'] ) && $row['payment_id'] !== '' ? $row['payment_id'] : null;
		$evidence_id = isset( $row['evidence_id'] ) && is_string( $row['evidence_id'] ) && $row['evidence_id'] !== '' ? $row['evidence_id'] : null;
		if ( $payment_id !== null && isset( $this->payment_index[ $this->payment_index_key( $scope, $payment_id ) ] ) ) {
			return self::INSERT_DUPLICATE_PAYMENT;
		}
		if ( $evidence_id !== null && isset( $this->evidence_index[ $this->evidence_index_key( $scope, $evidence_id ) ] ) ) {
			return self::INSERT_DUPLICATE_EVIDENCE;
		}
		$now  = gmdate( 'Y-m-d H:i:s' );
		$full = array_merge(
			$row,
			array(
				'site_scope'         => $scope,
				'internal_status'    => self::STATUS_PENDING,
				'payment_id'         => $payment_id,
				'evidence_id'        => $evidence_id,
				'outcome_json'       => null,
				'error_code'         => null,
				'error_message'      => null,
				'error_details_json' => null,
				'created_at'         => $now,
				'updated_at'         => $now,
			)
		);
		$this->by_key[ $key ]         = $full;
		$this->command_index[ $cmd ]  = $key;
		if ( $payment_id !== null ) {
			$this->payment_index[ $this->payment_index_key( $scope, $payment_id ) ] = $key;
		}
		if ( $evidence_id !== null ) {
			$this->evidence_index[ $this->evidence_index_key( $scope, $evidence_id ) ] = $key;
		}
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

	public function get_by_transaction_operation( $transaction_id, $operation ) {
		$scope = $this->site_scope();
		$cmd   = $this->command_index_key( $scope, $transaction_id, $operation );
		if ( $this->has_wpdb() ) {
			return $this->row_wpdb(
				'site_scope = %s AND transaction_id = %s AND operation_type = %s',
				array( $scope, $transaction_id, $operation )
			);
		}
		if ( ! isset( $this->command_index[ $cmd ] ) ) {
			return null;
		}
		$key = $this->command_index[ $cmd ];
		return isset( $this->by_key[ $key ] ) ? $this->by_key[ $key ] : null;
	}

	public function get_by_payment_id( $payment_id ) {
		if ( ! is_string( $payment_id ) || $payment_id === '' ) {
			return null;
		}
		$scope = $this->site_scope();
		if ( $this->has_wpdb() ) {
			return $this->row_wpdb( 'site_scope = %s AND payment_id = %s', array( $scope, $payment_id ) );
		}
		$idx = $this->payment_index_key( $scope, $payment_id );
		if ( ! isset( $this->payment_index[ $idx ] ) ) {
			return null;
		}
		$key = $this->payment_index[ $idx ];
		return isset( $this->by_key[ $key ] ) ? $this->by_key[ $key ] : null;
	}

	public function get_by_evidence_id( $evidence_id ) {
		if ( ! is_string( $evidence_id ) || $evidence_id === '' ) {
			return null;
		}
		$scope = $this->site_scope();
		if ( $this->has_wpdb() ) {
			return $this->row_wpdb( 'site_scope = %s AND evidence_id = %s', array( $scope, $evidence_id ) );
		}
		$idx = $this->evidence_index_key( $scope, $evidence_id );
		if ( ! isset( $this->evidence_index[ $idx ] ) ) {
			return null;
		}
		$key = $this->evidence_index[ $idx ];
		return isset( $this->by_key[ $key ] ) ? $this->by_key[ $key ] : null;
	}

	public function save( array $row ) {
		$scope             = $this->site_scope();
		$row['site_scope'] = $scope;
		$row['updated_at'] = gmdate( 'Y-m-d H:i:s' );
		if ( $this->has_wpdb() ) {
			$wpdb  = $GLOBALS['wpdb'];
			$table = Cetech_Pos_Bridge_Schema_Install::command_table_name( $wpdb );
			$wpdb->update(
				$table,
				array(
					'internal_status'    => $row['internal_status'],
					'payment_id'         => isset( $row['payment_id'] ) ? $row['payment_id'] : null,
					'evidence_id'        => isset( $row['evidence_id'] ) ? $row['evidence_id'] : null,
					'outcome_json'       => $row['outcome_json'],
					'error_code'         => $row['error_code'],
					'error_message'      => $row['error_message'],
					'error_details_json' => $row['error_details_json'],
					'updated_at'         => $row['updated_at'],
				),
				array(
					'site_scope'      => $scope,
					'operation_type'  => $row['operation_type'],
					'idempotency_key' => $row['idempotency_key'],
				)
			);
			return;
		}
		$key                  = $this->key_index( $scope, $row['operation_type'], $row['idempotency_key'] );
		$this->by_key[ $key ] = $row;
		$this->command_index[ $this->command_index_key( $scope, $row['transaction_id'], $row['operation_type'] ) ] = $key;
		if ( isset( $row['payment_id'] ) && is_string( $row['payment_id'] ) && $row['payment_id'] !== '' ) {
			$this->payment_index[ $this->payment_index_key( $scope, $row['payment_id'] ) ] = $key;
		}
		if ( isset( $row['evidence_id'] ) && is_string( $row['evidence_id'] ) && $row['evidence_id'] !== '' ) {
			$this->evidence_index[ $this->evidence_index_key( $scope, $row['evidence_id'] ) ] = $key;
		}
	}

	/**
	 * Non-blocking transaction mutation lock shared by finalize and cancel.
	 */
	public function acquire_mutation_lock( $transaction_id ) {
		$name = $this->mutation_lock_name( $transaction_id );
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

	public function release_mutation_lock( $transaction_id ) {
		$name = $this->mutation_lock_name( $transaction_id );
		if ( $this->has_wpdb() ) {
			$wpdb = $GLOBALS['wpdb'];
			$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $name ) );
			return;
		}
		unset( $this->locks[ $name ] );
	}

	public function mutation_lock_held( $transaction_id ) {
		$name = $this->mutation_lock_name( $transaction_id );
		return ! empty( $this->locks[ $name ] );
	}

	private function insert_wpdb( $scope, array $row ) {
		$wpdb  = $GLOBALS['wpdb'];
		$table = Cetech_Pos_Bridge_Schema_Install::command_table_name( $wpdb );
		$now   = gmdate( 'Y-m-d H:i:s' );
		$ok    = $wpdb->insert(
			$table,
			array(
				'site_scope'      => $scope,
				'operation_type'  => $row['operation_type'],
				'idempotency_key' => $row['idempotency_key'],
				'transaction_id'  => $row['transaction_id'],
				'request_hash'    => $row['request_hash'],
				'payment_id'      => isset( $row['payment_id'] ) && $row['payment_id'] !== '' ? $row['payment_id'] : null,
				'evidence_id'     => isset( $row['evidence_id'] ) && $row['evidence_id'] !== '' ? $row['evidence_id'] : null,
				'internal_status' => self::STATUS_PENDING,
				'created_at'      => $now,
				'updated_at'      => $now,
			)
		);
		if ( $ok ) {
			return self::INSERT_CREATED;
		}
		if ( $this->get_by_idempotency( $row['operation_type'], $row['idempotency_key'] ) ) {
			return self::INSERT_DUPLICATE_KEY;
		}
		if ( $this->get_by_transaction_operation( $row['transaction_id'], $row['operation_type'] ) ) {
			return self::INSERT_DUPLICATE_COMMAND;
		}
		if ( isset( $row['payment_id'] ) && $row['payment_id'] !== '' && $this->get_by_payment_id( $row['payment_id'] ) ) {
			return self::INSERT_DUPLICATE_PAYMENT;
		}
		if ( isset( $row['evidence_id'] ) && $row['evidence_id'] !== '' && $this->get_by_evidence_id( $row['evidence_id'] ) ) {
			return self::INSERT_DUPLICATE_EVIDENCE;
		}
		return self::INSERT_DUPLICATE_KEY;
	}

	private function row_wpdb( $where, array $args ) {
		$wpdb  = $GLOBALS['wpdb'];
		$table = Cetech_Pos_Bridge_Schema_Install::command_table_name( $wpdb );
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

	private function command_index_key( $scope, $transaction_id, $operation ) {
		return $scope . '|cmd|' . $transaction_id . '|' . $operation;
	}

	private function payment_index_key( $scope, $payment_id ) {
		return $scope . '|pay|' . $payment_id;
	}

	private function evidence_index_key( $scope, $evidence_id ) {
		return $scope . '|ev|' . $evidence_id;
	}

	private function mutation_lock_name( $transaction_id ) {
		return 'cetech_pos_tx_' . md5( $this->site_scope() . '|' . $transaction_id );
	}
}
