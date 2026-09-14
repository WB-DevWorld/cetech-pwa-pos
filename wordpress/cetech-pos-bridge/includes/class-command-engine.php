<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Verified commercial finalize and safe cancel. Payment adapters never call Woo.
 * Browser success is never payment proof. GET resolve remains observational.
 */
final class Cetech_Pos_Bridge_Command_Engine {
	/** @var Cetech_Pos_Bridge_Woo_Runtime */
	private $runtime;
	/** @var Cetech_Pos_Bridge_Claim_Store */
	private $prepare_claims;
	/** @var Cetech_Pos_Bridge_Command_Store */
	private $commands;

	/** @var callable|null F1: after durable finalize claim + mutation lock, before Woo writes */
	public $after_finalize_claim = null;
	/** @var callable|null C1: after durable cancel claim + mutation lock, before Woo writes */
	public $after_cancel_claim = null;

	public function __construct(
		Cetech_Pos_Bridge_Woo_Runtime $runtime,
		Cetech_Pos_Bridge_Claim_Store $prepare_claims,
		Cetech_Pos_Bridge_Command_Store $commands
	) {
		$this->runtime        = $runtime;
		$this->prepare_claims = $prepare_claims;
		$this->commands       = $commands;
	}

	/**
	 * @param array<string,mixed> $raw
	 * @param string              $idempotency_key
	 * @return array<string,mixed>|WP_Error
	 */
	public function finalize( array $raw, $idempotency_key ) {
		$violation = Cetech_Pos_Bridge_Schema::instance()->validate( $raw, 'BridgeFinalizeRequest' );
		if ( $violation !== null ) {
			return $this->invalid_request( 'BridgeFinalizeRequest', Cetech_Pos_Bridge_Schema::field_of( $violation ) );
		}
		$payment = $raw['payment'];
		if ( (string) $payment['transactionId'] !== (string) $raw['transactionId'] ) {
			return $this->not_verified( 'Verified payment transactionId does not match the finalize request.' );
		}
		$hash    = Cetech_Pos_Bridge_Request_Hash::hash( $raw );
		$binding = $this->bind_prepared_sale( $raw['transactionId'], $payment );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $binding ) ) {
			return $binding;
		}
		$op     = Cetech_Pos_Bridge_Constants::OPERATION_FINALIZE;
		$result = $this->commands->insert_command(
			array(
				'operation_type'  => $op,
				'idempotency_key' => $idempotency_key,
				'transaction_id'  => $raw['transactionId'],
				'request_hash'    => $hash,
				'payment_id'      => $payment['paymentId'],
				'evidence_id'     => $payment['evidenceId'],
			)
		);
		if ( $result === Cetech_Pos_Bridge_Command_Store::INSERT_DUPLICATE_KEY ) {
			return $this->replay_or_conflict( $op, $idempotency_key, $hash, $raw, 'finalize' );
		}
		if ( $result === Cetech_Pos_Bridge_Command_Store::INSERT_DUPLICATE_COMMAND ) {
			return $this->existing_command_outcome( $raw['transactionId'], $op, $hash, $payment );
		}
		if ( $result === Cetech_Pos_Bridge_Command_Store::INSERT_DUPLICATE_PAYMENT ) {
			return $this->reused_identity( 'paymentId', $payment['paymentId'], $raw['transactionId'] );
		}
		if ( $result === Cetech_Pos_Bridge_Command_Store::INSERT_DUPLICATE_EVIDENCE ) {
			return $this->reused_identity( 'evidenceId', $payment['evidenceId'], $raw['transactionId'] );
		}
		return $this->run_finalize_locked( $raw, $idempotency_key, $binding );
	}

	/**
	 * @param array<string,mixed> $raw
	 * @param string              $idempotency_key
	 * @return array<string,mixed>|WP_Error
	 */
	public function cancel( array $raw, $idempotency_key ) {
		$violation = Cetech_Pos_Bridge_Schema::instance()->validate( $raw, 'CancelSaleRequest' );
		if ( $violation !== null ) {
			return $this->invalid_request( 'CancelSaleRequest', Cetech_Pos_Bridge_Schema::field_of( $violation ) );
		}
		$prepare = $this->prepare_claims->get_by_transaction( $raw['transactionId'] );
		if ( $prepare === null ) {
			return $this->not_found( $raw['transactionId'] );
		}
		$hash   = Cetech_Pos_Bridge_Request_Hash::hash( $raw );
		$op     = Cetech_Pos_Bridge_Constants::OPERATION_CANCEL;
		$result = $this->commands->insert_command(
			array(
				'operation_type'  => $op,
				'idempotency_key' => $idempotency_key,
				'transaction_id'  => $raw['transactionId'],
				'request_hash'    => $hash,
			)
		);
		if ( $result === Cetech_Pos_Bridge_Command_Store::INSERT_DUPLICATE_KEY ) {
			return $this->replay_or_conflict( $op, $idempotency_key, $hash, $raw, 'cancel' );
		}
		if ( $result === Cetech_Pos_Bridge_Command_Store::INSERT_DUPLICATE_COMMAND ) {
			return $this->existing_command_outcome( $raw['transactionId'], $op, $hash, null );
		}
		return $this->run_cancel_locked( $raw, $idempotency_key, $prepare );
	}

	/**
	 * @param array<string,mixed> $raw
	 * @param string              $idempotency_key
	 * @param array<string,mixed> $binding
	 * @return array<string,mixed>|WP_Error
	 */
	private function run_finalize_locked( array $raw, $idempotency_key, array $binding ) {
		$tx = $raw['transactionId'];
		if ( ! $this->commands->acquire_mutation_lock( $tx ) ) {
			return $this->in_progress();
		}
		try {
			if ( is_callable( $this->after_finalize_claim ) ) {
				$cb = $this->after_finalize_claim;
				$this->after_finalize_claim = null;
				$cb( $this );
			}
			$claim = $this->commands->get_by_idempotency( Cetech_Pos_Bridge_Constants::OPERATION_FINALIZE, $idempotency_key );
			if ( ! is_array( $claim ) ) {
				return $this->unavailable( 'Finalize claim vanished after insert.' );
			}
			$recovered = $this->decoded_outcome( $claim );
			if ( is_array( $recovered ) ) {
				return $recovered;
			}
			return $this->execute_finalize( $claim, $raw, $binding );
		} finally {
			$this->commands->release_mutation_lock( $tx );
		}
	}

	/**
	 * @param array<string,mixed> $raw
	 * @param string              $idempotency_key
	 * @param array<string,mixed> $prepare
	 * @return array<string,mixed>|WP_Error
	 */
	private function run_cancel_locked( array $raw, $idempotency_key, array $prepare ) {
		$tx = $raw['transactionId'];
		if ( ! $this->commands->acquire_mutation_lock( $tx ) ) {
			return $this->in_progress();
		}
		try {
			if ( is_callable( $this->after_cancel_claim ) ) {
				$cb = $this->after_cancel_claim;
				$this->after_cancel_claim = null;
				$cb( $this );
			}
			$claim = $this->commands->get_by_idempotency( Cetech_Pos_Bridge_Constants::OPERATION_CANCEL, $idempotency_key );
			if ( ! is_array( $claim ) ) {
				return $this->unavailable( 'Cancel claim vanished after insert.' );
			}
			$recovered = $this->decoded_outcome( $claim );
			if ( is_array( $recovered ) ) {
				return $recovered;
			}
			return $this->execute_cancel( $claim, $raw, $prepare );
		} finally {
			$this->commands->release_mutation_lock( $tx );
		}
	}

	/**
	 * @param array<string,mixed> $claim
	 * @param array<string,mixed> $raw
	 * @param array<string,mixed> $binding
	 * @return array<string,mixed>|WP_Error
	 */
	private function execute_finalize( array $claim, array $raw, array $binding ) {
		$claim['internal_status'] = Cetech_Pos_Bridge_Command_Store::STATUS_IN_PROGRESS;
		$this->commands->save( $claim );
		$payment  = $raw['payment'];
		$prepared = $binding['prepared'];
		$order_id = $binding['orderId'];
		$snap     = $this->runtime->inspect_commercial_snapshot( $order_id );
		if ( ! is_array( $snap ) || empty( $snap['found'] ) ) {
			return $this->freeze_attention( $claim, $raw['transactionId'], $prepared, 'Prepared Woo order could not be loaded for finalize.' );
		}
		$identity = $this->assert_woo_identity( $snap, $raw['transactionId'], $prepared );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $identity ) ) {
			return $this->freeze_attention( $claim, $raw['transactionId'], $prepared, $identity->get_error_message() );
		}
		if ( ! empty( $snap['cancelled'] ) ) {
			return $this->freeze_attention( $claim, $raw['transactionId'], $prepared, 'Verified payment arrived after the Woo order was cancelled.', isset( $snap['paymentId'] ) ? $snap['paymentId'] : $payment['paymentId'] );
		}
		if ( ! empty( $snap['paid'] ) ) {
			$existing = isset( $snap['paymentId'] ) ? (string) $snap['paymentId'] : '';
			if ( $existing === '' ) {
				return $this->freeze_attention( $claim, $raw['transactionId'], $prepared, 'Woo order is paid but payment identity cannot be proven.' );
			}
			if ( $existing !== (string) $payment['paymentId'] ) {
				return $this->freeze_attention( $claim, $raw['transactionId'], $prepared, 'Woo order is already paid with a different paymentId.' );
			}
			return $this->persist_completed( $claim, $raw['transactionId'], $prepared, $payment['paymentId'] );
		}
		$economics = $this->assert_woo_economics( $snap, $prepared );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $economics ) ) {
			return $this->freeze_attention( $claim, $raw['transactionId'], $prepared, 'Woo commercial economics diverged from the prepared sale.' );
		}
		if ( empty( $snap['reservationProven'] ) ) {
			return $this->freeze_attention( $claim, $raw['transactionId'], $prepared, 'Verified payment cannot be completed because stock reservation is no longer proven.' );
		}
		$bound = $this->runtime->bind_verified_payment( $order_id, $payment );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $bound ) ) {
			return $this->persist_error( $claim, $bound );
		}
		try {
			$completed = $this->runtime->complete_verified_payment( $order_id, $payment['paymentId'] );
		} catch ( \Throwable $e ) {
			unset( $e );
			$after = $this->runtime->inspect_commercial_snapshot( $order_id );
			if ( is_array( $after ) && ! empty( $after['paid'] ) && isset( $after['paymentId'] ) && (string) $after['paymentId'] === (string) $payment['paymentId'] ) {
				return $this->persist_completed( $claim, $raw['transactionId'], $prepared, $payment['paymentId'] );
			}
			return $this->freeze_attention( $claim, $raw['transactionId'], $prepared, 'Woo payment completion outcome could not be proven after an exception.' );
		}
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $completed ) ) {
			if ( $completed->get_error_code() === 'REQUIRES_ATTENTION' ) {
				return $this->freeze_attention( $claim, $raw['transactionId'], $prepared, $completed->get_error_message() );
			}
			return $this->persist_error( $claim, $completed );
		}
		$after = $this->runtime->inspect_commercial_snapshot( $order_id );
		if ( ! is_array( $after ) || empty( $after['paid'] ) || (string) $after['paymentId'] !== (string) $payment['paymentId'] ) {
			return $this->freeze_attention( $claim, $raw['transactionId'], $prepared, 'Woo paid state could not be proven after payment_complete.' );
		}
		$this->runtime->notify_after_payment_complete();
		return $this->persist_completed( $claim, $raw['transactionId'], $prepared, $payment['paymentId'] );
	}

	/**
	 * @param array<string,mixed> $claim
	 * @param array<string,mixed> $raw
	 * @param array<string,mixed> $prepare
	 * @return array<string,mixed>|WP_Error
	 */
	private function execute_cancel( array $claim, array $raw, array $prepare ) {
		$claim['internal_status'] = Cetech_Pos_Bridge_Command_Store::STATUS_IN_PROGRESS;
		$this->commands->save( $claim );
		$prepared = $this->decode_prepared( $prepare );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $prepared ) ) {
			return $this->persist_error( $claim, $prepared );
		}
		$finalize = $this->commands->get_by_transaction_operation( $raw['transactionId'], Cetech_Pos_Bridge_Constants::OPERATION_FINALIZE );
		if ( is_array( $finalize ) ) {
			if ( $finalize['internal_status'] === Cetech_Pos_Bridge_Command_Store::STATUS_COMPLETED ) {
				$outcome = $this->decoded_outcome( $finalize );
				if ( is_array( $outcome ) && isset( $outcome['status'] ) && $outcome['status'] === 'completed' ) {
					return $this->persist_error( $claim, $this->payment_pending( 'Verified commercial completion already exists for this transaction.' ) );
				}
			}
			if ( $finalize['internal_status'] === Cetech_Pos_Bridge_Command_Store::STATUS_REQUIRES_ATTENTION ) {
				return $this->persist_error( $claim, $this->payment_pending( 'Finalize evidence for this transaction is unresolved.' ) );
			}
		}
		$order_id = isset( $prepare['woo_order_id'] ) ? (string) $prepare['woo_order_id'] : '';
		if ( $order_id === '' && isset( $prepared['orderReference'] ) ) {
			$order_id = (string) $prepared['orderReference'];
		}
		$snap = $order_id !== '' ? $this->runtime->inspect_commercial_snapshot( $order_id ) : null;
		if ( is_array( $snap ) && ! empty( $snap['paid'] ) ) {
			return $this->persist_error( $claim, $this->payment_pending( 'Woo order is already paid; cancellation cannot release stock.' ) );
		}
		if ( is_array( $snap ) && ! empty( $snap['paymentId'] ) ) {
			return $this->persist_error( $claim, $this->payment_pending( 'Verified payment evidence is already bound on the Woo order.' ) );
		}
		if ( is_array( $snap ) && ! empty( $snap['cancelled'] ) ) {
			return $this->persist_cancelled( $claim, $raw['transactionId'], $prepared );
		}
		if ( is_array( $snap ) && ! empty( $snap['stockReduced'] ) ) {
			return $this->freeze_attention( $claim, $raw['transactionId'], $prepared, 'Prepared order stock is already reduced; cancel will not invent a restock.' );
		}
		if ( is_array( $snap ) && ! empty( $snap['reservationProven'] ) ) {
			$released = $this->runtime->release_reserved_stock( $order_id );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $released ) ) {
				if ( $released->get_error_code() === 'REQUIRES_ATTENTION' ) {
					return $this->freeze_attention( $claim, $raw['transactionId'], $prepared, $released->get_error_message() );
				}
				return $this->persist_error( $claim, $released );
			}
		}
		$cancelled = $this->runtime->cancel_unpaid_order( $order_id, $raw['reason'] );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $cancelled ) ) {
			return $this->persist_error( $claim, $cancelled );
		}
		$after = $this->runtime->inspect_commercial_snapshot( $order_id );
		if ( ! is_array( $after ) || empty( $after['cancelled'] ) ) {
			return $this->freeze_attention( $claim, $raw['transactionId'], $prepared, 'Woo cancelled state could not be proven after cancel.' );
		}
		return $this->persist_cancelled( $claim, $raw['transactionId'], $prepared );
	}

	/**
	 * @param string              $transaction_id
	 * @param array<string,mixed> $payment
	 * @return array<string,mixed>|WP_Error
	 */
	private function bind_prepared_sale( $transaction_id, array $payment ) {
		$prepare = $this->prepare_claims->get_by_transaction( $transaction_id );
		if ( $prepare === null ) {
			return $this->not_found( $transaction_id );
		}
		$prepared = $this->decode_prepared( $prepare );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $prepared ) ) {
			return $prepared;
		}
		if ( (string) $payment['saleId'] !== (string) $prepared['saleId'] ) {
			return $this->not_verified( 'Verified payment saleId does not match the prepared sale.' );
		}
		if ( (int) $payment['amount']['minor'] !== (int) $prepared['total']['minor'] ) {
			return $this->not_verified( 'Verified payment amount does not match the prepared sale total.' );
		}
		if ( (string) $payment['amount']['currency'] !== (string) $prepared['total']['currency'] ) {
			return $this->not_verified( 'Verified payment currency does not match the prepared sale total.' );
		}
		$order_id = isset( $prepare['woo_order_id'] ) && $prepare['woo_order_id'] !== '' && $prepare['woo_order_id'] !== null
			? (string) $prepare['woo_order_id']
			: (string) $prepared['orderReference'];
		return array(
			'prepare'  => $prepare,
			'prepared' => $prepared,
			'orderId'  => $order_id,
		);
	}

	/**
	 * @param array<string,mixed> $snap
	 * @param string              $transaction_id
	 * @param array<string,mixed> $prepared
	 * @return true|WP_Error
	 */
	private function assert_woo_identity( array $snap, $transaction_id, array $prepared ) {
		if ( empty( $snap['cetechOwned'] ) ) {
			return $this->attention_error( 'Woo order is not CETECH-owned for this prepared sale.' );
		}
		if ( (string) $snap['transactionId'] !== (string) $transaction_id ) {
			return $this->attention_error( 'Woo order transaction identity does not match the prepared sale.' );
		}
		if ( (string) $snap['saleId'] !== (string) $prepared['saleId'] ) {
			return $this->attention_error( 'Woo order sale identity does not match the prepared sale.' );
		}
		if ( (string) $snap['orderId'] !== (string) $prepared['orderReference'] && (string) $snap['orderReference'] !== (string) $prepared['orderReference'] ) {
			return $this->attention_error( 'Woo order reference does not match the prepared sale.' );
		}
		return true;
	}

	/**
	 * @param array<string,mixed> $snap
	 * @param array<string,mixed> $prepared
	 * @return true|WP_Error
	 */
	private function assert_woo_economics( array $snap, array $prepared ) {
		if ( ! isset( $snap['totalMinor'] ) || ! isset( $snap['currency'] ) ) {
			return $this->attention_error( 'Woo order economics could not be read.' );
		}
		if ( (string) $snap['currency'] !== (string) $prepared['total']['currency'] ) {
			return $this->attention_error( 'Woo order currency diverged from the prepared sale.' );
		}
		if ( (int) $snap['totalMinor'] !== (int) $prepared['total']['minor'] ) {
			return $this->attention_error( 'Woo order grand total diverged from the prepared sale.' );
		}
		return true;
	}

	private function replay_or_conflict( $op, $idempotency_key, $hash, array $raw, $kind ) {
		$existing = $this->commands->get_by_idempotency( $op, $idempotency_key );
		if ( ! is_array( $existing ) ) {
			return $this->unavailable( 'Idempotency claim could not be loaded after a uniqueness collision.' );
		}
		if ( (string) $existing['request_hash'] !== (string) $hash ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'IDEMPOTENCY_CONFLICT',
				'Idempotency-Key was reused with a different semantic request.',
				false,
				'contact_manager',
				409
			);
		}
		$outcome = $this->decoded_outcome( $existing );
		if ( is_array( $outcome ) ) {
			return $outcome;
		}
		if ( $existing['internal_status'] === Cetech_Pos_Bridge_Command_Store::STATUS_TERMINAL_FAILURE ) {
			return $this->replay_terminal( $existing );
		}
		if ( $kind === 'finalize' ) {
			$binding = $this->bind_prepared_sale( $raw['transactionId'], $raw['payment'] );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $binding ) ) {
				return $binding;
			}
			return $this->run_finalize_locked( $raw, $idempotency_key, $binding );
		}
		$prepare = $this->prepare_claims->get_by_transaction( $raw['transactionId'] );
		if ( $prepare === null ) {
			return $this->not_found( $raw['transactionId'] );
		}
		return $this->run_cancel_locked( $raw, $idempotency_key, $prepare );
	}

	/**
	 * @param string                   $transaction_id
	 * @param string                   $op
	 * @param string                   $hash
	 * @param array<string,mixed>|null $payment
	 * @return array<string,mixed>|WP_Error
	 */
	private function existing_command_outcome( $transaction_id, $op, $hash, $payment ) {
		$existing = $this->commands->get_by_transaction_operation( $transaction_id, $op );
		if ( ! is_array( $existing ) ) {
			return $this->unavailable( 'Existing command claim could not be loaded.' );
		}
		if ( $op === Cetech_Pos_Bridge_Constants::OPERATION_FINALIZE && is_array( $payment ) ) {
			$bound_payment = isset( $existing['payment_id'] ) ? (string) $existing['payment_id'] : '';
			if ( $bound_payment !== '' && $bound_payment !== (string) $payment['paymentId'] ) {
				$prepare  = $this->prepare_claims->get_by_transaction( $transaction_id );
				$prepared = is_array( $prepare ) ? $this->decode_prepared( $prepare ) : null;
				if ( is_array( $prepared ) ) {
					return $this->resolution( $transaction_id, 'requires_attention', $prepared['saleId'], $prepared['orderReference'], 'A different paymentId cannot finalize the same sale.' );
				}
				return $this->attention_error( 'A different paymentId cannot finalize the same sale.' );
			}
			$outcome = $this->decoded_outcome( $existing );
			if ( is_array( $outcome ) && isset( $outcome['status'] ) && $outcome['status'] === 'completed' && $bound_payment === (string) $payment['paymentId'] ) {
				return $outcome;
			}
		}
		if ( (string) $existing['request_hash'] === (string) $hash ) {
			$outcome = $this->decoded_outcome( $existing );
			if ( is_array( $outcome ) ) {
				return $outcome;
			}
			if ( $existing['internal_status'] === Cetech_Pos_Bridge_Command_Store::STATUS_TERMINAL_FAILURE ) {
				return $this->replay_terminal( $existing );
			}
		}
		if ( in_array( $existing['internal_status'], array( Cetech_Pos_Bridge_Command_Store::STATUS_PENDING, Cetech_Pos_Bridge_Command_Store::STATUS_IN_PROGRESS ), true ) ) {
			return $this->in_progress();
		}
		$outcome = $this->decoded_outcome( $existing );
		if ( is_array( $outcome ) ) {
			return $outcome;
		}
		if ( $existing['internal_status'] === Cetech_Pos_Bridge_Command_Store::STATUS_TERMINAL_FAILURE ) {
			return $this->replay_terminal( $existing );
		}
		return $this->in_progress();
	}

	private function reused_identity( $field, $value, $transaction_id ) {
		$existing = $field === 'paymentId'
			? $this->commands->get_by_payment_id( $value )
			: $this->commands->get_by_evidence_id( $value );
		if ( is_array( $existing ) && (string) $existing['transaction_id'] === (string) $transaction_id ) {
			$outcome = $this->decoded_outcome( $existing );
			if ( is_array( $outcome ) ) {
				return $outcome;
			}
		}
		return $this->not_verified( 'Verified ' . $field . ' is already bound to another commercial sale.' );
	}

	/**
	 * @param array<string,mixed> $claim
	 * @return array<string,mixed>|null
	 */
	private function decoded_outcome( array $claim ) {
		if ( $claim['internal_status'] !== Cetech_Pos_Bridge_Command_Store::STATUS_COMPLETED
			&& $claim['internal_status'] !== Cetech_Pos_Bridge_Command_Store::STATUS_REQUIRES_ATTENTION ) {
			return null;
		}
		if ( ! isset( $claim['outcome_json'] ) || ! is_string( $claim['outcome_json'] ) || $claim['outcome_json'] === '' ) {
			return null;
		}
		$decoded = json_decode( $claim['outcome_json'], true );
		if ( ! is_array( $decoded ) ) {
			return null;
		}
		$violation = Cetech_Pos_Bridge_Schema::instance()->validate( $decoded, 'SaleResolution' );
		if ( $violation !== null ) {
			return null;
		}
		return $decoded;
	}

	/**
	 * @param array<string,mixed> $prepare
	 * @return array<string,mixed>|WP_Error
	 */
	private function decode_prepared( array $prepare ) {
		$decoded = json_decode( (string) $prepare['outcome_json'], true );
		if ( ! is_array( $decoded ) ) {
			return $this->unavailable( 'Stored PreparedSale is not valid JSON.' );
		}
		$violation = Cetech_Pos_Bridge_Schema::instance()->validate( $decoded, 'PreparedSale' );
		if ( $violation !== null ) {
			return $this->unavailable( 'Stored PreparedSale did not satisfy the v1 contract schema.' );
		}
		return $decoded;
	}

	/**
	 * @param array<string,mixed> $claim
	 * @param string              $transaction_id
	 * @param array<string,mixed> $prepared
	 * @param string              $payment_id
	 * @return array<string,mixed>
	 */
	private function persist_completed( array $claim, $transaction_id, array $prepared, $payment_id ) {
		$payload = $this->resolution(
			$transaction_id,
			'completed',
			$prepared['saleId'],
			$prepared['orderReference'],
			null,
			$payment_id
		);
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $payload ) ) {
			return $this->persist_error( $claim, $payload );
		}
		$claim['internal_status'] = Cetech_Pos_Bridge_Command_Store::STATUS_COMPLETED;
		$json                     = function_exists( 'wp_json_encode' ) ? wp_json_encode( $payload ) : json_encode( $payload );
		$claim['outcome_json']    = is_string( $json ) ? $json : null;
		$claim['error_code']      = null;
		$claim['error_message']   = null;
		$this->commands->save( $claim );
		return $payload;
	}

	/**
	 * @param array<string,mixed> $claim
	 * @param string              $transaction_id
	 * @param array<string,mixed> $prepared
	 * @return array<string,mixed>
	 */
	private function persist_cancelled( array $claim, $transaction_id, array $prepared ) {
		$payload = $this->resolution(
			$transaction_id,
			'cancelled',
			isset( $prepared['saleId'] ) ? $prepared['saleId'] : null,
			isset( $prepared['orderReference'] ) ? $prepared['orderReference'] : null
		);
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $payload ) ) {
			return $this->persist_error( $claim, $payload );
		}
		$claim['internal_status'] = Cetech_Pos_Bridge_Command_Store::STATUS_COMPLETED;
		$json                     = function_exists( 'wp_json_encode' ) ? wp_json_encode( $payload ) : json_encode( $payload );
		$claim['outcome_json']    = is_string( $json ) ? $json : null;
		$claim['error_code']      = null;
		$claim['error_message']   = null;
		$this->commands->save( $claim );
		return $payload;
	}

	/**
	 * @param array<string,mixed> $claim
	 * @param string              $transaction_id
	 * @param array<string,mixed> $prepared
	 * @param string              $message
	 * @param string|null         $payment_id
	 * @return array<string,mixed>
	 */
	private function freeze_attention( array $claim, $transaction_id, array $prepared, $message, $payment_id = null ) {
		$payload = $this->resolution(
			$transaction_id,
			'requires_attention',
			isset( $prepared['saleId'] ) ? $prepared['saleId'] : null,
			isset( $prepared['orderReference'] ) ? $prepared['orderReference'] : null,
			$message,
			$payment_id
		);
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $payload ) ) {
			return $this->persist_error( $claim, $payload );
		}
		$claim['internal_status'] = Cetech_Pos_Bridge_Command_Store::STATUS_REQUIRES_ATTENTION;
		$json                     = function_exists( 'wp_json_encode' ) ? wp_json_encode( $payload ) : json_encode( $payload );
		$claim['outcome_json']    = is_string( $json ) ? $json : null;
		$claim['error_code']      = 'REQUIRES_ATTENTION';
		$claim['error_message']   = $message;
		$this->commands->save( $claim );
		return $payload;
	}

	private function persist_error( array $claim, $error ) {
		$data = method_exists( $error, 'get_error_data' ) ? (array) $error->get_error_data() : array();
		$claim['internal_status']    = Cetech_Pos_Bridge_Command_Store::STATUS_TERMINAL_FAILURE;
		$claim['error_code']         = $error->get_error_code();
		$claim['error_message']      = $error->get_error_message();
		$details                     = isset( $data['details'] ) && is_array( $data['details'] ) ? $data['details'] : array();
		$json                        = function_exists( 'wp_json_encode' ) ? wp_json_encode( $details ) : json_encode( $details );
		$claim['error_details_json'] = is_string( $json ) ? $json : null;
		$this->commands->save( $claim );
		return $error;
	}

	private function replay_terminal( array $claim ) {
		$code    = (string) $claim['error_code'];
		$message = (string) $claim['error_message'];
		$policy  = isset( Cetech_Pos_Bridge_Response::POLICY[ $code ] ) ? Cetech_Pos_Bridge_Response::POLICY[ $code ] : Cetech_Pos_Bridge_Response::POLICY['VALIDATION_ERROR'];
		$details = json_decode( (string) $claim['error_details_json'], true );
		return Cetech_Pos_Bridge_Response::wp_error(
			$code,
			$message,
			$policy[1],
			$policy[2],
			$policy[0],
			is_array( $details ) ? $details : null
		);
	}

	private function resolution( $transaction_id, $status, $sale_id = null, $order_reference = null, $message = null, $payment_id = null ) {
		$payload = array(
			'transactionId' => $transaction_id,
			'status'        => $status,
		);
		if ( is_string( $sale_id ) && $sale_id !== '' ) {
			$payload['saleId'] = $sale_id;
		}
		if ( is_string( $order_reference ) && $order_reference !== '' ) {
			$payload['orderReference'] = $order_reference;
		}
		if ( is_string( $payment_id ) && $payment_id !== '' ) {
			$payload['paymentId'] = $payment_id;
		}
		if ( is_string( $message ) && $message !== '' ) {
			$payload['message'] = $message;
		}
		$violation = Cetech_Pos_Bridge_Schema::instance()->validate( $payload, 'SaleResolution' );
		if ( $violation !== null ) {
			return $this->unavailable( 'SaleResolution did not satisfy the v1 contract schema and was not returned.' );
		}
		return $payload;
	}

	private function invalid_request( $schema, $field ) {
		return Cetech_Pos_Bridge_Response::wp_error(
			'VALIDATION_ERROR',
			$schema . ' does not satisfy the v1 contract schema.',
			false,
			'none',
			400,
			array( 'field' => $field )
		);
	}

	private function not_found( $transaction_id ) {
		unset( $transaction_id );
		return Cetech_Pos_Bridge_Response::wp_error(
			'NOT_FOUND',
			'No prepared sale exists for this transactionId.',
			false,
			'none',
			404
		);
	}

	private function not_verified( $message ) {
		return Cetech_Pos_Bridge_Response::wp_error(
			'PAYMENT_NOT_VERIFIED',
			$message,
			false,
			'resolve',
			409
		);
	}

	private function payment_pending( $message ) {
		return Cetech_Pos_Bridge_Response::wp_error(
			'PAYMENT_PENDING',
			$message,
			false,
			'resolve',
			409
		);
	}

	private function in_progress() {
		return Cetech_Pos_Bridge_Response::wp_error(
			'OPERATION_IN_PROGRESS',
			'A commercial mutation is still in progress for this transaction.',
			true,
			'resolve',
			202
		);
	}

	private function attention_error( $message ) {
		return Cetech_Pos_Bridge_Response::wp_error(
			'REQUIRES_ATTENTION',
			$message,
			false,
			'contact_manager',
			409
		);
	}

	private function unavailable( $message ) {
		return Cetech_Pos_Bridge_Response::wp_error(
			'INTEGRATION_UNAVAILABLE',
			$message,
			true,
			'resolve',
			503
		);
	}
}
