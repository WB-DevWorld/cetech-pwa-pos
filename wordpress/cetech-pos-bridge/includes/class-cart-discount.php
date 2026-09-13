<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * ADR-013 cart-level commercial discount allocation.
 * Integer minor units only. Does not copy WoodMart or B2BKing formulas.
 */
final class Cetech_Pos_Bridge_Cart_Discount {
	/**
	 * @param array<int,array{lineId:string,subtotalMinor:int,discountMinor:int,taxMinor:int}> $lines
	 * @param int                                                                             $cart_discount_minor
	 * @return array<int,array<string,int|string>>|WP_Error
	 */
	public static function allocate( array $lines, $cart_discount_minor ) {
		$cart_discount_minor = (int) $cart_discount_minor;
		if ( $cart_discount_minor < 0 ) {
			return self::fail( 'Cart-level discount minor units cannot be negative.' );
		}
		$seen     = array();
		$prepared = array();
		$bases    = array();
		$sum_bases = 0;
		foreach ( $lines as $line ) {
			if ( ! is_array( $line ) || ! isset( $line['lineId'] ) ) {
				return self::fail( 'Cart-level discount allocation requires a lineId on every line.' );
			}
			$line_id = (string) $line['lineId'];
			if ( ! preg_match( Cetech_Pos_Bridge_Constants::UUID_PATTERN, $line_id ) ) {
				return self::fail( 'Cart-level discount allocation requires a contract UUID lineId.' );
			}
			if ( isset( $seen[ $line_id ] ) ) {
				return self::fail( 'Cart-level discount allocation cannot tie-break duplicate lineIds.' );
			}
			$seen[ $line_id ] = true;
			$sub      = (int) $line['subtotalMinor'];
			$existing = (int) $line['discountMinor'];
			$tax      = (int) $line['taxMinor'];
			if ( $sub < 0 || $existing < 0 || $tax < 0 ) {
				return self::fail( 'Cart-level discount allocation received a negative line money field.' );
			}
			if ( $existing > $sub ) {
				return self::fail( 'Existing line discount exceeded line subtotal.' );
			}
			$base       = $sub - $existing;
			$prepared[] = array(
				'lineId'             => $line_id,
				'subtotalMinor'      => $sub,
				'lineDiscountMinor'  => $existing,
				'taxMinor'           => $tax,
				'baseMinor'          => $base,
			);
			$bases[]     = $base;
			$sum_bases  += $base;
		}
		if ( $cart_discount_minor === 0 ) {
			return self::finish( $prepared, array_fill( 0, count( $prepared ), 0 ) );
		}
		if ( $sum_bases <= 0 || $cart_discount_minor > $sum_bases ) {
			return self::fail( 'Cart-level commercial discount exceeded eligible line economics.' );
		}
		$floors     = array();
		$rems       = array();
		$sum_floors = 0;
		foreach ( $bases as $i => $base ) {
			$product       = $cart_discount_minor * $base;
			$floors[ $i ]  = intdiv( $product, $sum_bases );
			$rems[ $i ]    = $product % $sum_bases;
			$sum_floors   += $floors[ $i ];
		}
		$left  = $cart_discount_minor - $sum_floors;
		$order = array_keys( $prepared );
		usort(
			$order,
			static function ( $a, $b ) use ( $rems, $prepared ) {
				if ( $rems[ $a ] !== $rems[ $b ] ) {
					return $rems[ $b ] <=> $rems[ $a ];
				}
				return strcmp( $prepared[ $a ]['lineId'], $prepared[ $b ]['lineId'] );
			}
		);
		foreach ( $order as $rank => $i ) {
			if ( $rank >= $left ) {
				break;
			}
			++$floors[ $i ];
		}
		return self::finish( $prepared, $floors );
	}

