<?php
/**
 * Deterministic derivation of the shipped bridge quote-contract artifact from the
 * canonical repository JSON Schema.
 *
 * The canonical contract `docs/contracts/pos-domain.schema.json` is owned by WS3 and
 * is NOT shipped inside the WordPress plugin. This tool extracts the transitive
 * `$defs` closure reachable from `QuoteRequest` and `Quote` into
 * `schema/quote-contract.v1.json`, which the plugin loads at runtime.
 *
 * There is exactly one source of contract truth. The artifact is a mechanical
 * projection of it, and `tests/bridge/test-quote-schema.php` re-derives the artifact
 * and fails when the committed file and the canonical schema diverge.
 *
 * This tool never edits the canonical contract. Run from the repository root:
 *
 *   php wordpress/cetech-pos-bridge/tools/derive-quote-contract.php --check
 *   php wordpress/cetech-pos-bridge/tools/derive-quote-contract.php --write
 */

final class Cetech_Pos_Bridge_Contract_Derivation {
	const CANONICAL_RELATIVE = 'docs/contracts/pos-domain.schema.json';
	const ARTIFACT_RELATIVE  = 'wordpress/cetech-pos-bridge/schema/quote-contract.v1.json';

	/**
	 * Roots the Woo bridge boundary enforces. Sorted; the derivation must not depend
	 * on traversal order.
	 *
	 * @var array<int,string>
	 */
	const ROOTS = array( 'Quote', 'QuoteRequest' );

	/**
	 * Keyword vocabulary the shipped PHP validator implements. A canonical schema that
	 * starts using a keyword outside this list must fail derivation rather than be
	 * silently under-enforced at the bridge boundary.
	 *
	 * @var array<int,string>
	 */
	const SUPPORTED_KEYWORDS = array(
		'$ref',
		'additionalProperties',
		'const',
		'enum',
		'items',
		'maxItems',
		'maxLength',
		'maximum',
		'minItems',
		'minLength',
		'minimum',
		'oneOf',
		'pattern',
		'properties',
		'required',
		'type',
	);

	/**
	 * @param string $repository_root
	 * @return array<string,mixed>
	 * @throws RuntimeException when the canonical schema is unreadable or uses an unsupported keyword.
	 */
	public static function derive( $repository_root ) {
		$canonical_path = rtrim( (string) $repository_root, '/\\' ) . '/' . self::CANONICAL_RELATIVE;
		$raw            = @file_get_contents( $canonical_path );
		if ( ! is_string( $raw ) || $raw === '' ) {
			throw new RuntimeException( 'Canonical contract schema could not be read: ' . self::CANONICAL_RELATIVE );
		}
		$canonical = json_decode( $raw, true );
		if ( ! is_array( $canonical ) || ! isset( $canonical['$defs'] ) || ! is_array( $canonical['$defs'] ) ) {
			throw new RuntimeException( 'Canonical contract schema has no $defs object.' );
		}
		$all     = $canonical['$defs'];
		$subset  = array();
		$pending = self::ROOTS;
		while ( $pending !== array() ) {
			$name = array_shift( $pending );
			if ( array_key_exists( $name, $subset ) ) {
				continue;
			}
			if ( ! isset( $all[ $name ] ) || ! is_array( $all[ $name ] ) ) {
				throw new RuntimeException( 'Canonical contract schema is missing $defs/' . $name );
			}
			$node            = $all[ $name ];
			$subset[ $name ] = $node;
			foreach ( self::collect_refs( $node, '#/$defs/' . $name ) as $ref ) {
				if ( ! array_key_exists( $ref, $subset ) ) {
					$pending[] = $ref;
				}
			}
		}
		ksort( $subset, SORT_STRING );
		return array(
			'$defs'        => $subset,
			'roots'        => self::ROOTS,
			'schemaSource' => self::CANONICAL_RELATIVE,
		);
	}

