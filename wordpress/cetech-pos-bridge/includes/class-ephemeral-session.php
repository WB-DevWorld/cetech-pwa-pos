<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Request-local session bag. Avoids writing Woo session cookies during a quote.
 * Method names match WC_Session / WC_Session_Handler so calculate_totals does
 * not fatal when the isolated object is not the storefront handler.
 */
class Cetech_Pos_Bridge_Ephemeral_Session {
	/** @var array<string,mixed> */
	private $data = array();
	/** @var int */
	private $customer_id = 0;

	public function init() {
		return true;
	}

	public function cleanup_sessions() {
		return true;
	}

	public function get( $key, $default = null ) {
		$key = (string) $key;
		return array_key_exists( $key, $this->data ) ? $this->data[ $key ] : $default;
	}

	public function set( $key, $value ) {
		$this->data[ (string) $key ] = $value;
	}

	public function __get( $key ) {
		return $this->get( $key );
	}

	public function __set( $key, $value ) {
		$this->set( $key, $value );
	}

	public function __isset( $key ) {
		return array_key_exists( (string) $key, $this->data );
	}

	public function __unset( $key ) {
		unset( $this->data[ (string) $key ] );
	}

	public function get_customer_id() {
		return $this->customer_id;
	}

	public function set_customer_id( $id ) {
		$this->customer_id = (int) $id;
	}

	public function get_customer_unique_id() {
		return (string) $this->customer_id;
	}

	public function has_session() {
		return true;
	}

	public function save_data() {
		return true;
	}

	public function destroy_session() {
		$this->data        = array();
		$this->customer_id = 0;
		return true;
	}

	public function forget_session() {
		return $this->destroy_session();
	}

	public function set_customer_session_cookie( $set = true ) {
		unset( $set );
		return false;
	}

	public function init_session_cookie() {
		return true;
	}

	public function get_session_cookie() {
		return false;
	}

	/**
	 * Swallow unknown WC_Session_Handler calls. Quote must not fatal because
	 * a storefront session method is absent on the ephemeral bag.
	 *
	 * @param string           $name
	 * @param array<int,mixed> $arguments
	 * @return null
	 */
	public function __call( $name, $arguments ) {
		unset( $name, $arguments );
		return null;
	}
}
