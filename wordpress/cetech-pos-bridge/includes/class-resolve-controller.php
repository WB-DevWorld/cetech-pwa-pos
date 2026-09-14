<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * GET sale resolution. Not a financial command. Never creates an order.
 */
final class Cetech_Pos_Bridge_Resolve_Controller {
	/** @var Cetech_Pos_Bridge_Auth */
	private $auth;
	/** @var Cetech_Pos_Bridge_Correlation */
	private $correlation;
	/** @var Cetech_Pos_Bridge_Prepare_Engine */
	private $engine;

	public function __construct(
		Cetech_Pos_Bridge_Auth $auth,
		Cetech_Pos_Bridge_Correlation $correlation,
		Cetech_Pos_Bridge_Prepare_Engine $engine
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
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $correlation ) ) {
			return Cetech_Pos_Bridge_Response::from_wp_error( $correlation, Cetech_Pos_Bridge_Correlation::generate_uuid() );
		}
		$transaction_id = $this->transaction_id( $request );
		try {
			$result = $this->engine->resolve( $transaction_id );
		} catch ( \Throwable $e ) {
			unset( $e );
			$result = Cetech_Pos_Bridge_Response::wp_error(
				'INTEGRATION_UNAVAILABLE',
				'Resolve runtime aborted before returning a sale resolution.',
				true,
				'resolve',
				503
			);
		}
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $result ) ) {
			return $this->no_store( Cetech_Pos_Bridge_Response::from_wp_error( $result, $correlation ) );
		}
		$encoded = $this->encode_payload( $result );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $encoded ) ) {
			return $this->no_store( Cetech_Pos_Bridge_Response::from_wp_error( $encoded, $correlation ) );
		}
		return $this->no_store( Cetech_Pos_Bridge_Response::success( $result, $correlation ) );
	}

	/**
	 * @param object $request
	 * @return string
	 */
	private function transaction_id( $request ) {
		if ( is_object( $request ) && method_exists( $request, 'get_param' ) ) {
			$param = $request->get_param( 'transactionId' );
			if ( is_string( $param ) && $param !== '' ) {
				return $param;
			}
		}
		if ( is_array( $request ) && isset( $request['transactionId'] ) && is_string( $request['transactionId'] ) ) {
			return $request['transactionId'];
		}
		return '';
	}

	/**
	 * @param array<string,mixed> $payload
	 * @return true|WP_Error
	 */
	private function encode_payload( array $payload ) {
		$envelope = array(
			'ok'            => true,
			'data'          => $payload,
			'correlationId' => '',
		);
		$json = function_exists( 'wp_json_encode' ) ? wp_json_encode( $envelope ) : json_encode( $envelope );
		if ( ! is_string( $json ) || $json === '' ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'INTEGRATION_UNAVAILABLE',
				'SaleResolution could not be encoded as JSON.',
				true,
				'resolve',
				503
			);
		}
		return true;
	}

	private function no_store( $response ) {
		if ( is_object( $response ) && method_exists( $response, 'header' ) ) {
			$response->header( 'Cache-Control', 'no-store' );
		}
		return $response;
	}
}