	/**
	 * Walks one schema node, rejects unsupported keywords and returns referenced $defs names.
	 *
	 * @param mixed  $node
	 * @param string $path
	 * @return array<int,string>
	 * @throws RuntimeException
	 */
	private static function collect_refs( $node, $path ) {
		if ( ! is_array( $node ) ) {
			throw new RuntimeException( 'Canonical schema node is not an object at ' . $path );
		}
		$refs = array();
		foreach ( $node as $keyword => $value ) {
			if ( ! in_array( $keyword, self::SUPPORTED_KEYWORDS, true ) ) {
				throw new RuntimeException(
					'Canonical schema uses keyword "' . $keyword . '" at ' . $path
					. ' which the bridge validator does not implement.'
				);
			}
			if ( $keyword === '$ref' ) {
				$refs[] = self::ref_name( $value, $path );
				continue;
			}
			if ( $keyword === 'properties' ) {
				if ( ! is_array( $value ) ) {
					throw new RuntimeException( 'properties must be an object at ' . $path );
				}
				foreach ( $value as $property => $sub ) {
					$refs = array_merge( $refs, self::collect_refs( $sub, $path . '/properties/' . $property ) );
				}
				continue;
			}
			if ( $keyword === 'items' ) {
				$refs = array_merge( $refs, self::collect_refs( $value, $path . '/items' ) );
				continue;
			}
			if ( $keyword === 'oneOf' ) {
				if ( ! is_array( $value ) ) {
					throw new RuntimeException( 'oneOf must be an array at ' . $path );
				}
				foreach ( $value as $index => $sub ) {
					$refs = array_merge( $refs, self::collect_refs( $sub, $path . '/oneOf/' . $index ) );
				}
				continue;
			}
			if ( $keyword === 'additionalProperties' && $value !== false ) {
				throw new RuntimeException( 'Only additionalProperties:false is supported at ' . $path );
			}
		}
		return $refs;
	}

	/**
	 * @param mixed  $ref
	 * @param string $path
	 * @return string
	 * @throws RuntimeException
	 */
	private static function ref_name( $ref, $path ) {
		$prefix = '#/$defs/';
		if ( ! is_string( $ref ) || strpos( $ref, $prefix ) !== 0 ) {
			throw new RuntimeException( 'Only local #/$defs/ references are supported at ' . $path );
		}
		$name = substr( $ref, strlen( $prefix ) );
		if ( $name === '' || strpos( $name, '/' ) !== false ) {
			throw new RuntimeException( 'Unsupported $ref target at ' . $path );
		}
		return $name;
	}

	/**
	 * Canonical on-disk encoding for the artifact.
	 *
	 * @param array<string,mixed> $derived
	 * @return string
	 */
	public static function encode( array $derived ) {
		$json = json_encode( $derived, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		if ( ! is_string( $json ) ) {
			throw new RuntimeException( 'Derived contract artifact could not be encoded.' );
		}
		return $json . "\n";
	}
}

if ( PHP_SAPI === 'cli' && isset( $argv[0] ) && realpath( $argv[0] ) === realpath( __FILE__ ) ) {
	$root     = dirname( __DIR__, 3 );
	$mode     = isset( $argv[1] ) ? (string) $argv[1] : '--check';
	$artifact = $root . '/' . Cetech_Pos_Bridge_Contract_Derivation::ARTIFACT_RELATIVE;
	$derived  = Cetech_Pos_Bridge_Contract_Derivation::derive( $root );
	if ( $mode === '--write' ) {
		file_put_contents( $artifact, Cetech_Pos_Bridge_Contract_Derivation::encode( $derived ) );
		echo "wrote " . Cetech_Pos_Bridge_Contract_Derivation::ARTIFACT_RELATIVE . "\n";
		exit( 0 );
	}
	$current = json_decode( (string) @file_get_contents( $artifact ), true );
	if ( $current === $derived ) {
		echo "artifact matches the canonical contract\n";
		exit( 0 );
	}
	fwrite( STDERR, "artifact diverges from the canonical contract; run with --write\n" );
	exit( 1 );
}
