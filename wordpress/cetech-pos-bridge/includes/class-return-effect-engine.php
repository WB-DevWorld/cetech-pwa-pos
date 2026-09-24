<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Independent commerce-order commercial refund and physical stock-disposition
 * producers. Not PaymentPort.refund. Not ReturnPort orchestration.
 */
final class Cetech_Pos_Bridge_Return_Effect_Engine {
	/** @var Cetech_Pos_Bridge_Woo_Runtime */
	private $runtime;
	/** @var Cetech_Pos_Bridge_Quote_Store */
	private $quotes;
	/** @var Cetech_Pos_Bridge_Claim_Store */
	private $prepare_claims;
	/** @var Cetech_Pos_Bridge_Command_Store */
	private $commands;
	/** @var Cetech_Pos_Bridge_Return_Effect_Store */
	private $effects;

	public function __construct(
		Cetech_Pos_Bridge_Woo_Runtime $runtime,
		Cetech_Pos_Bridge_Quote_Store $quotes,
		Cetech_Pos_Bridge_Claim_Store $prepare_claims,
		Cetech_Pos_Bridge_Command_Store $commands,
		Cetech_Pos_Bridge_Return_Effect_Store $effects
	) {
		$this->runtime        = $runtime;
		$this->quotes         = $quotes;
		$this->prepare_claims = $prepare_claims;
		$this->commands       = $commands;
		$this->effects        = $effects;
	}

	public function get_store() {
		return $this->effects;
	}

