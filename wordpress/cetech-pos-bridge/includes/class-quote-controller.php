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
		try {
			$result = $this->engine->quote( $body );
		} catch ( \Throwable $e ) {
			$this->log_quote_abort( $e );
			$result = Cetech_Pos_Bridge_Response::wp_error(
				'INTEGRATION_UNAVAILABLE',
				'Quote runtime aborted before returning a priced cart.',
				true,
				'resolve',
				503
			);
		}
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $result ) ) {
			$response = Cetech_Pos_Bridge_Response::from_wp_error( $result, $correlation );
			return $this->no_store( $response );
		}
		$encoded = $this->encode_quote_payload( $result, $correlation );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $encoded ) ) {
			$response = Cetech_Pos_Bridge_Response::from_wp_error( $encoded, $correlation );
			return $this->no_store( $response );
		}
		return $this->no_store( Cetech_Pos_Bridge_Response::success( $result, $correlation ) );
	}

	/**
	 * HTTP serving json_encodes the Quote. rest_do_request does not. Fail closed
	 * here so an unencodable runtime string cannot become an empty HTTP 500.
	 *
	 * @param array<string,mixed> $quote
	 * @param string              $correlation
	 * @return true|WP_Error
	 */
	private function encode_quote_payload( array $quote, $correlation ) {
		unset( $correlation );
		$payload = array(
			'ok'            => true,
			'data'          => $quote,
			'correlationId' => '',
		);
		$json = function_exists( 'wp_json_encode' ) ? wp_json_encode( $payload ) : json_encode( $payload );
		if ( ! is_string( $json ) || $json === '' ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'INTEGRATION_UNAVAILABLE',
				'Quote runtime result could not be encoded as JSON.',
				true,
				'resolve',
				503
			);
		}
		return true;
	}

	/**
	 * @param \Throwable $e
	 */
	private function log_quote_abort( $e ) {
		$file = str_replace( '\\', '/', $e->getFile() );
		$mark = '/wp-content/';
		$pos  = strpos( $file, $mark );
		$shown = ( $pos === false ) ? basename( $file ) : substr( $file, $pos );
		$line  = 'cetech-pos-bridge quote aborted: ' . get_class( $e ) . ' @ ' . $shown . ':' . $e->getLine();
		if ( function_exists( 'error_log' ) ) {
			error_log( $line );
		}
	}

	private function no_store( $response ) {
		if ( is_object( $response ) && method_exists( $response, 'header' ) ) {
			$response->header( 'Cache-Control', 'no-store' );
		}
		return $response;
	}
}
