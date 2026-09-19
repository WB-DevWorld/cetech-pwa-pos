<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Cetech_Pos_Bridge_Customers_Controller {
	/** @var Cetech_Pos_Bridge_Auth */
	private $auth;
	/** @var Cetech_Pos_Bridge_Correlation */
	private $correlation;
	/** @var Cetech_Pos_Bridge_Customers_Engine */
	private $engine;

	public function __construct(
		Cetech_Pos_Bridge_Auth $auth,
		Cetech_Pos_Bridge_Correlation $correlation,
		Cetech_Pos_Bridge_Customers_Engine $engine
	) {
		$this->auth        = $auth;
		$this->correlation = $correlation;
		$this->engine      = $engine;
	}

	public function permission_callback( $request ) {
		unset( $request );
		return $this->auth->permission_callback();
	}

	public function handle( $request ) {
		$correlation = $this->correlation->require_header( $request );
		if ( self::is_error( $correlation ) ) {
			return Cetech_Pos_Bridge_Response::from_wp_error( $correlation, Cetech_Pos_Bridge_Correlation::generate_uuid() );
		}
		$limit = Cetech_Pos_Bridge_Customers_Engine::normalize_limit( $request->get_param( 'limit' ) );
		if ( $limit === null ) {
			return Cetech_Pos_Bridge_Response::failure(
				'VALIDATION_ERROR',
				'limit must be a positive integer.',
				$correlation,
				array( 'field' => 'limit' )
			);
		}
		$query  = self::optional_string( $request->get_param( 'query' ) );
		$page   = $this->engine->search( $query === null ? '' : $query, $limit );
		if ( $page === 'unavailable' ) {
			return Cetech_Pos_Bridge_Response::failure(
				'INTEGRATION_UNAVAILABLE',
				'WooCommerce customer listing is not available.',
				$correlation
			);
		}
		return Cetech_Pos_Bridge_Response::success( $page, $correlation );
	}

	private static function optional_string( $value ) {
		if ( $value === null || $value === '' ) {
			return null;
		}
		if ( ! is_string( $value ) ) {
			return null;
		}
		return trim( $value );
	}

	private static function is_error( $value ) {
		return is_object( $value ) && method_exists( $value, 'get_error_code' );
	}
}
