<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Cetech_Pos_Bridge_Stock_Disposition_Controller {
	/** @var Cetech_Pos_Bridge_Auth */
	private $auth;
	/** @var Cetech_Pos_Bridge_Correlation */
	private $correlation;
	/** @var Cetech_Pos_Bridge_Return_Effect_Engine */
	private $engine;

	public function __construct(
		Cetech_Pos_Bridge_Auth $auth,
		Cetech_Pos_Bridge_Correlation $correlation,
		Cetech_Pos_Bridge_Return_Effect_Engine $engine
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
		$key = $this->idempotency_key( $request );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $key ) ) {
			return $this->no_store( Cetech_Pos_Bridge_Response::from_wp_error( $key, $correlation ) );
		}
		$body = array();
		if ( is_object( $request ) && method_exists( $request, 'get_json_params' ) ) {
			$params = $request->get_json_params();
			if ( is_array( $params ) ) {
				$body = $params;
			}
		}
		try {
			$result = $this->engine->apply_stock_disposition( $body, $key );
		} catch ( \Throwable $e ) {
			$this->log_abort( $e );
			$result = Cetech_Pos_Bridge_Response::wp_error(
				'INTEGRATION_UNAVAILABLE',
				'Stock disposition runtime aborted before returning a state.',
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

	public function handle_resolve( $request ) {
		$correlation = $this->correlation->require_header( $request );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $correlation ) ) {
			return Cetech_Pos_Bridge_Response::from_wp_error( $correlation, Cetech_Pos_Bridge_Correlation::generate_uuid() );
		}
		$id = '';
		if ( is_object( $request ) && method_exists( $request, 'get_param' ) ) {
			$param = $request->get_param( 'stockDispositionId' );
			if ( is_string( $param ) ) {
				$id = $param;
			}
		}
		try {
			$result = $this->engine->resolve_stock_disposition( $id );
		} catch ( \Throwable $e ) {
			unset( $e );
			$result = Cetech_Pos_Bridge_Response::wp_error(
				'INTEGRATION_UNAVAILABLE',
				'Stock disposition resolve aborted before returning a state.',
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

	private function idempotency_key( $request ) {
		$header = '';
		if ( is_object( $request ) && method_exists( $request, 'get_header' ) ) {
			$header = (string) $request->get_header( 'Idempotency-Key' );
			if ( $header === '' ) {
				$header = (string) $request->get_header( 'idempotency-key' );
			}
		}
		$header = trim( $header );
		if ( $header !== '' && Cetech_Pos_Bridge_Quote_Request::is_uuid( $header ) ) {
			return $header;
		}
		return Cetech_Pos_Bridge_Response::wp_error(
			'VALIDATION_ERROR',
			'Idempotency-Key must be a contract UUID.',
			false,
			'none',
			400,
			array( 'field' => 'Idempotency-Key' )
		);
	}

	private function encode_payload( array $payload ) {
		$violation = Cetech_Pos_Bridge_Schema::instance()->validate( $payload, 'BridgeStockDispositionState' );
		if ( $violation !== null ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'INTEGRATION_UNAVAILABLE',
				'Stock-disposition state could not be encoded against the frozen contract.',
				true,
				'resolve',
				503
			);
		}
		$envelope = array(
			'ok'            => true,
			'data'          => $payload,
			'correlationId' => '',
		);
		$json = function_exists( 'wp_json_encode' ) ? wp_json_encode( $envelope ) : json_encode( $envelope );
		if ( ! is_string( $json ) || $json === '' ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'INTEGRATION_UNAVAILABLE',
				'Stock-disposition state could not be encoded as JSON.',
				true,
				'resolve',
				503
			);
		}
		return true;
	}

	private function log_abort( $e ) {
		$file  = str_replace( '\\', '/', $e->getFile() );
		$mark  = '/wp-content/';
		$pos   = strpos( $file, $mark );
		$shown = ( $pos === false ) ? basename( $file ) : substr( $file, $pos );
		$line  = 'cetech-pos-bridge stock-disposition aborted: ' . get_class( $e ) . ' @ ' . $shown . ':' . $e->getLine();
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
