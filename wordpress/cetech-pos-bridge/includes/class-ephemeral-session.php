<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Request-local session bag. Avoids writing Woo session cookies during a quote.
 */
class Cetech_Pos_Bridge_Ephemeral_Session {
	/** @var array<string,mixed> */
	private $data = array();

	public function get( $key, $default = null ) {
		return array_key_exists( $key, $this->data ) ? $this->data[ $key ] : $default;
	}

	public function set( $key, $value ) {
		$this->data[ $key ] = $value;
	}

	public function __get( $key ) {
		return $this->get( $key );
	}

	public function __set( $key, $value ) {
		$this->set( $key, $value );
	}

	public function has_session() {
		return true;
	}

	public function save_data() {
		return true;
	}
}
