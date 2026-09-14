<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Isolated whole-cart quote. Restores every mutated runtime context in finally.
 * Never creates Woo orders, stock movements, or payments.
 */
final class Cetech_Pos_Bridge_Quote_Engine {
	/** @var Cetech_Pos_Bridge_Woo_Runtime */
	private $runtime;
	/** @var Cetech_Pos_Bridge_Quote_Store */
	private $store;

	public function __construct( Cetech_Pos_Bridge_Woo_Runtime $runtime, Cetech_Pos_Bridge_Quote_Store $store ) {
		$this->runtime = $runtime;
		$this->store   = $store;
	}

	/**
	 * @param array<string,mixed> $raw_request
	 * @return array<string,mixed>|WP_Error
	 */
	public function quote( array $raw_request ) {
		$parsed = Cetech_Pos_Bridge_Quote_Request::parse( $raw_request );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $parsed ) ) {
			return $parsed;
		}
		if ( ! $this->runtime->available() ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'INTEGRATION_UNAVAILABLE',
				'WooCommerce runtime is not available for quoting.',
				true,
				'resolve',
				503
			);
		}
		$snapshot = $this->runtime->snapshot();
		try {
			if ( method_exists( $this->runtime, 'isolate_counter_sale_shipping' ) ) {
				$this->runtime->isolate_counter_sale_shipping();
			}
			$installed = $this->runtime->install_customer_context( $parsed['customer'] );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $installed ) ) {
				return $installed;
			}
			$reset = $this->runtime->reset_cart();
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $reset ) ) {
				return $reset;
			}
			foreach ( $parsed['lines'] as $line ) {
				$added = $this->runtime->add_line( $line );
				if ( Cetech_Pos_Bridge_Quote_Request::is_error( $added ) ) {
					return $added;
				}
			}
			$calculated = $this->runtime->calculate_totals();
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $calculated ) ) {
				return $calculated;
			}
			$priced = $this->runtime->get_priced_cart();
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $priced ) ) {
				return $priced;
			}
			$quote = $this->normalize( $parsed, $priced );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $quote ) ) {
				return $quote;
			}
			$effects = $this->runtime->side_effect_counts();
			if ( (int) $effects['orders'] !== 0 || (int) $effects['stock'] !== 0 || (int) $effects['payments'] !== 0 ) {
				return Cetech_Pos_Bridge_Response::wp_error(
					'INTEGRATION_UNAVAILABLE',
					'Quote produced forbidden commerce side effects.',
					true,
					'resolve',
					503
				);
			}
			$contract = $this->assert_quote_contract( $quote );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $contract ) ) {
				return $contract;
			}
			$this->store->put( $quote );
			return $quote;
		} finally {
			$this->runtime->restore( $snapshot );
		}
	}

	/**
	 * Last gate before a priced cart leaves the bridge as a success.
	 *
	 * The candidate Quote is validated against the canonical v1 `Quote` schema. A
	 * contract-invalid Quote fails closed and is never stored or returned as
	 * `{ok:true}`. Nothing is stripped, coerced or repaired here: mutating an invalid
	 * Quote into a valid-looking one would hide a real pricing/mapping defect.
	 *
	 * This is an internal contract breach rather than a caller mistake, so it maps to
	 * the same `INTEGRATION_UNAVAILABLE` class the surrounding runtime-integrity
	 * checks already use, not to the caller-facing `VALIDATION_ERROR`.
	 *
	 * @param array<string,mixed> $quote
	 * @return true|WP_Error
	 */
	private function assert_quote_contract( array $quote ) {
		$violation = Cetech_Pos_Bridge_Schema::instance()->validate( $quote, 'Quote' );
		if ( $violation === null ) {
			return true;
		}
		return Cetech_Pos_Bridge_Response::wp_error(
			'INTEGRATION_UNAVAILABLE',
			'Quote did not satisfy the v1 contract schema and was not returned.',
			true,
			'resolve',
			503,
			array( 'field' => Cetech_Pos_Bridge_Schema::field_of( $violation ) )
		);
	}

	/**
	 * @param array<string,mixed> $parsed
	 * @param array<string,mixed> $priced
	 * @return array<string,mixed>|WP_Error
	 */
	private function normalize( array $parsed, array $priced ) {
		$currency = (string) $priced['currency'];
		$lines    = array();
		$request_lines = $parsed['lines'];
		$priced_lines  = $priced['lines'];
		if ( count( $priced_lines ) !== count( $request_lines ) ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'INTEGRATION_UNAVAILABLE',
				'Woo cart line count did not match the quote request.',
				true,
				'resolve',
				503
			);
		}
		$priced = Cetech_Pos_Bridge_Cart_Discount::apply_to_priced_cart( $priced, $request_lines );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $priced ) ) {
			return $priced;
		}
		$priced_lines = $priced['lines'];
		$sum_subtotal = 0;
		$sum_discount = 0;
		$sum_tax      = 0;
		$sum_total    = 0;
		$purchasable  = true;
		foreach ( $request_lines as $index => $request_line ) {
			$runtime_line = $priced_lines[ $index ];
			$normalized   = $this->normalize_line( $request_line, $runtime_line, $currency );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $normalized ) ) {
				return $normalized;
			}
			$lines[]       = $normalized;
			$sum_subtotal += $normalized['subtotal']['minor'];
			$sum_discount += $normalized['discount']['minor'];
			$sum_tax      += $normalized['tax']['minor'];
			$sum_total    += $normalized['total']['minor'];
			if ( ! $normalized['purchasable'] ) {
				$purchasable = false;
			}
		}
		$subtotal = $this->money_from_runtime( $priced['subtotal'], $currency, 'subtotal' );
		$discount = $this->money_from_runtime( $priced['discount'], $currency, 'discount' );
		$tax      = $this->money_from_runtime( $priced['tax'], $currency, 'tax' );
		$total    = $this->money_from_runtime( $priced['total'], $currency, 'total' );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $subtotal ) ) {
			return $subtotal;
		}
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $discount ) ) {
			return $discount;
		}
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $tax ) ) {
			return $tax;
		}
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $total ) ) {
			return $total;
		}
		if ( $subtotal['minor'] !== $sum_subtotal || $discount['minor'] !== $sum_discount || $tax['minor'] !== $sum_tax || $total['minor'] !== $sum_total ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'INTEGRATION_UNAVAILABLE',
				'Quote totals did not equal summed line totals from the Woo runtime.',
				true,
				'resolve',
				503
			);
		}
		$expected_total = Cetech_Pos_Bridge_Money::line_total( $subtotal['minor'], $discount['minor'], $tax['minor'] );
		if ( $expected_total !== $total['minor'] ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'INTEGRATION_UNAVAILABLE',
				'Quote total identity subtotal - discount + tax failed.',
				true,
				'resolve',
				503
			);
		}
		$now     = gmdate( 'Y-m-d\TH:i:s\Z' );
		$expires = gmdate( 'Y-m-d\TH:i:s\Z', time() + Cetech_Pos_Bridge_Constants::QUOTE_TTL_SECONDS );
		$id      = $this->new_quote_id();
		$quote   = array(
			'id'            => $id,
			'cartId'        => $parsed['cartId'],
			'cartRevision'  => $parsed['cartRevision'],
			'customer'      => $parsed['customer'],
			'locationId'    => $parsed['locationId'],
			'currency'      => $currency,
			'lines'         => $lines,
			'subtotal'      => $subtotal,
			'discount'      => $discount,
			'tax'           => $tax,
			'total'         => $total,
			'calculatedAt'  => $now,
			'expiresAt'     => $expires,
			'purchasable'   => $purchasable,
		);
		$quote['fingerprint'] = $this->fingerprint( $quote );
		return $quote;
	}

	private function normalize_line( array $request_line, array $runtime_line, $currency ) {
		$subtotal = $this->money_from_runtime( $runtime_line['subtotal'], $currency, 'lines' );
		$discount = $this->money_from_runtime( $runtime_line['discount'], $currency, 'lines' );
		$tax      = $this->money_from_runtime( $runtime_line['tax'], $currency, 'lines' );
		$unit     = $this->money_from_runtime( $runtime_line['unitPrice'], $currency, 'lines' );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $subtotal ) ) {
			return $subtotal;
		}
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $discount ) ) {
			return $discount;
		}
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $tax ) ) {
			return $tax;
		}
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $unit ) ) {
			return $unit;
		}
		$total = Cetech_Pos_Bridge_Money::envelope(
			Cetech_Pos_Bridge_Money::line_total( $subtotal['minor'], $discount['minor'], $tax['minor'] ),
			$currency
		);
		$problems = array();
		if ( isset( $runtime_line['problems'] ) && is_array( $runtime_line['problems'] ) ) {
			foreach ( $runtime_line['problems'] as $problem ) {
				if ( ! is_array( $problem ) || ! isset( $problem['code'], $problem['message'] ) ) {
					continue;
				}
				$entry = array(
					'code'    => (string) $problem['code'],
					'message' => (string) $problem['message'],
					'lineId'  => $request_line['lineId'],
				);
				$problems[] = $entry;
			}
		}
		$line = array(
			'lineId'      => $request_line['lineId'],
			'productId'   => $request_line['productId'],
			'quantity'    => $request_line['quantity'],
			'unitPrice'   => $unit,
			'subtotal'    => $subtotal,
			'discount'    => $discount,
			'tax'         => $tax,
			'total'       => $total,
			'stockStatus' => isset( $runtime_line['stockStatus'] ) ? (string) $runtime_line['stockStatus'] : 'unknown',
			'purchasable' => ! empty( $runtime_line['purchasable'] ),
			'problems'    => $problems,
		);
		if ( isset( $request_line['variationId'] ) ) {
			$line['variationId'] = $request_line['variationId'];
		}
		if ( ! empty( $runtime_line['pricingLabel'] ) && is_string( $runtime_line['pricingLabel'] ) ) {
			$line['pricingLabel'] = $runtime_line['pricingLabel'];
		}
		return $line;
	}

	private function money_from_runtime( $decimal, $currency, $field ) {
		$minor = Cetech_Pos_Bridge_Money::from_decimal_string( $decimal, $currency );
		if ( $minor === null ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'INTEGRATION_UNAVAILABLE',
				'Woo runtime returned an amount the v1 money adapter cannot convert.',
				true,
				'resolve',
				503,
				array( 'field' => $field )
			);
		}
		return Cetech_Pos_Bridge_Money::envelope( $minor, $currency );
	}

	private function new_quote_id() {
		return 'q' . bin2hex( random_bytes( 16 ) );
	}

	private function fingerprint( array $quote ) {
		$canonical = $quote;
		unset( $canonical['id'], $canonical['fingerprint'], $canonical['calculatedAt'], $canonical['expiresAt'] );
		$json = function_exists( 'wp_json_encode' )
			? wp_json_encode( $this->ksort_recursive( $canonical ) )
			: json_encode( $this->ksort_recursive( $canonical ) );
		return hash( 'sha256', (string) $json );
	}

	private function ksort_recursive( $value ) {
		if ( ! is_array( $value ) ) {
			return $value;
		}
		$is_list = array_keys( $value ) === range( 0, count( $value ) - 1 );
		if ( ! $is_list ) {
			ksort( $value );
		}
		foreach ( $value as $key => $item ) {
			$value[ $key ] = $this->ksort_recursive( $item );
		}
		return $value;
	}
}
