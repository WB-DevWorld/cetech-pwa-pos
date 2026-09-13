<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Exact minor-unit conversion. Never uses binary floating-point price arithmetic.
 * Does not implement WoodMart or B2BKing formulas.
 */
final class Cetech_Pos_Bridge_Money {
	public static function from_decimal_string( $value, $currency ) {
		$currency = strtoupper( (string) $currency );
		if ( $currency !== Cetech_Pos_Bridge_Constants::SETTLEMENT_CURRENCY ) {
			return null;
		}
		$s = trim( (string) $value );
		if ( $s === '' || ! preg_match( '/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/', $s ) ) {
			return null;
		}
		$parts = explode( '.', $s, 2 );
		$whole = $parts[0];
		$frac  = isset( $parts[1] ) ? str_pad( $parts[1], Cetech_Pos_Bridge_Constants::PRICE_DECIMALS, '0' ) : '00';
		return ( (int) $whole * 100 ) + (int) $frac;
	}

	public static function to_decimal_string( $minor ) {
		$minor = (int) $minor;
		if ( $minor < 0 ) {
			return null;
		}
		return sprintf( '%d.%02d', intdiv( $minor, 100 ), $minor % 100 );
	}

	public static function envelope( $minor, $currency = Cetech_Pos_Bridge_Constants::SETTLEMENT_CURRENCY ) {
		return array(
			'minor'    => (int) $minor,
			'currency' => (string) $currency,
		);
	}

	public static function line_total( $subtotal, $discount, $tax ) {
		return (int) $subtotal - (int) $discount + (int) $tax;
	}
}
