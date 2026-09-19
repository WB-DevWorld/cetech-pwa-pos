<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read-only provider-neutral customer search.
 * Does not compute B2BKing or WoodMart prices.
 */
final class Cetech_Pos_Bridge_Customers_Engine {
	const DEFAULT_LIMIT = 50;
	const MAX_LIMIT     = 100;

	/** @var callable */
	private $loader;

	public function __construct( $loader ) {
		$this->loader = $loader;
	}

	public static function woo_loader() {
		return array( self::class, 'load_woo_customers' );
	}

	/**
	 * @param string $query
	 * @param int    $limit
	 * @return array{items:array<int,array<string,mixed>>}|string
	 */
	public function search( $query, $limit ) {
		$loaded = call_user_func( $this->loader, $query, $limit );
		if ( $loaded === 'unavailable' ) {
			return 'unavailable';
		}
		$users = isset( $loaded['users'] ) && is_array( $loaded['users'] ) ? $loaded['users'] : array();
		$items = array();
		foreach ( $users as $user ) {
			$mapped = self::map_user( $user );
			if ( $mapped !== null ) {
				$items[] = $mapped;
			}
		}
		return array( 'items' => $items );
	}

	public static function normalize_limit( $value ) {
		if ( $value === null || $value === '' ) {
			return self::DEFAULT_LIMIT;
		}
		if ( is_string( $value ) && preg_match( '/^[0-9]+$/', $value ) ) {
			$value = (int) $value;
		}
		if ( ! is_int( $value ) || $value < 1 ) {
			return null;
		}
		return min( $value, self::MAX_LIMIT );
	}

	/**
	 * @param object|array<string,mixed> $user
	 * @return array<string,mixed>|null
	 */
	public static function map_user( $user ) {
		$id = self::user_id( $user );
		if ( $id === null ) {
			return null;
		}
		$display = self::string_prop( $user, array( 'display_name', 'displayName' ) );
		if ( $display === '' ) {
			$display = trim( self::string_prop( $user, array( 'first_name' ) ) . ' ' . self::string_prop( $user, array( 'last_name' ) ) );
		}
		if ( $display === '' ) {
			return null;
		}
		$company = self::string_prop( $user, array( 'billing_company', 'company' ) );
		$phone   = self::mask_phone( self::string_prop( $user, array( 'billing_phone', 'phone' ) ) );
		$kind    = self::is_b2b( $user ) ? 'b2b' : 'retail';
		$item    = array(
			'id'          => $id,
			'kind'        => $kind,
			'displayName' => $display,
		);
		if ( $company !== '' ) {
			$item['company'] = $company;
		}
		if ( $phone !== '' ) {
			$item['phoneMasked'] = $phone;
		}
		$context = self::commercial_context( $user );
		if ( $context !== '' ) {
			$item['commercialContext'] = $context;
		}
		return $item;
	}

	public static function load_woo_customers( $query, $limit ) {
		if ( ! function_exists( 'get_users' ) ) {
			return 'unavailable';
		}
		$args = array(
			'number'   => $limit,
			'role__in' => array( 'customer', 'subscriber' ),
			'orderby'  => 'display_name',
			'order'    => 'ASC',
		);
		$trimmed = is_string( $query ) ? trim( $query ) : '';
		if ( $trimmed !== '' ) {
			$args['search']         = '*' . $trimmed . '*';
			$args['search_columns'] = array( 'user_login', 'user_email', 'display_name' );
		}
		$users = get_users( $args );
		if ( ! is_array( $users ) ) {
			return 'unavailable';
		}
		$enriched = array();
		foreach ( $users as $user ) {
			$id = is_object( $user ) && isset( $user->ID ) ? (int) $user->ID : 0;
			$row = array(
				'ID'            => $id,
				'display_name'  => is_object( $user ) && isset( $user->display_name ) ? (string) $user->display_name : '',
				'billing_company' => function_exists( 'get_user_meta' ) ? (string) get_user_meta( $id, 'billing_company', true ) : '',
				'billing_phone'   => function_exists( 'get_user_meta' ) ? (string) get_user_meta( $id, 'billing_phone', true ) : '',
				'b2bking_b2buser' => function_exists( 'get_user_meta' ) ? (string) get_user_meta( $id, 'b2bking_b2buser', true ) : '',
				'b2bking_customergroup' => function_exists( 'get_user_meta' ) ? (string) get_user_meta( $id, 'b2bking_customergroup', true ) : '',
			);
			$enriched[] = $row;
		}
		return array( 'users' => $enriched );
	}

	private static function user_id( $user ) {
		if ( is_object( $user ) && isset( $user->ID ) ) {
			return (string) (int) $user->ID;
		}
		if ( is_array( $user ) && isset( $user['ID'] ) ) {
			return (string) (int) $user['ID'];
		}
		if ( is_array( $user ) && isset( $user['id'] ) ) {
			return (string) $user['id'];
		}
		return null;
	}

	private static function string_prop( $user, $keys ) {
		foreach ( $keys as $key ) {
			if ( is_object( $user ) && isset( $user->$key ) && is_scalar( $user->$key ) ) {
				return trim( (string) $user->$key );
			}
			if ( is_array( $user ) && isset( $user[ $key ] ) && is_scalar( $user[ $key ] ) ) {
				return trim( (string) $user[ $key ] );
			}
		}
		return '';
	}

	private static function is_b2b( $user ) {
		$flag = self::string_prop( $user, array( 'b2bking_b2buser' ) );
		return strtolower( $flag ) === 'yes';
	}

	private static function commercial_context( $user ) {
		$group = self::string_prop( $user, array( 'commercialContext', 'b2bking_group_name' ) );
		if ( $group !== '' ) {
			return $group;
		}
		$group_id = self::string_prop( $user, array( 'b2bking_customergroup' ) );
		if ( $group_id !== '' && function_exists( 'get_the_title' ) ) {
			$title = get_the_title( (int) $group_id );
			return is_string( $title ) ? trim( $title ) : '';
		}
		return '';
	}

	private static function mask_phone( $phone ) {
		$digits = preg_replace( '/\D+/', '', $phone );
		if ( ! is_string( $digits ) || $digits === '' ) {
			return '';
		}
		$prefix = substr( $digits, 0, min( 3, strlen( $digits ) ) );
		$suffix = strlen( $digits ) > 4 ? substr( $digits, -4 ) : $digits;
		return $prefix . ' *** ' . $suffix;
	}
}