	/**
	 * @param array<string,mixed> $raw
	 * @param string              $idempotency_key
	 * @return array<string,mixed>|WP_Error
	 */
	public function apply_commercial_refund( array $raw, $idempotency_key ) {
		$violation = Cetech_Pos_Bridge_Schema::instance()->validate( $raw, 'BridgeCommercialRefundRequest' );
		if ( $violation !== null ) {
			return $this->invalid_request( 'BridgeCommercialRefundRequest', Cetech_Pos_Bridge_Schema::field_of( $violation ) );
		}
		$hash = Cetech_Pos_Bridge_Request_Hash::hash( $raw );
		$op   = Cetech_Pos_Bridge_Constants::OPERATION_COMMERCIAL_REFUND;
		$pre  = $this->replay_conflict_before_lock( $op, $idempotency_key, $raw['commercialRefundId'], $hash );
		if ( $pre !== null ) {
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $pre ) ) {
				return $pre;
			}
		}
		return $this->run_commercial_locked( $raw, $idempotency_key, $hash );
	}

	/**
	 * Observational GET. Never mutates Woo, claims, or stock.
	 *
	 * @param string $commercial_refund_id
	 * @return array<string,mixed>|WP_Error
	 */
	public function resolve_commercial_refund( $commercial_refund_id ) {
		if ( ! is_string( $commercial_refund_id ) || ! Cetech_Pos_Bridge_Quote_Request::is_uuid( $commercial_refund_id ) ) {
			return $this->invalid_request( 'commercialRefundId', 'commercialRefundId' );
		}
		$claim = $this->effects->get_by_effect_id( Cetech_Pos_Bridge_Constants::OPERATION_COMMERCIAL_REFUND, $commercial_refund_id );
		if ( ! is_array( $claim ) ) {
			return $this->not_found_effect();
		}
		$outcome = $this->decoded_outcome( $claim );
		if ( is_array( $outcome ) ) {
			return $this->wire_state( $outcome, $claim, 'completed' );
		}
		if ( $claim['internal_status'] === Cetech_Pos_Bridge_Return_Effect_Store::STATUS_REQUIRES_ATTENTION ) {
			return $this->state_from_claim( $claim, 'requires_attention' );
		}
		$order_id = isset( $claim['order_reference'] ) ? (string) $claim['order_reference'] : '';
		if ( $order_id !== '' && (int) $claim['woo_effect_entered'] === 1 ) {
			$found = $this->runtime->find_commercial_refunds( $order_id, $commercial_refund_id );
			if ( is_array( $found ) && count( $found ) === 1 ) {
				return $this->state_from_claim( $claim, 'completed' );
			}
			if ( is_array( $found ) && count( $found ) > 1 ) {
				return $this->state_from_claim( $claim, 'requires_attention' );
			}
			if ( is_array( $found ) && count( $found ) === 0 ) {
				return $this->state_from_claim( $claim, 'requires_attention' );
			}
		}
		return $this->state_from_claim( $claim, 'pending' );
	}

	/**
	 * @param array<string,mixed> $raw
	 * @param string              $idempotency_key
	 * @return array<string,mixed>|WP_Error
	 */
	public function apply_stock_disposition( array $raw, $idempotency_key ) {
		$violation = Cetech_Pos_Bridge_Schema::instance()->validate( $raw, 'BridgeStockDispositionRequest' );
		if ( $violation !== null ) {
			return $this->invalid_request( 'BridgeStockDispositionRequest', Cetech_Pos_Bridge_Schema::field_of( $violation ) );
		}
		$hash = Cetech_Pos_Bridge_Request_Hash::hash( $raw );
		$op   = Cetech_Pos_Bridge_Constants::OPERATION_STOCK_DISPOSITION;
		$pre  = $this->replay_conflict_before_lock( $op, $idempotency_key, $raw['stockDispositionId'], $hash );
		if ( $pre !== null && Cetech_Pos_Bridge_Quote_Request::is_error( $pre ) ) {
			return $pre;
		}
		return $this->run_stock_locked( $raw, $idempotency_key, $hash );
	}

	/**
	 * Observational GET. Never mutates Woo, claims, line progress, or stock.
	 *
	 * @param string $stock_disposition_id
	 * @return array<string,mixed>|WP_Error
	 */
	public function resolve_stock_disposition( $stock_disposition_id ) {
		if ( ! is_string( $stock_disposition_id ) || ! Cetech_Pos_Bridge_Quote_Request::is_uuid( $stock_disposition_id ) ) {
			return $this->invalid_request( 'stockDispositionId', 'stockDispositionId' );
		}
		$claim = $this->effects->get_by_effect_id( Cetech_Pos_Bridge_Constants::OPERATION_STOCK_DISPOSITION, $stock_disposition_id );
		if ( ! is_array( $claim ) ) {
			return $this->not_found_effect();
		}
		$outcome = $this->decoded_outcome( $claim );
		if ( is_array( $outcome ) ) {
			return $this->wire_stock_state( $outcome, $claim, 'completed' );
		}
		if ( $claim['internal_status'] === Cetech_Pos_Bridge_Return_Effect_Store::STATUS_REQUIRES_ATTENTION ) {
			return $this->stock_state_from_claim( $claim, 'requires_attention' );
		}
		$lines = $this->effects->list_lines( Cetech_Pos_Bridge_Constants::OPERATION_STOCK_DISPOSITION, $stock_disposition_id );
		foreach ( $lines as $line ) {
			if ( in_array( $line['internal_status'], array( Cetech_Pos_Bridge_Return_Effect_Store::LINE_APPLYING, Cetech_Pos_Bridge_Return_Effect_Store::LINE_REQUIRES_ATTENTION ), true ) ) {
				return $this->stock_state_from_claim( $claim, 'requires_attention' );
			}
		}
		if ( $this->all_lines_completed( $lines ) && count( $lines ) > 0 ) {
			return $this->stock_state_from_claim( $claim, 'completed' );
		}
		return $this->stock_state_from_claim( $claim, 'pending' );
	}

	/**
	 * @param array<string,mixed> $raw
	 * @param string              $idempotency_key
	 * @param string              $hash
	 * @return array<string,mixed>|WP_Error
	 */
	private function run_commercial_locked( array $raw, $idempotency_key, $hash ) {
		$tx     = $raw['transactionId'];
		$domain = Cetech_Pos_Bridge_Return_Effect_Store::DOMAIN_COMMERCIAL_REFUND;
		$op     = Cetech_Pos_Bridge_Constants::OPERATION_COMMERCIAL_REFUND;
		if ( ! $this->effects->acquire_domain_lock( $domain, $tx ) ) {
			return $this->in_progress();
		}
		try {
			$conflict = $this->replay_conflict_under_lock( $op, $idempotency_key, $raw['commercialRefundId'], $hash );
			if ( $conflict !== null && Cetech_Pos_Bridge_Quote_Request::is_error( $conflict ) ) {
				return $conflict;
			}
			$claim = $this->effects->get_by_idempotency( $op, $idempotency_key );
			if ( ! is_array( $claim ) ) {
				$claim = $this->effects->get_by_effect_id( $op, $raw['commercialRefundId'] );
			}
			if ( is_array( $claim ) ) {
				$done = $this->decoded_outcome( $claim );
				if ( is_array( $done ) ) {
					return $done;
				}
			}
			$binding = $this->bind_completed_sale( $raw );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $binding ) ) {
				return $binding;
			}
			$historic = $this->historic_commercial_lines( $binding );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $historic ) ) {
				return $historic;
			}
			$checked = $this->validate_commercial_allocations( $raw, $historic, $claim );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $checked ) ) {
				return $checked;
			}
			if ( ! is_array( $claim ) ) {
				$inserted = $this->effects->insert_effect(
					array(
						'operation_type'    => $op,
						'effect_id'         => $raw['commercialRefundId'],
						'idempotency_key'   => $idempotency_key,
						'request_hash'      => $hash,
						'transaction_id'    => $raw['transactionId'],
						'return_request_id' => $raw['returnId'],
						'sale_id'           => $raw['saleId'],
						'order_reference'   => $binding['orderId'],
						'request_json'      => $this->encode_request( $raw ),
					)
				);
				if ( $inserted === Cetech_Pos_Bridge_Return_Effect_Store::INSERT_DUPLICATE_KEY ) {
					return $this->idempotency_conflict();
				}
				if ( $inserted === Cetech_Pos_Bridge_Return_Effect_Store::INSERT_DUPLICATE_EFFECT ) {
					return $this->attention( 'commercialRefundId is already bound to a different semantic request.' );
				}
				$claim = $this->effects->get_by_idempotency( $op, $idempotency_key );
				if ( ! is_array( $claim ) ) {
					return $this->unavailable( 'Commercial refund claim vanished after insert.' );
				}
				$this->runtime->notify_after_commercial_claim();
			}
			return $this->execute_commercial_refund( $claim, $raw, $binding, $hash );
		} finally {
			$this->effects->release_domain_lock( $domain, $tx );
		}
	}

	/**
	 * @param array<string,mixed> $claim
	 * @param array<string,mixed> $raw
	 * @param array<string,mixed> $binding
	 * @param string              $hash
	 * @return array<string,mixed>|WP_Error
	 */
	private function execute_commercial_refund( array $claim, array $raw, array $binding, $hash ) {
		$done = $this->decoded_outcome( $claim );
		if ( is_array( $done ) ) {
			return $done;
		}
		$order_id = $binding['orderId'];
		$amount   = (int) $raw['amount']['minor'];
		if ( (int) $claim['woo_effect_entered'] === 1 ) {
			$found = $this->runtime->find_commercial_refunds( $order_id, $raw['commercialRefundId'] );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $found ) ) {
				return $this->freeze_attention( $claim, $raw, $found->get_error_message() );
			}
			if ( count( $found ) > 1 ) {
				return $this->freeze_attention( $claim, $raw, 'Multiple native Woo refunds carry this commercialRefundId.' );
			}
			if ( count( $found ) === 1 ) {
				return $this->persist_commercial_completed( $claim, $raw, $found[0]['refundId'] );
			}
			return $this->freeze_attention( $claim, $raw, 'Commercial refund may have entered Woo and cannot be proven; a second native refund will not be created.' );
		}
		$claim['internal_status']    = Cetech_Pos_Bridge_Return_Effect_Store::STATUS_IN_PROGRESS;
		$claim['woo_effect_entered'] = 1;
		$this->effects->save( $claim );
		$created = $this->runtime->create_commercial_refund(
			$order_id,
			$amount,
			$raw['amount']['currency'],
			$raw['commercialRefundId'],
			$raw['transactionId'],
			$hash,
			$raw['reason']
		);
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $created ) ) {
			if ( $created->get_error_code() === 'REQUIRES_ATTENTION' ) {
				return $this->freeze_attention( $claim, $raw, $created->get_error_message() );
			}
			return $this->persist_error( $claim, $created );
		}
		$this->runtime->notify_after_refund_native();
		return $this->persist_commercial_completed( $claim, $raw, $created['refundId'] );
	}

	/**
	 * @param array<string,mixed> $raw
	 * @param string              $idempotency_key
	 * @param string              $hash
	 * @return array<string,mixed>|WP_Error
	 */
	private function run_stock_locked( array $raw, $idempotency_key, $hash ) {
		$tx     = $raw['transactionId'];
		$domain = Cetech_Pos_Bridge_Return_Effect_Store::DOMAIN_STOCK_DISPOSITION;
		$op     = Cetech_Pos_Bridge_Constants::OPERATION_STOCK_DISPOSITION;
		if ( ! $this->effects->acquire_domain_lock( $domain, $tx ) ) {
			return $this->in_progress();
		}
		try {
			$conflict = $this->replay_conflict_under_lock( $op, $idempotency_key, $raw['stockDispositionId'], $hash );
			if ( $conflict !== null && Cetech_Pos_Bridge_Quote_Request::is_error( $conflict ) ) {
				return $conflict;
			}
			$claim = $this->effects->get_by_idempotency( $op, $idempotency_key );
			if ( ! is_array( $claim ) ) {
				$claim = $this->effects->get_by_effect_id( $op, $raw['stockDispositionId'] );
			}
			if ( is_array( $claim ) ) {
				$done = $this->decoded_outcome( $claim );
				if ( is_array( $done ) ) {
					return $done;
				}
			}
			$binding = $this->bind_completed_sale( $raw, true );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $binding ) ) {
				return $binding;
			}
			$historic = $this->historic_stock_lines( $binding );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $historic ) ) {
				return $historic;
			}
			$checked = $this->validate_stock_lines( $raw, $historic, $claim );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $checked ) ) {
				return $checked;
			}
			if ( ! is_array( $claim ) ) {
				$inserted = $this->effects->insert_effect(
					array(
						'operation_type'    => $op,
						'effect_id'         => $raw['stockDispositionId'],
						'idempotency_key'   => $idempotency_key,
						'request_hash'      => $hash,
						'transaction_id'    => $raw['transactionId'],
						'return_request_id' => $raw['returnId'],
						'sale_id'           => $raw['saleId'],
						'order_reference'   => $binding['orderId'],
						'request_json'      => $this->encode_request( $raw ),
					)
				);
				if ( $inserted === Cetech_Pos_Bridge_Return_Effect_Store::INSERT_DUPLICATE_KEY ) {
					return $this->idempotency_conflict();
				}
				if ( $inserted === Cetech_Pos_Bridge_Return_Effect_Store::INSERT_DUPLICATE_EFFECT ) {
					return $this->attention( 'stockDispositionId is already bound to a different semantic request.' );
				}
				$claim = $this->effects->get_by_idempotency( $op, $idempotency_key );
				if ( ! is_array( $claim ) ) {
					return $this->unavailable( 'Stock disposition claim vanished after insert.' );
				}
				foreach ( $checked as $line ) {
					$this->effects->upsert_line(
						array(
							'operation_type'  => $op,
							'effect_id'       => $raw['stockDispositionId'],
							'line_id'         => $line['orderLineId'],
							'product_id'      => $line['productId'],
							'variation_id'    => $line['variationId'],
							'quantity'        => $line['quantity'],
							'disposition'     => $line['disposition'],
							'internal_status' => Cetech_Pos_Bridge_Return_Effect_Store::LINE_NOT_STARTED,
						)
					);
				}
				$this->runtime->notify_after_stock_claim();
			}
			return $this->execute_stock_disposition( $claim, $raw, $checked );
		} finally {
			$this->effects->release_domain_lock( $domain, $tx );
		}
	}

	/**
	 * @param array<string,mixed>             $claim
	 * @param array<string,mixed>             $raw
	 * @param array<int,array<string,mixed>>  $lines
	 * @return array<string,mixed>|WP_Error
	 */
	private function execute_stock_disposition( array $claim, array $raw, array $lines ) {
		$done = $this->decoded_outcome( $claim );
		if ( is_array( $done ) ) {
			return $done;
		}
		$op        = Cetech_Pos_Bridge_Constants::OPERATION_STOCK_DISPOSITION;
		$effect_id = $raw['stockDispositionId'];
		usort(
			$lines,
			function ( $a, $b ) {
				return strcmp( (string) $a['orderLineId'], (string) $b['orderLineId'] );
			}
		);
		foreach ( $lines as $line ) {
			$progress = $this->effects->get_line( $op, $effect_id, $line['orderLineId'] );
			if ( ! is_array( $progress ) ) {
				return $this->freeze_stock_attention( $claim, $raw, 'Stock line progress is missing for ' . $line['orderLineId'] . '.' );
			}
			if ( $progress['internal_status'] === Cetech_Pos_Bridge_Return_Effect_Store::LINE_COMPLETED ) {
				continue;
			}
			if ( in_array( $progress['internal_status'], array( Cetech_Pos_Bridge_Return_Effect_Store::LINE_APPLYING, Cetech_Pos_Bridge_Return_Effect_Store::LINE_REQUIRES_ATTENTION ), true ) ) {
				return $this->freeze_stock_attention( $claim, $raw, 'A stock line is ambiguous after provider entry and will not be incremented again.' );
			}
			$progress['internal_status'] = Cetech_Pos_Bridge_Return_Effect_Store::LINE_APPLYING;
			$this->effects->upsert_line( $progress );
			$this->runtime->notify_after_stock_line_armed();
			if ( $line['disposition'] === 'restock_sellable' ) {
				$qty = $this->integer_quantity( $line['quantity'] );
				if ( $qty === null ) {
					return $this->freeze_stock_attention( $claim, $raw, 'Sellable restock requires an integer historic quantity for the supported Woo stock API.' );
				}
				$owner  = $this->runtime->stock_managed_owner_id( $line['productId'], $line['variationId'] );
				$mutated = $this->runtime->increase_sellable_stock( $owner, $qty );
				if ( Cetech_Pos_Bridge_Quote_Request::is_error( $mutated ) ) {
					$progress['internal_status'] = Cetech_Pos_Bridge_Return_Effect_Store::LINE_REQUIRES_ATTENTION;
					$this->effects->upsert_line( $progress );
					return $this->freeze_stock_attention( $claim, $raw, $mutated->get_error_message() );
				}
				$this->runtime->notify_after_stock_line_mutated();
			}
			$progress['internal_status'] = Cetech_Pos_Bridge_Return_Effect_Store::LINE_COMPLETED;
			$this->effects->upsert_line( $progress );
		}
		return $this->persist_stock_completed( $claim, $raw );
	}

	/**
	 * @param array<string,mixed> $raw
	 * @return array<string,mixed>|WP_Error
	 */
	private function bind_completed_sale( array $raw, $allow_cetech_refunded = false ) {
		$prepare = $this->prepare_claims->get_by_transaction( $raw['transactionId'] );
		if ( ! is_array( $prepare ) ) {
			return $this->not_found_sale();
		}
		$prepared = $this->decode_prepared( $prepare );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $prepared ) ) {
			return $prepared;
		}
		if ( (string) $raw['saleId'] !== (string) $prepared['saleId'] ) {
			return $this->invalid_request( 'saleId', 'saleId' );
		}
		if ( (string) $raw['economicsVersion'] !== (string) $prepared['quoteFingerprint'] ) {
			return $this->invalid_request( 'economicsVersion', 'economicsVersion' );
		}
		$order_id = isset( $prepare['woo_order_id'] ) ? (string) $prepare['woo_order_id'] : '';
		if ( $order_id === '' ) {
			return $this->not_found_sale();
		}
		$finalize = $this->commands->get_by_transaction_operation( $raw['transactionId'], Cetech_Pos_Bridge_Constants::OPERATION_FINALIZE );
		if ( ! is_array( $finalize ) || $finalize['internal_status'] !== Cetech_Pos_Bridge_Command_Store::STATUS_COMPLETED ) {
			return $this->invalid_request( 'transactionId', 'transactionId' );
		}
		$snap = $this->runtime->inspect_commercial_snapshot( $order_id );
		if ( ! is_array( $snap ) || empty( $snap['found'] ) ) {
			return $this->unavailable( 'Authoritative Woo order could not be loaded for the original sale.' );
		}
		if ( empty( $snap['cetechOwned'] ) || (string) $snap['transactionId'] !== (string) $raw['transactionId'] ) {
			return $this->attention( 'Original Woo order is not the mapped CETECH sale.' );
		}
		if ( (string) $snap['saleId'] !== (string) $raw['saleId'] ) {
			return $this->invalid_request( 'saleId', 'saleId' );
		}
		$refunded_by_exact_cetech_refund = false;
		if (
			$allow_cetech_refunded &&
			isset( $snap['status'] ) &&
			(string) $snap['status'] === 'refunded' &&
			empty( $snap['paid'] )
		) {
			$proof = $this->prove_exact_cetech_commercial_refund( $raw, $order_id );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $proof ) ) {
				return $proof;
			}
			$refunded_by_exact_cetech_refund = true;
		}
		if ( ! empty( $snap['cancelled'] ) || ( empty( $snap['paid'] ) && ! $refunded_by_exact_cetech_refund ) ) {
			return $this->invalid_request( 'transactionId', 'transactionId' );
		}
		if ( isset( $raw['amount']['currency'] ) && strtoupper( (string) $raw['amount']['currency'] ) !== strtoupper( (string) $snap['currency'] ) ) {
			return $this->invalid_request( 'amount', 'amount' );
		}
		$quote = null;
		if ( isset( $prepare['quote_id'] ) && is_string( $prepare['quote_id'] ) && $prepare['quote_id'] !== '' ) {
			$loaded = $this->quotes->get( $prepare['quote_id'] );
			if ( is_array( $loaded ) ) {
				$quote = $loaded;
			}
		}
		return array(
			'prepare'  => $prepare,
			'prepared' => $prepared,
			'orderId'  => $order_id,
			'snap'     => $snap,
			'quote'    => $quote,
		);
	}

	/**
	 * A refunded, unpaid original order may bind a later stock disposition only
	 * when the exact CETECH commercial refund for this return exists in Woo.
	 *
	 * woo_effect_entered is set before wc_create_refund and means only that the
	 * operation crossed the external-effect boundary. It is not proof.
	 *
	 * Proof reuses find_commercial_refunds(), which reads:
	 * _cetech_pos_commercial_refund_id, _cetech_pos_commercial_refund_tx, and
	 * _cetech_pos_commercial_refund_hash. Those values must be the claim's
	 * commercialRefundId, transaction, and canonical request hash.
	 *
	 * @param array<string,mixed> $raw
	 * @param string              $order_id
	 * @return true|WP_Error
	 */
	private function prove_exact_cetech_commercial_refund( array $raw, $order_id ) {
		$claims = $this->effects->list_by_transaction_operation(
			$raw['transactionId'],
			Cetech_Pos_Bridge_Constants::OPERATION_COMMERCIAL_REFUND
		);
		$proven = 0;
		foreach ( $claims as $claim ) {
			if ( ! is_array( $claim ) || ! $this->commercial_claim_identifies_return( $claim, $raw, $order_id ) ) {
				continue;
			}
			$found = $this->runtime->find_commercial_refunds( $order_id, $claim['effect_id'] );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $found ) ) {
				return $this->attention( 'Exact CETECH native Woo refund could not be verified. Stock disposition will not restock.' );
			}
			if ( ! is_array( $found ) || count( $found ) !== 1 ) {
				continue;
			}
			if ( $this->native_refund_matches_claim( $found[0], $claim, $raw, $order_id ) ) {
				++$proven;
			}
		}
		if ( $proven === 1 ) {
			return true;
		}
		return $this->attention( 'Refunded Woo order is not proven to be this CETECH commercial refund. Stock disposition will not restock.' );
	}

	/**
	 * Durable claim identity for the intended commercial refund. Status and
	 * woo_effect_entered are intentionally not accepted here.
	 *
	 * @param array<string,mixed> $claim
	 * @param array<string,mixed> $raw
	 * @param string              $order_id
	 * @return bool
	 */
	private function commercial_claim_identifies_return( array $claim, array $raw, $order_id ) {
		foreach ( array( 'effect_id', 'return_request_id', 'sale_id', 'transaction_id', 'request_hash' ) as $field ) {
			if ( ! isset( $claim[ $field ] ) || ! is_string( $claim[ $field ] ) || $claim[ $field ] === '' ) {
				return false;
			}
		}
		if ( ! Cetech_Pos_Bridge_Quote_Request::is_uuid( $claim['effect_id'] ) ) {
			return false;
		}
		if ( (string) $claim['return_request_id'] !== (string) $raw['returnId'] ) {
			return false;
		}
		if ( (string) $claim['sale_id'] !== (string) $raw['saleId'] ) {
			return false;
		}
		if ( (string) $claim['transaction_id'] !== (string) $raw['transactionId'] ) {
			return false;
		}
		if ( isset( $claim['order_reference'] ) && (string) $claim['order_reference'] !== '' && (string) $claim['order_reference'] !== (string) $order_id ) {
			return false;
		}
		return true;
	}

	/**
	 * @param array<string,mixed> $refund described native refund
	 * @param array<string,mixed> $claim
	 * @param array<string,mixed> $raw
	 * @param string              $order_id
	 * @return bool
	 */
	private function native_refund_matches_claim( array $refund, array $claim, array $raw, $order_id ) {
		foreach ( array( 'parentOrderId', 'commercialRefundId', 'transactionId', 'requestHash' ) as $field ) {
			if ( ! isset( $refund[ $field ] ) || (string) $refund[ $field ] === '' ) {
				return false;
			}
		}
		if ( (string) $refund['parentOrderId'] !== (string) $order_id ) {
			return false;
		}
		if ( (string) $refund['commercialRefundId'] !== (string) $claim['effect_id'] ) {
			return false;
		}
		if ( (string) $refund['transactionId'] !== (string) $claim['transaction_id'] ) {
			return false;
		}
		if ( (string) $refund['transactionId'] !== (string) $raw['transactionId'] ) {
			return false;
		}
		if ( (string) $refund['requestHash'] !== (string) $claim['request_hash'] ) {
			return false;
		}
		return true;
	}

	/**
	 * @param array<string,mixed> $binding
	 * @return array<string,array<string,mixed>>|WP_Error keyed by lineId
	 */
	private function historic_commercial_lines( array $binding ) {
		$records = $this->runtime->inspect_historic_order_lines( $binding['orderId'] );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $records ) ) {
			return $records;
		}
		$by_id = array();
		foreach ( $records as $record ) {
			$lid = isset( $record['lineId'] ) ? (string) $record['lineId'] : '';
			if ( $lid === '' ) {
				return $this->attention( 'Original Woo order line is missing CETECH line identity.' );
			}
			if ( isset( $by_id[ $lid ] ) ) {
				return $this->attention( 'Original Woo order has an ambiguous CETECH line identity.' );
			}
			$by_id[ $lid ] = $record;
		}
		$quote = isset( $binding['quote'] ) && is_array( $binding['quote'] ) ? $binding['quote'] : null;
		if ( is_array( $quote ) && isset( $quote['lines'] ) && is_array( $quote['lines'] ) ) {
			foreach ( $quote['lines'] as $line ) {
				$lid = isset( $line['lineId'] ) ? (string) $line['lineId'] : '';
				if ( $lid === '' || ! isset( $by_id[ $lid ] ) ) {
					continue;
				}
				$mapped = $this->quote_line_minors( $line );
				$row    = $by_id[ $lid ];
				if ( $mapped === null ) {
					return $this->unavailable( 'Authoritative Quote line economics could not be read.' );
				}
				if ( (string) $row['productId'] !== (string) $line['productId'] ) {
					return $this->invalid_request( 'lineAllocations', 'lineAllocations' );
				}
				$qvid = isset( $line['variationId'] ) ? (string) $line['variationId'] : '';
				$rvid = isset( $row['variationId'] ) ? (string) $row['variationId'] : '';
				if ( $qvid !== $rvid ) {
					return $this->invalid_request( 'lineAllocations', 'lineAllocations' );
				}
				if ( (string) $row['quantity'] !== (string) $line['quantity']
					|| (int) $row['subtotal'] !== (int) $mapped['subtotal']
					|| (int) $row['discount'] !== (int) $mapped['discount']
					|| (int) $row['tax'] !== (int) $mapped['tax']
					|| (int) $row['total'] !== (int) $mapped['total'] ) {
					return $this->invalid_request( 'lineAllocations', 'lineAllocations' );
				}
			}
			$quote_total = isset( $quote['total']['minor'] ) ? (int) $quote['total']['minor'] : null;
			$snap_total  = isset( $binding['snap']['totalMinor'] ) ? (int) $binding['snap']['totalMinor'] : null;
			$prep_total  = isset( $binding['prepared']['total']['minor'] ) ? (int) $binding['prepared']['total']['minor'] : null;
			if ( $quote_total !== null && $snap_total !== null && $quote_total !== $snap_total ) {
				return $this->invalid_request( 'amount', 'amount' );
			}
			if ( $prep_total !== null && $snap_total !== null && $prep_total !== $snap_total ) {
				return $this->invalid_request( 'amount', 'amount' );
			}
		}
		return $by_id;
	}

	/**
	 * @param array<string,mixed> $binding
	 * @return array<string,array<string,mixed>>|WP_Error
	 */
	private function historic_stock_lines( array $binding ) {
		return $this->historic_commercial_lines( $binding );
	}

	/**
	 * @param array<string,mixed>                    $raw
	 * @param array<string,array<string,mixed>>      $historic
	 * @param array<string,mixed>|null               $current
	 * @return true|WP_Error
	 */
	private function validate_commercial_allocations( array $raw, array $historic, $current ) {
		$seen   = array();
		$sum    = 0;
		$amount = $raw['amount'];
		if ( strtoupper( (string) $amount['currency'] ) !== Cetech_Pos_Bridge_Constants::SETTLEMENT_CURRENCY ) {
			return $this->invalid_request( 'amount', 'amount' );
		}
		$snap_currency = isset( $raw['_unused'] ) ? '' : ( isset( $historic ) ? Cetech_Pos_Bridge_Constants::SETTLEMENT_CURRENCY : '' );
		unset( $snap_currency );
		foreach ( $raw['lineAllocations'] as $alloc ) {
			$lid = (string) $alloc['orderLineId'];
			if ( isset( $seen[ $lid ] ) ) {
				return $this->invalid_request( 'lineAllocations', 'lineAllocations' );
			}
			$seen[ $lid ] = true;
			if ( ! isset( $historic[ $lid ] ) ) {
				return $this->invalid_request( 'lineAllocations', 'lineAllocations' );
			}
			$row = $historic[ $lid ];
			if ( strtoupper( (string) $alloc['historicAmount']['currency'] ) !== strtoupper( (string) $amount['currency'] ) ) {
				return $this->invalid_request( 'lineAllocations', 'lineAllocations' );
			}
			$alloc_qty = $this->quantity_units( $alloc['quantity'] );
			$sold_qty  = $this->quantity_units( $row['quantity'] );
			if ( $alloc_qty === null || $sold_qty === null || $alloc_qty <= 0 ) {
				return $this->invalid_request( 'lineAllocations', 'lineAllocations' );
			}
			$consumed_qty = $this->consumed_commercial_quantity( $raw['transactionId'], $lid, $current );
			if ( $consumed_qty + $alloc_qty > $sold_qty ) {
				return $this->invalid_request( 'lineAllocations', 'lineAllocations' );
			}
			$alloc_amt = (int) $alloc['historicAmount']['minor'];
			if ( $alloc_amt <= 0 ) {
				return $this->invalid_request( 'lineAllocations', 'lineAllocations' );
			}
			$line_total     = (int) $row['total'];
			$consumed_amt   = $this->consumed_commercial_amount_for_line( $raw['transactionId'], $lid, $current );
			if ( $consumed_amt + $alloc_amt > $line_total ) {
				return $this->invalid_request( 'lineAllocations', 'lineAllocations' );
			}
			$sum += $alloc_amt;
		}
		if ( $sum !== (int) $amount['minor'] ) {
			return $this->invalid_request( 'amount', 'amount' );
		}
		$original = 0;
		foreach ( $historic as $row ) {
			$original += (int) $row['total'];
		}
		$consumed_total = $this->consumed_commercial_amount( $raw['transactionId'], $current );
		if ( $consumed_total + (int) $amount['minor'] > $original ) {
			return $this->invalid_request( 'amount', 'amount' );
		}
		return true;
	}

	/**
	 * @param array<string,mixed>               $raw
	 * @param array<string,array<string,mixed>> $historic
	 * @param array<string,mixed>|null          $current
	 * @return array<int,array<string,mixed>>|WP_Error
	 */
	private function validate_stock_lines( array $raw, array $historic, $current ) {
		$seen = array();
		$out  = array();
		foreach ( $raw['lines'] as $line ) {
			$lid = (string) $line['orderLineId'];
			if ( isset( $seen[ $lid ] ) ) {
				return $this->invalid_request( 'lines', 'lines' );
			}
			$seen[ $lid ] = true;
			if ( ! isset( $historic[ $lid ] ) ) {
				return $this->invalid_request( 'lines', 'lines' );
			}
			$row = $historic[ $lid ];
			$req_qty  = $this->quantity_units( $line['quantity'] );
			$sold_qty = $this->quantity_units( $row['quantity'] );
			if ( $req_qty === null || $sold_qty === null || $req_qty <= 0 ) {
				return $this->invalid_request( 'lines', 'lines' );
			}
			$consumed = $this->consumed_stock_quantity( $raw['transactionId'], $lid, $current );
			if ( $consumed + $req_qty > $sold_qty ) {
				return $this->invalid_request( 'lines', 'lines' );
			}
			$out[] = array(
				'orderLineId'  => $lid,
				'quantity'     => (string) $line['quantity'],
				'disposition'  => (string) $line['disposition'],
				'productId'    => (string) $row['productId'],
				'variationId'  => isset( $row['variationId'] ) && $row['variationId'] !== '' ? (string) $row['variationId'] : null,
			);
		}
		return $out;
	}

	/**
	 * @param string                   $transaction_id
	 * @param string                   $line_id
	 * @param array<string,mixed>|null $current
	 * @return int
	 */
	private function consumed_commercial_quantity( $transaction_id, $line_id, $current ) {
		$units = 0;
		foreach ( $this->reserved_commercial_claims( $transaction_id, $current ) as $claim ) {
			$request = $this->decoded_request( $claim );
			if ( ! is_array( $request ) || ! isset( $request['lineAllocations'] ) || ! is_array( $request['lineAllocations'] ) ) {
				continue;
			}
			foreach ( $request['lineAllocations'] as $alloc ) {
				if ( (string) $alloc['orderLineId'] === (string) $line_id ) {
					$q = $this->quantity_units( $alloc['quantity'] );
					if ( $q !== null ) {
						$units += $q;
					}
				}
			}
		}
		return $units;
	}

	private function consumed_commercial_amount_for_line( $transaction_id, $line_id, $current ) {
		$minor = 0;
		foreach ( $this->reserved_commercial_claims( $transaction_id, $current ) as $claim ) {
			$request = $this->decoded_request( $claim );
			if ( ! is_array( $request ) || ! isset( $request['lineAllocations'] ) || ! is_array( $request['lineAllocations'] ) ) {
				continue;
			}
			foreach ( $request['lineAllocations'] as $alloc ) {
				if ( (string) $alloc['orderLineId'] === (string) $line_id ) {
					$minor += (int) $alloc['historicAmount']['minor'];
				}
			}
		}
		return $minor;
	}

	private function consumed_commercial_amount( $transaction_id, $current ) {
		$minor = 0;
		foreach ( $this->reserved_commercial_claims( $transaction_id, $current ) as $claim ) {
			$request = $this->decoded_request( $claim );
			if ( is_array( $request ) && isset( $request['amount']['minor'] ) ) {
				$minor += (int) $request['amount']['minor'];
			}
		}
		return $minor;
	}

	/**
	 * @param string                   $transaction_id
	 * @param array<string,mixed>|null $current
	 * @return array<int,array<string,mixed>>
	 */
	private function reserved_commercial_claims( $transaction_id, $current ) {
		$out = array();
		foreach ( $this->effects->list_by_transaction_operation( $transaction_id, Cetech_Pos_Bridge_Constants::OPERATION_COMMERCIAL_REFUND ) as $claim ) {
			if ( is_array( $current ) && (string) $claim['effect_id'] === (string) $current['effect_id'] ) {
				continue;
			}
			if ( ! $this->claim_consumes_capacity( $claim ) ) {
				continue;
			}
			$out[] = $claim;
		}
		return $out;
	}

	private function consumed_stock_quantity( $transaction_id, $line_id, $current ) {
		$units = 0;
		$op    = Cetech_Pos_Bridge_Constants::OPERATION_STOCK_DISPOSITION;
		foreach ( $this->effects->list_by_transaction_operation( $transaction_id, $op ) as $claim ) {
			if ( is_array( $current ) && (string) $claim['effect_id'] === (string) $current['effect_id'] ) {
				continue;
			}
			if ( ! $this->claim_consumes_capacity( $claim ) ) {
				continue;
			}
			foreach ( $this->effects->list_lines( $op, $claim['effect_id'] ) as $line ) {
				if ( (string) $line['line_id'] !== (string) $line_id ) {
					continue;
				}
				if ( $line['internal_status'] === Cetech_Pos_Bridge_Return_Effect_Store::LINE_NOT_STARTED && ! $this->claim_consumes_capacity( $claim ) ) {
					continue;
				}
				$q = $this->quantity_units( $line['quantity'] );
				if ( $q !== null ) {
					$units += $q;
				}
			}
			$request = $this->decoded_request( $claim );
			if ( is_array( $request ) && isset( $request['lines'] ) && is_array( $request['lines'] ) ) {
				$have = $this->effects->list_lines( $op, $claim['effect_id'] );
				if ( count( $have ) === 0 ) {
					foreach ( $request['lines'] as $line ) {
						if ( (string) $line['orderLineId'] === (string) $line_id ) {
							$q = $this->quantity_units( $line['quantity'] );
							if ( $q !== null ) {
								$units += $q;
							}
						}
					}
				}
			}
		}
		return $units;
	}

	private function claim_consumes_capacity( array $claim ) {
		$status = (string) $claim['internal_status'];
		if ( $status === Cetech_Pos_Bridge_Return_Effect_Store::STATUS_TERMINAL_FAILURE && (int) $claim['woo_effect_entered'] === 0 ) {
			return false;
		}
		return in_array(
			$status,
			array(
				Cetech_Pos_Bridge_Return_Effect_Store::STATUS_PENDING,
				Cetech_Pos_Bridge_Return_Effect_Store::STATUS_IN_PROGRESS,
				Cetech_Pos_Bridge_Return_Effect_Store::STATUS_COMPLETED,
				Cetech_Pos_Bridge_Return_Effect_Store::STATUS_REQUIRES_ATTENTION,
			),
			true
		);
	}

	/**
	 * @param string $op
	 * @param string $key
	 * @param string $effect_id
	 * @param string $hash
	 * @return WP_Error|true|null
	 */
	private function replay_conflict_before_lock( $op, $key, $effect_id, $hash ) {
		$by_key = $this->effects->get_by_idempotency( $op, $key );
		if ( is_array( $by_key ) && (string) $by_key['request_hash'] !== (string) $hash ) {
			return $this->idempotency_conflict();
		}
		$by_id = $this->effects->get_by_effect_id( $op, $effect_id );
		if ( is_array( $by_id ) && (string) $by_id['request_hash'] !== (string) $hash ) {
			return $this->attention( 'Effect identity is already bound to a different semantic request.' );
		}
		return null;
	}

	private function replay_conflict_under_lock( $op, $key, $effect_id, $hash ) {
		return $this->replay_conflict_before_lock( $op, $key, $effect_id, $hash );
	}

	/**
	 * @param array<string,mixed> $claim
	 * @param array<string,mixed> $raw
	 * @param string              $provider_reference
	 * @return array<string,mixed>
	 */
	private function persist_commercial_completed( array $claim, array $raw, $provider_reference ) {
		$state = $this->commercial_state( $raw, 'completed' );
		$claim['internal_status']    = Cetech_Pos_Bridge_Return_Effect_Store::STATUS_COMPLETED;
		$claim['provider_reference'] = (string) $provider_reference;
		$claim['outcome_json']       = $this->encode_json( $state );
		$claim['error_code']         = null;
		$claim['error_message']      = null;
		$claim['error_details_json'] = null;
		$this->effects->save( $claim );
		return $state;
	}

	private function persist_stock_completed( array $claim, array $raw ) {
		$state = $this->stock_state( $raw, 'completed' );
		$claim['internal_status']    = Cetech_Pos_Bridge_Return_Effect_Store::STATUS_COMPLETED;
		$claim['outcome_json']       = $this->encode_json( $state );
		$claim['error_code']         = null;
		$claim['error_message']      = null;
		$claim['error_details_json'] = null;
		$this->effects->save( $claim );
		return $state;
	}

	private function freeze_attention( array $claim, array $raw, $message ) {
		$state = $this->commercial_state( $raw, 'requires_attention', $message );
		$claim['internal_status']    = Cetech_Pos_Bridge_Return_Effect_Store::STATUS_REQUIRES_ATTENTION;
		$claim['error_code']         = 'REQUIRES_ATTENTION';
		$claim['error_message']      = $this->safe_message( $message );
		$claim['outcome_json']       = $this->encode_json( $state );
		$this->effects->save( $claim );
		return $this->attention( $message );
	}

	private function freeze_stock_attention( array $claim, array $raw, $message ) {
		$state = $this->stock_state( $raw, 'requires_attention', $message );
		$claim['internal_status']    = Cetech_Pos_Bridge_Return_Effect_Store::STATUS_REQUIRES_ATTENTION;
		$claim['error_code']         = 'REQUIRES_ATTENTION';
		$claim['error_message']      = $this->safe_message( $message );
		$claim['outcome_json']       = $this->encode_json( $state );
		$this->effects->save( $claim );
		return $this->attention( $message );
	}

	private function persist_error( array $claim, $error ) {
		$code    = is_object( $error ) && method_exists( $error, 'get_error_code' ) ? (string) $error->get_error_code() : 'INTEGRATION_UNAVAILABLE';
		$message = is_object( $error ) && method_exists( $error, 'get_error_message' ) ? (string) $error->get_error_message() : 'Return effect failed.';
		$claim['internal_status'] = Cetech_Pos_Bridge_Return_Effect_Store::STATUS_TERMINAL_FAILURE;
		$claim['error_code']      = $code;
		$claim['error_message']   = $this->safe_message( $message );
		$this->effects->save( $claim );
		return $error;
	}

	private function commercial_state( array $raw, $status, $message = null ) {
		$state = array(
			'commercialRefundId' => $raw['commercialRefundId'],
			'returnId'           => $raw['returnId'],
			'transactionId'      => $raw['transactionId'],
			'saleId'             => $raw['saleId'],
			'status'             => $status,
			'amount'             => $raw['amount'],
			'economicsVersion'   => $raw['economicsVersion'],
		);
		if ( is_string( $message ) && $message !== '' ) {
			$state['message'] = $this->safe_message( $message );
		}
		return $state;
	}

	private function stock_state( array $raw, $status, $message = null ) {
		$state = array(
			'stockDispositionId' => $raw['stockDispositionId'],
			'returnId'           => $raw['returnId'],
			'transactionId'      => $raw['transactionId'],
			'saleId'             => $raw['saleId'],
			'status'             => $status,
			'economicsVersion'   => $raw['economicsVersion'],
		);
		if ( is_string( $message ) && $message !== '' ) {
			$state['message'] = $this->safe_message( $message );
		}
		return $state;
	}

	private function state_from_claim( array $claim, $status ) {
		$request = $this->decoded_request( $claim );
		$amount  = is_array( $request ) && isset( $request['amount'] ) ? $request['amount'] : Cetech_Pos_Bridge_Money::envelope( 0 );
		$econ    = is_array( $request ) && isset( $request['economicsVersion'] ) ? $request['economicsVersion'] : 'unknown';
		$return  = isset( $claim['return_request_id'] ) ? (string) $claim['return_request_id'] : ( is_array( $request ) && isset( $request['returnId'] ) ? $request['returnId'] : 'unknown' );
		$state   = array(
			'commercialRefundId' => $claim['effect_id'],
			'returnId'           => $return,
			'transactionId'      => $claim['transaction_id'],
			'saleId'             => $claim['sale_id'],
			'status'             => $status,
			'amount'             => $amount,
			'economicsVersion'   => $econ,
		);
		if ( isset( $claim['error_message'] ) && is_string( $claim['error_message'] ) && $claim['error_message'] !== '' ) {
			$state['message'] = $this->safe_message( $claim['error_message'] );
		}
		return $state;
	}

	private function stock_state_from_claim( array $claim, $status ) {
		$request = $this->decoded_request( $claim );
		$econ    = is_array( $request ) && isset( $request['economicsVersion'] ) ? $request['economicsVersion'] : 'unknown';
		$return  = isset( $claim['return_request_id'] ) ? (string) $claim['return_request_id'] : ( is_array( $request ) && isset( $request['returnId'] ) ? $request['returnId'] : 'unknown' );
		$state   = array(
			'stockDispositionId' => $claim['effect_id'],
			'returnId'           => $return,
			'transactionId'      => $claim['transaction_id'],
			'saleId'             => $claim['sale_id'],
			'status'             => $status,
			'economicsVersion'   => $econ,
		);
		if ( isset( $claim['error_message'] ) && is_string( $claim['error_message'] ) && $claim['error_message'] !== '' ) {
			$state['message'] = $this->safe_message( $claim['error_message'] );
		}
		return $state;
	}

	private function wire_state( array $outcome, array $claim, $status ) {
		if ( isset( $outcome['status'] ) ) {
			return $outcome;
		}
		return $this->state_from_claim( $claim, $status );
	}

	private function wire_stock_state( array $outcome, array $claim, $status ) {
		if ( isset( $outcome['status'] ) ) {
			return $outcome;
		}
		return $this->stock_state_from_claim( $claim, $status );
	}

	private function decoded_outcome( array $claim ) {
		if ( ! isset( $claim['outcome_json'] ) || ! is_string( $claim['outcome_json'] ) || $claim['outcome_json'] === '' ) {
			return null;
		}
		$decoded = json_decode( $claim['outcome_json'], true );
		return is_array( $decoded ) && isset( $decoded['status'] ) && $decoded['status'] === 'completed' ? $decoded : null;
	}

	private function decoded_request( array $claim ) {
		if ( ! isset( $claim['request_json'] ) || ! is_string( $claim['request_json'] ) || $claim['request_json'] === '' ) {
			return null;
		}
		$decoded = json_decode( $claim['request_json'], true );
		return is_array( $decoded ) ? $decoded : null;
	}

	private function decode_prepared( array $prepare ) {
		$decoded = json_decode( (string) $prepare['outcome_json'], true );
		if ( ! is_array( $decoded ) || ! isset( $decoded['saleId'] ) ) {
			return $this->unavailable( 'Prepared sale outcome could not be decoded.' );
		}
		return $decoded;
	}

	private function quote_line_minors( array $line ) {
		$sub = isset( $line['subtotal']['minor'] ) ? (int) $line['subtotal']['minor'] : null;
		$dis = isset( $line['discount']['minor'] ) ? (int) $line['discount']['minor'] : null;
		$tax = isset( $line['tax']['minor'] ) ? (int) $line['tax']['minor'] : null;
		$tot = isset( $line['total']['minor'] ) ? (int) $line['total']['minor'] : null;
		if ( $sub === null || $dis === null || $tax === null || $tot === null ) {
			return null;
		}
		return array(
			'subtotal' => $sub,
			'discount' => $dis,
			'tax'      => $tax,
			'total'    => $tot,
		);
	}

	private function quantity_units( $qty ) {
		$s = trim( (string) $qty );
		if ( $s === '' || ! preg_match( '/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,5})?$/', $s ) ) {
			return null;
		}
		$parts = explode( '.', $s, 2 );
		$whole = (int) $parts[0];
		$frac  = isset( $parts[1] ) ? str_pad( substr( $parts[1], 0, 5 ), 5, '0' ) : '00000';
		return ( $whole * 100000 ) + (int) $frac;
	}

	private function integer_quantity( $qty ) {
		$s = trim( (string) $qty );
		if ( ! preg_match( '/^[1-9][0-9]{0,8}$/', $s ) ) {
			return null;
		}
		return (int) $s;
	}

	private function all_lines_completed( array $lines ) {
		if ( $lines === array() ) {
			return false;
		}
		foreach ( $lines as $line ) {
			if ( $line['internal_status'] !== Cetech_Pos_Bridge_Return_Effect_Store::LINE_COMPLETED ) {
				return false;
			}
		}
		return true;
	}

	private function encode_request( array $raw ) {
		return $this->encode_json( $raw );
	}

	private function encode_json( $value ) {
		$json = function_exists( 'wp_json_encode' ) ? wp_json_encode( $value ) : json_encode( $value );
		return is_string( $json ) ? $json : null;
	}

	private function safe_message( $message ) {
		$s = trim( (string) $message );
		if ( strlen( $s ) > 200 ) {
			$s = substr( $s, 0, 200 );
		}
		return $s;
	}

	private function invalid_request( $schema, $field ) {
		unset( $schema );
		return Cetech_Pos_Bridge_Response::wp_error(
			'VALIDATION_ERROR',
			'Request does not match the frozen return-effect contract.',
			false,
			'none',
			400,
			array( 'field' => $field )
		);
	}

	private function not_found_sale() {
		return Cetech_Pos_Bridge_Response::wp_error(
			'NOT_FOUND',
			'Original CETECH sale was not found.',
			false,
			'none',
			404
		);
	}

	private function not_found_effect() {
		return Cetech_Pos_Bridge_Response::wp_error(
			'NOT_FOUND',
			'Return effect was not found.',
			false,
			'none',
			404
		);
	}

	private function idempotency_conflict() {
		return Cetech_Pos_Bridge_Response::wp_error(
			'IDEMPOTENCY_CONFLICT',
			'Idempotency-Key was reused with a different semantic request.',
			false,
			'contact_manager',
			409
		);
	}

	private function in_progress() {
		return Cetech_Pos_Bridge_Response::wp_error(
			'OPERATION_IN_PROGRESS',
			'A return-effect mutation is still in progress for this domain.',
			true,
			'resolve',
			202
		);
	}

	private function attention( $message ) {
		return Cetech_Pos_Bridge_Response::wp_error(
			'REQUIRES_ATTENTION',
			$this->safe_message( $message ),
			false,
			'contact_manager',
			409
		);
	}

	private function unavailable( $message ) {
		return Cetech_Pos_Bridge_Response::wp_error(
			'INTEGRATION_UNAVAILABLE',
			$this->safe_message( $message ),
			true,
			'resolve',
			503
		);
	}
}