	/**
	 * @param array<string,mixed>        $priced
	 * @param array<int,array<string,mixed>> $request_lines
	 * @return array<string,mixed>|WP_Error
	 */
	public static function apply_to_priced_cart( array $priced, array $request_lines ) {
		$currency   = isset( $priced['currency'] ) ? (string) $priced['currency'] : Cetech_Pos_Bridge_Constants::SETTLEMENT_CURRENCY;
		$cart_level = isset( $priced['cartLevelDiscountMinor'] ) ? (int) $priced['cartLevelDiscountMinor'] : 0;
		if ( $cart_level < 0 ) {
			return self::fail( 'cartLevelDiscountMinor cannot be negative.' );
		}
		$priced_lines = isset( $priced['lines'] ) && is_array( $priced['lines'] ) ? $priced['lines'] : array();
		if ( count( $priced_lines ) !== count( $request_lines ) ) {
			return self::fail( 'Cart-level discount allocation line count did not match the quote request.' );
		}
		$input = array();
		foreach ( $request_lines as $i => $request_line ) {
			$runtime = $priced_lines[ $i ];
			$sub     = Cetech_Pos_Bridge_Money::from_decimal_string( $runtime['subtotal'], $currency );
			$disc    = Cetech_Pos_Bridge_Money::from_decimal_string( $runtime['discount'], $currency );
			$tax     = Cetech_Pos_Bridge_Money::from_decimal_string( $runtime['tax'], $currency );
			if ( $sub === null || $disc === null || $tax === null || ! isset( $request_line['lineId'] ) ) {
				return self::fail( 'A quote line money field could not be converted while allocating a cart-level discount.' );
			}
			$input[] = array(
				'lineId'         => (string) $request_line['lineId'],
				'subtotalMinor'  => $sub,
				'discountMinor'  => $disc,
				'taxMinor'       => $tax,
			);
		}
		$allocated = self::allocate( $input, $cart_level );
		if ( self::is_error( $allocated ) ) {
			return $allocated;
		}
		$sum_discount = 0;
		foreach ( $allocated as $i => $row ) {
			$decimal = Cetech_Pos_Bridge_Money::to_decimal_string( $row['discountMinor'] );
			if ( $decimal === null ) {
				return self::fail( 'Allocated line discount could not be formatted.' );
			}
			$priced['lines'][ $i ]['discount']                 = $decimal;
			$priced['lines'][ $i ]['cartLevelDiscountMinor'] = (int) $row['allocatedMinor'];
			$sum_discount                                   += (int) $row['discountMinor'];
		}
		$cart_decimal = Cetech_Pos_Bridge_Money::to_decimal_string( $sum_discount );
		if ( $cart_decimal === null ) {
			return self::fail( 'Allocated cart discount could not be formatted.' );
		}
		$priced['discount'] = $cart_decimal;
		return $priced;
	}

	public static function is_error( $value ) {
		return Cetech_Pos_Bridge_Quote_Request::is_error( $value );
	}

	/**
	 * @param array<int,array<string,int|string>> $prepared
	 * @param array<int,int>                      $allocated
	 * @return array<int,array<string,int|string>>|WP_Error
	 */
	private static function finish( array $prepared, array $allocated ) {
		$out = array();
		foreach ( $prepared as $i => $row ) {
			$share     = (int) $allocated[ $i ];
			$combined  = (int) $row['lineDiscountMinor'] + $share;
			if ( $combined > (int) $row['subtotalMinor'] ) {
				return self::fail( 'Allocated cart-level discount exceeded a line subtotal.' );
			}
			$row['allocatedMinor'] = $share;
			$row['discountMinor']  = $combined;
			$row['totalMinor']     = Cetech_Pos_Bridge_Money::line_total( $row['subtotalMinor'], $combined, $row['taxMinor'] );
			$out[]                 = $row;
		}
		return $out;
	}

	private static function fail( $message ) {
		return Cetech_Pos_Bridge_Response::wp_error(
			'INTEGRATION_UNAVAILABLE',
			$message,
			true,
			'resolve',
			503
		);
	}
}
