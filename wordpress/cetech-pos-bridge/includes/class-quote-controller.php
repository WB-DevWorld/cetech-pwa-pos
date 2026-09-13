<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Cetech_Pos_Bridge_Quote_Controller {
	/** @var Cetech_Pos_Bridge_Auth */
	private $auth;
	/** @var Cetech_Pos_Bridge_Correlation */
	private $correlation;
	/** @var Cetech_Pos_Bridge_Quote_Engine */
	private $engine;

	public function __construct(
		Cetech_Pos_Bridge_Auth $auth,
		Cetech_Pos_Bridge_Correlation $correlation,
		Cetech_Pos_Bridge_Quote_Engine $engine
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
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $correlation ) ) {
			return Cetech_Pos_Bridge_Response::from_wp_error( $correlation, Cetech_Pos_Bridge_Correlation::generate_uuid() );
		}
		$body = array();
		if ( is_object( $request ) && method_exists( $request, 'get_json_params' ) ) {
			$params = $request->get_json_params();
			if ( is_array( $params ) ) {
				$body = $params;
			}
		}
		$result = $this->engine->quote( $body );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $result ) ) {
			$response = Cetech_Pos_Bridge_Response::from_wp_error( $result, $correlation );
			return $this->no_store( $response );
		}
		return $this->no_store( Cetech_Pos_Bridge_Response::success( $result, $correlation ) );
	}

	private function no_store( $response ) {
		if ( is_object( $response ) && method_exists( $response, 'header' ) ) {
			$response->header( 'Cache-Control', 'no-store' );
		}
		return $response;
	}
}
