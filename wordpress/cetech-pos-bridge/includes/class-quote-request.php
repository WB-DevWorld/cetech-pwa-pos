<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Frozen v1 QuoteRequest ingress gate. Does not price.
 *
 * The canonical `QuoteRequest` JSON Schema is enforced first, from the shipped
 * projection of `docs/contracts/pos-domain.schema.json`. The normalisation below then
 * produces the canonical field order the Woo runtime consumes. Contract-invalid
 * payloads are rejected here, before any Woo/WoodMart/B2BKing pricing runs.
 */
final class Cetech_Pos_Bridge_Quote_Request {
	/**
	 * @param mixed $raw
	 * @return array<string,mixed>|WP_Error
	 */
	public static function parse( $raw ) {
		if ( ! is_array( $raw ) ) {
			return self::invalid( 'QuoteRequest must be a JSON object.', 'body' );
		}
		$violation = Cetech_Pos_Bridge_Schema::instance()->validate( $raw, 'QuoteRequest' );
		if ( $violation !== null ) {
			return self::invalid(
				'QuoteRequest does not satisfy the v1 contract schema.',
				Cetech_Pos_Bridge_Schema::field_of( $violation )
			);
		}
		$allowed = array( 'cartId', 'cartRevision', 'customer', 'locationId', 'lines' );
		foreach ( array_keys( $raw ) as $key ) {
			if ( ! in_array( $key, $allowed, true ) ) {
				return self::invalid( 'Unexpected QuoteRequest field.', (string) $key );
			}
		}
		foreach ( $allowed as $key ) {
			if ( ! array_key_exists( $key, $raw ) ) {
				return self::invalid( 'QuoteRequest is missing a required field.', $key );
			}
		}
		if ( ! self::is_uuid( $raw['cartId'] ) ) {
			return self::invalid( 'cartId must be a contract UUID.', 'cartId' );
		}
		if ( ! is_int( $raw['cartRevision'] ) || $raw['cartRevision'] < 0 ) {
			return self::invalid( 'cartRevision must be a non-negative integer.', 'cartRevision' );
		}
		$customer = self::parse_customer( $raw['customer'] );
		if ( self::is_error( $customer ) ) {
			return $customer;
		}
		if ( ! self::is_id( $raw['locationId'] ) ) {
			return self::invalid( 'locationId must be a contract Id.', 'locationId' );
		}
		$lines = self::parse_lines( $raw['lines'] );
		if ( self::is_error( $lines ) ) {
			return $lines;
		}
		return array(
			'cartId'       => $raw['cartId'],
			'cartRevision' => $raw['cartRevision'],
			'customer'     => $customer,
			'locationId'   => $raw['locationId'],
			'lines'        => $lines,
		);
	}

	private static function parse_customer( $raw ) {
		if ( ! is_array( $raw ) || ! isset( $raw['kind'] ) || ! is_string( $raw['kind'] ) ) {
			return self::invalid( 'customer must be a CustomerContext object.', 'customer' );
		}
		if ( $raw['kind'] === 'walkin' ) {
			if ( array_keys( $raw ) !== array( 'kind' ) ) {
				return self::invalid( 'walkin CustomerContext allows only kind.', 'customer' );
			}
			return array( 'kind' => 'walkin' );
		}
		if ( $raw['kind'] !== 'retail' && $raw['kind'] !== 'b2b' ) {
			return self::invalid( 'customer.kind is not a contract value.', 'customer' );
		}
		$allowed = array( 'kind', 'customerId' );
		foreach ( array_keys( $raw ) as $key ) {
			if ( ! in_array( $key, $allowed, true ) ) {
				return self::invalid( 'Unexpected CustomerContext field.', 'customer' );
			}
		}
		if ( ! isset( $raw['customerId'] ) || ! self::is_id( $raw['customerId'] ) ) {
			return self::invalid( 'customerId must be a contract Id.', 'customer' );
		}
		return array(
			'kind'       => $raw['kind'],
			'customerId' => $raw['customerId'],
		);
	}

	private static function parse_lines( $raw ) {
		if ( ! is_array( $raw ) || $raw === array() || count( $raw ) > 200 ) {
			return self::invalid( 'lines must contain 1–200 items.', 'lines' );
		}
		$lines = array();
		$seen  = array();
		foreach ( $raw as $index => $line ) {
			if ( ! is_array( $line ) ) {
				return self::invalid( 'Each line must be an object.', 'lines' );
			}
			$allowed = array( 'lineId', 'productId', 'variationId', 'quantity' );
			foreach ( array_keys( $line ) as $key ) {
				if ( ! in_array( $key, $allowed, true ) ) {
					return self::invalid( 'Unexpected QuoteRequestLine field.', 'lines' );
				}
			}
			foreach ( array( 'lineId', 'productId', 'quantity' ) as $req ) {
				if ( ! array_key_exists( $req, $line ) ) {
					return self::invalid( 'QuoteRequestLine is missing a required field.', 'lines' );
				}
			}
			if ( ! self::is_uuid( $line['lineId'] ) ) {
				return self::invalid( 'lineId must be a contract UUID.', 'lines' );
			}
			if ( isset( $seen[ $line['lineId'] ] ) ) {
				return self::invalid( 'lineId values must be unique.', 'lines' );
			}
			$seen[ $line['lineId'] ] = true;
			if ( ! self::is_id( $line['productId'] ) ) {
				return self::invalid( 'productId must be a contract Id.', 'lines' );
			}
			$variation = null;
			if ( array_key_exists( 'variationId', $line ) ) {
				if ( ! self::is_id( $line['variationId'] ) ) {
					return self::invalid( 'variationId must be a contract Id.', 'lines' );
				}
				$variation = $line['variationId'];
			}
			if ( ! is_string( $line['quantity'] ) || ! preg_match( Cetech_Pos_Bridge_Constants::QUANTITY_PATTERN, $line['quantity'] ) ) {
				return self::invalid( 'quantity must be a canonical decimal string.', 'lines' );
			}
			$parsed = array(
				'lineId'    => $line['lineId'],
				'productId' => $line['productId'],
				'quantity'  => $line['quantity'],
			);
			if ( $variation !== null ) {
				$parsed['variationId'] = $variation;
			}
			$lines[] = $parsed;
			unset( $index );
		}
		return $lines;
	}

	public static function is_uuid( $value ) {
		return is_string( $value ) && (bool) preg_match( Cetech_Pos_Bridge_Constants::UUID_PATTERN, $value );
	}

	public static function is_id( $value ) {
		return is_string( $value ) && strlen( $value ) >= 1 && strlen( $value ) <= 128
			&& (bool) preg_match( Cetech_Pos_Bridge_Constants::ID_PATTERN, $value );
	}

	private static function invalid( $message, $field ) {
		return Cetech_Pos_Bridge_Response::wp_error(
			'VALIDATION_ERROR',
			$message,
			false,
			'none',
			400,
			array( 'field' => $field )
		);
	}

	public static function is_error( $value ) {
		if ( function_exists( 'is_wp_error' ) && is_wp_error( $value ) ) {
			return true;
		}
		return is_object( $value ) && ! empty( $value->is_wp_error );
	}
}
