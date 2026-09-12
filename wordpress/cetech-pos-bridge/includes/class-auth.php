<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Cetech_Pos_Bridge_Auth {
	/** @var Cetech_Pos_Bridge_Environment */
	private $environment;

	public function __construct( Cetech_Pos_Bridge_Environment $environment ) {
		$this->environment = $environment;
	}

	/**
	 * Permission callback: deny unauthenticated callers and authenticated
	 * callers who lack the dedicated bridge capability. Administrator is not enough.
	 *
	 * @return true|WP_Error
	 */
	public function permission_callback() {
		if ( ! $this->environment->is_user_logged_in() ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'AUTH_REQUIRED',
				'Authentication is required for the CETECH POS bridge.',
				false,
				'reauthenticate',
				401
			);
		}
		if ( ! $this->environment->current_user_can( Cetech_Pos_Bridge_Constants::CAPABILITY ) ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'FORBIDDEN',
				'The dedicated bridge capability is required.',
				false,
				'none',
				403
			);
		}
		return true;
	}
}
