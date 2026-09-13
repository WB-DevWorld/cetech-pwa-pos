<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Cetech_Pos_Bridge_Health_Controller {
	/** @var Cetech_Pos_Bridge_Auth */
	private $auth;
	/** @var Cetech_Pos_Bridge_Correlation */
	private $correlation;
	/** @var Cetech_Pos_Bridge_Detector */
	private $detector;

	public function __construct(
		Cetech_Pos_Bridge_Auth $auth,
		Cetech_Pos_Bridge_Correlation $correlation,
		Cetech_Pos_Bridge_Detector $detector
	) {
		$this->auth         = $auth;
		$this->correlation  = $correlation;
		$this->detector     = $detector;
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
		return Cetech_Pos_Bridge_Response::success( $this->detector->detect(), $correlation );
	}

	private static function is_error( $value ) {
		if ( function_exists( 'is_wp_error' ) && is_wp_error( $value ) ) {
			return true;
		}
		return is_object( $value ) && ! empty( $value->is_wp_error );
	}
}
