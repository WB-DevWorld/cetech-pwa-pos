<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Canonical semantic-request fingerprint. Correlation IDs and transport headers
 * are never part of the hash. Keys are sorted; lists keep their order.
 */
final class Cetech_Pos_Bridge_Request_Hash {
	/**
	 * @param mixed $value
	 * @return string SHA-256 hex
	 */
	public static function hash( $value ) {
		$json = function_exists( 'wp_json_encode' )
			? wp_json_encode( self::canonicalize( $value ) )
			: json_encode( self::canonicalize( $value ) );
		return hash( 'sha256', (string) $json );
	}

	/**
	 * @param mixed $value
	 * @return mixed
	 */
	public static function canonicalize( $value ) {
		if ( ! is_array( $value ) ) {
			return $value;
		}
		$is_list = $value === array() ? false : array_keys( $value ) === range( 0, count( $value ) - 1 );
		if ( $is_list ) {
			$out = array();
			foreach ( $value as $item ) {
				$out[] = self::canonicalize( $item );
			}
			return $out;
		}
		ksort( $value, SORT_STRING );
		foreach ( $value as $key => $item ) {
			$value[ $key ] = self::canonicalize( $item );
		}
		return $value;
	}
}
