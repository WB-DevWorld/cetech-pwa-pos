<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Runtime enforcement of the frozen v1 JSON Schema at the Woo bridge boundary
 * for QuoteRequest, Quote, PrepareSaleRequest, PreparedSale and SaleResolution.
 *
 * Contract source: `docs/contracts/pos-domain.schema.json` (WS3-owned, unchanged).
 * The plugin ships `schema/quote-contract.v1.json`, a mechanical projection of that
 * file produced by `tools/derive-quote-contract.php`. This class is a validator, not
 * a second contract: it holds no field names, enums or formats of its own, and
 * `tests/bridge/test-quote-schema.php` re-derives the artifact so divergence from the
 * canonical schema fails the bridge suite.
 *
 * Supported keyword vocabulary is deliberately narrow and fails closed. An
 * unrecognised keyword is a validation failure, never a silently skipped rule.
 */
final class Cetech_Pos_Bridge_Schema {
	/** @var self|null */
	private static $instance = null;

	/** @var array<string,array<string,mixed>> */
	private $defs;

	/** @var array<int,string> */
	private $roots;

	/**
	 * @param array<string,mixed> $artifact
	 */
	private function __construct( array $artifact ) {
		$this->defs  = isset( $artifact['$defs'] ) && is_array( $artifact['$defs'] ) ? $artifact['$defs'] : array();
		$this->roots = isset( $artifact['roots'] ) && is_array( $artifact['roots'] ) ? $artifact['roots'] : array();
	}

	public static function artifact_path() {
		return dirname( __DIR__ ) . '/schema/quote-contract.v1.json';
	}

	/**
	 * @return self
	 */
	public static function instance() {
		if ( self::$instance === null ) {
			$raw       = @file_get_contents( self::artifact_path() );
			$artifact  = is_string( $raw ) ? json_decode( $raw, true ) : null;
			self::$instance = new self( is_array( $artifact ) ? $artifact : array() );
		}
		return self::$instance;
	}

	/**
	 * Test seam. Production code uses instance().
	 *
	 * @param array<string,mixed>|null $artifact
	 */
	public static function set_instance_for_tests( $artifact ) {
		self::$instance = is_array( $artifact ) ? new self( $artifact ) : null;
	}

	/**
	 * @return array<int,string>
	 */
	public function roots() {
		return $this->roots;
	}

	public function has_definition( $name ) {
		return isset( $this->defs[ $name ] ) && is_array( $this->defs[ $name ] );
	}

	/**
	 * Validates a decoded JSON value against one canonical definition.
	 *
	 * @param mixed  $value
	 * @param string $definition
	 * @return array{path:string,keyword:string}|null Null when the value satisfies the contract.
	 */
	public function validate( $value, $definition ) {
		if ( ! $this->has_definition( $definition ) ) {
			return self::violation( '', 'definition' );
		}
		return $this->check( $value, $this->defs[ $definition ], '' );
	}

	/**
	 * Maps a violation pointer onto the single top-level field name that the frozen
	 * ApiFailure `details.field` allows. Never returns payload values.
	 *
	 * @param array{path:string,keyword:string}|null $violation
	 * @return string
	 */
	public static function field_of( $violation ) {
		if ( ! is_array( $violation ) || ! isset( $violation['path'] ) || $violation['path'] === '' ) {
			return 'body';
		}
		$segments = explode( '/', ltrim( (string) $violation['path'], '/' ) );
		$first    = isset( $segments[0] ) ? $segments[0] : '';
		return $first === '' ? 'body' : $first;
	}

	/**
	 * @param mixed               $value
	 * @param array<string,mixed> $schema
	 * @param string              $path
	 * @return array{path:string,keyword:string}|null
	 */
	private function check( $value, array $schema, $path ) {
		if ( isset( $schema['$ref'] ) ) {
			$name = $this->ref_name( $schema['$ref'] );
			if ( $name === null || ! $this->has_definition( $name ) ) {
				return self::violation( $path, '$ref' );
			}
			return $this->check( $value, $this->defs[ $name ], $path );
		}
		foreach ( $schema as $keyword => $rule ) {
			$failure = $this->check_keyword( $keyword, $rule, $value, $schema, $path );
			if ( $failure !== null ) {
				return $failure;
			}
		}
		return null;
	}

	/**
	 * @param string              $keyword
	 * @param mixed               $rule
	 * @param mixed               $value
	 * @param array<string,mixed> $schema
	 * @param string              $path
	 * @return array{path:string,keyword:string}|null
	 */
	private function check_keyword( $keyword, $rule, $value, array $schema, $path ) {
		switch ( $keyword ) {
			case 'type':
				return self::is_type( $value, (string) $rule ) ? null : self::violation( $path, 'type' );
			case 'const':
				return $value === $rule ? null : self::violation( $path, 'const' );
			case 'enum':
				return is_array( $rule ) && in_array( $value, $rule, true ) ? null : self::violation( $path, 'enum' );
			case 'pattern':
				if ( ! is_string( $value ) ) {
					return self::violation( $path, 'pattern' );
				}
				return preg_match( '~' . (string) $rule . '~', $value ) === 1 ? null : self::violation( $path, 'pattern' );
			case 'minLength':
				return is_string( $value ) && self::string_length( $value ) >= (int) $rule ? null : self::violation( $path, 'minLength' );
			case 'maxLength':
				return is_string( $value ) && self::string_length( $value ) <= (int) $rule ? null : self::violation( $path, 'maxLength' );
			case 'minimum':
				return is_int( $value ) && $value >= $rule ? null : self::violation( $path, 'minimum' );
			case 'maximum':
				return is_int( $value ) && $value <= $rule ? null : self::violation( $path, 'maximum' );
			case 'minItems':
				return self::is_json_array( $value ) && count( $value ) >= (int) $rule ? null : self::violation( $path, 'minItems' );
			case 'maxItems':
				return self::is_json_array( $value ) && count( $value ) <= (int) $rule ? null : self::violation( $path, 'maxItems' );
			case 'required':
				return $this->check_required( $rule, $value, $path );
			case 'properties':
				return $this->check_properties( $rule, $value, $path );
			case 'additionalProperties':
				return $this->check_additional( $rule, $value, $schema, $path );
			case 'items':
				return $this->check_items( $rule, $value, $path );
			case 'oneOf':
				return $this->check_one_of( $rule, $value, $path );
			default:
				// Fail closed: an unimplemented keyword must never pass silently.
				return self::violation( $path, 'unsupportedKeyword' );
		}
	}

