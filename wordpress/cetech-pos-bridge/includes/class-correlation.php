<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Cetech_Pos_Bridge_Correlation {
	/**
	 * Require a contract-valid X-Correlation-ID. Does not invent a replacement
	 * for a successful request. API-CONVENTIONS.md requires generating a new
	 * UUID only when a missing/invalid inbound ID must be rejected.
	 *
	 * @param object $request Request with get_header( $name ).
	 * @return string|WP_Error Valid UUID string or WP_Error carrying VALIDATION_ERROR.
	 */
	public function require_header( $request ) {
		$header = '';
		if ( is_object( $request ) && method_exists( $request, 'get_header' ) ) {
			$header = (string) $request->get_header( 'X-Correlation-ID' );
			if ( $header === '' ) {
				$header = (string) $request->get_header( 'x-correlation-id' );
			}
		}
		$header = trim( $header );
		if ( $header !== '' && preg_match( Cetech_Pos_Bridge_Constants::UUID_PATTERN, $header ) ) {
			return $header;
		}
		return Cetech_Pos_Bridge_Response::wp_error(
			'VALIDATION_ERROR',
			'X-Correlation-ID must be a contract UUID.',
			false,
			'none',
			400,
			array( 'field' => 'X-Correlation-ID' ),
			self::generate_uuid()
		);
	}

	public static function generate_uuid() {
		$bytes = random_bytes( 16 );
		$bytes[6] = chr( ( ord( $bytes[6] ) & 0x0f ) | 0x40 );
		$bytes[8] = chr( ( ord( $bytes[8] ) & 0x3f ) | 0x80 );
		$hex      = bin2hex( $bytes );
		return sprintf(
			'%s-%s-%s-%s-%s',
			substr( $hex, 0, 8 ),
			substr( $hex, 8, 4 ),
			substr( $hex, 12, 4 ),
			substr( $hex, 16, 4 ),
			substr( $hex, 20, 12 )
		);
	}
}
