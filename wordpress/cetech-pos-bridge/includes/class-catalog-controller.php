<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Cetech_Pos_Bridge_Catalog_Controller {
	/** @var Cetech_Pos_Bridge_Auth */
	private $auth;
	/** @var Cetech_Pos_Bridge_Correlation */
	private $correlation;
	/** @var Cetech_Pos_Bridge_Catalog_Engine */
	private $engine;

	public function __construct(
		Cetech_Pos_Bridge_Auth $auth,
		Cetech_Pos_Bridge_Correlation $correlation,
		Cetech_Pos_Bridge_Catalog_Engine $engine
	) {
		$this->auth         = $auth;
		$this->correlation  = $correlation;
		$this->engine       = $engine;
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
		$limit = Cetech_Pos_Bridge_Catalog_Engine::normalize_limit( $request->get_param( 'limit' ) );
		if ( $limit === null ) {
			return Cetech_Pos_Bridge_Response::failure(
				'VALIDATION_ERROR',
				'limit must be a positive integer.',
				$correlation,
				array( 'field' => 'limit' )
			);
		}
		$cursor          = self::optional_string( $request->get_param( 'cursor' ) );
		if ( $cursor !== null && ! preg_match( '/^[1-9][0-9]*$/', $cursor ) ) {
			return Cetech_Pos_Bridge_Response::failure(
				'VALIDATION_ERROR',
				'cursor must be a positive Woo product id string.',
				$correlation,
				array( 'field' => 'cursor' )
			);
		}
		$modified_after  = self::optional_string( $request->get_param( 'modifiedAfter' ) );
		if ( $modified_after !== null && ! preg_match( Cetech_Pos_Bridge_Constants::TIMESTAMP_PATTERN, $modified_after ) ) {
			return Cetech_Pos_Bridge_Response::failure(
				'VALIDATION_ERROR',
				'modifiedAfter must be a contract timestamp.',
				$correlation,
				array( 'field' => 'modifiedAfter' )
			);
		}
		$page = $this->engine->page( $cursor, $limit, $modified_after );
		if ( $page === 'unavailable' ) {
			return Cetech_Pos_Bridge_Response::failure(
				'INTEGRATION_UNAVAILABLE',
				'WooCommerce catalog listing is not available.',
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
		$trimmed = trim( $value );
		return $trimmed === '' ? null : $trimmed;
	}

	private static function is_error( $value ) {
		if ( function_exists( 'is_wp_error' ) && is_wp_error( $value ) ) {
			return true;
		}
		return is_object( $value ) && ! empty( $value->is_wp_error );
	}
}