	private function check_required( $rule, $value, $path ) {
		if ( ! is_array( $rule ) ) {
			return self::violation( $path, 'required' );
		}
		if ( ! self::is_json_object( $value ) ) {
			return self::violation( $path, 'required' );
		}
		foreach ( $rule as $name ) {
			if ( ! array_key_exists( (string) $name, $value ) ) {
				return self::violation( $path . '/' . (string) $name, 'required' );
			}
		}
		return null;
	}

	private function check_properties( $rule, $value, $path ) {
		if ( ! is_array( $rule ) ) {
			return self::violation( $path, 'properties' );
		}
		if ( ! self::is_json_object( $value ) ) {
			return self::violation( $path, 'properties' );
		}
		foreach ( $rule as $name => $sub ) {
			if ( ! array_key_exists( $name, $value ) ) {
				continue;
			}
			if ( ! is_array( $sub ) ) {
				return self::violation( $path . '/' . $name, 'properties' );
			}
			$failure = $this->check( $value[ $name ], $sub, $path . '/' . $name );
			if ( $failure !== null ) {
				return $failure;
			}
		}
		return null;
	}

	private function check_additional( $rule, $value, array $schema, $path ) {
		if ( $rule !== false ) {
			return self::violation( $path, 'additionalProperties' );
		}
		if ( ! self::is_json_object( $value ) ) {
			return self::violation( $path, 'additionalProperties' );
		}
		$known = isset( $schema['properties'] ) && is_array( $schema['properties'] ) ? $schema['properties'] : array();
		foreach ( array_keys( $value ) as $name ) {
			if ( ! array_key_exists( $name, $known ) ) {
				return self::violation( $path . '/' . (string) $name, 'additionalProperties' );
			}
		}
		return null;
	}

	private function check_items( $rule, $value, $path ) {
		if ( ! is_array( $rule ) ) {
			return self::violation( $path, 'items' );
		}
		if ( ! self::is_json_array( $value ) ) {
			return self::violation( $path, 'items' );
		}
		foreach ( $value as $index => $item ) {
			$failure = $this->check( $item, $rule, $path . '/' . (string) $index );
			if ( $failure !== null ) {
				return $failure;
			}
		}
		return null;
	}

	private function check_one_of( $rule, $value, $path ) {
		if ( ! is_array( $rule ) || $rule === array() ) {
			return self::violation( $path, 'oneOf' );
		}
		$matches = 0;
		foreach ( $rule as $sub ) {
			if ( ! is_array( $sub ) ) {
				return self::violation( $path, 'oneOf' );
			}
			if ( $this->check( $value, $sub, $path ) === null ) {
				++$matches;
			}
		}
		return $matches === 1 ? null : self::violation( $path, 'oneOf' );
	}

	private function ref_name( $ref ) {
		$prefix = '#/$defs/';
		if ( ! is_string( $ref ) || strpos( $ref, $prefix ) !== 0 ) {
			return null;
		}
		$name = substr( $ref, strlen( $prefix ) );
		return ( $name === '' || strpos( $name, '/' ) !== false ) ? null : $name;
	}

	/**
	 * @param mixed  $value
	 * @param string $type
	 */
	private static function is_type( $value, $type ) {
		switch ( $type ) {
			case 'object':
				return self::is_json_object( $value );
			case 'array':
				return self::is_json_array( $value );
			case 'string':
				return is_string( $value );
			case 'integer':
				return is_int( $value );
			case 'number':
				return is_int( $value ) || is_float( $value );
			case 'boolean':
				return is_bool( $value );
			case 'null':
				return $value === null;
			default:
				return false;
		}
	}

	/**
	 * WordPress decodes request bodies with json_decode($body, true), so a JSON object
	 * arrives as an associative array and a JSON array as a list. An empty array is
	 * ambiguous and is accepted by both; `required`/`minItems` then reject it.
	 *
	 * @param mixed $value
	 */
	private static function is_json_object( $value ) {
		return is_array( $value ) && ( $value === array() || ! self::is_list( $value ) );
	}

	/**
	 * @param mixed $value
	 */
	private static function is_json_array( $value ) {
		return is_array( $value ) && ( $value === array() || self::is_list( $value ) );
	}

	/**
	 * @param array<mixed> $value
	 */
	private static function is_list( array $value ) {
		return array_keys( $value ) === range( 0, count( $value ) - 1 );
	}

	private static function string_length( $value ) {
		return function_exists( 'mb_strlen' ) ? mb_strlen( $value, 'UTF-8' ) : strlen( $value );
	}

	/**
	 * @return array{path:string,keyword:string}
	 */
	private static function violation( $path, $keyword ) {
		return array(
			'path'    => (string) $path,
			'keyword' => (string) $keyword,
		);
	}
}
