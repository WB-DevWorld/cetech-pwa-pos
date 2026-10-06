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
	/** @var callable|null */
	private $timing_factory;
	/** @var string */
	private $timing_class;
	/** @var callable|null */
	private $payload_encoder;
	/** @var callable|null */
	private $response_factory;

	/**
	 * Existing plugin wiring passes three arguments. Later arguments are
	 * test seams. A disabled gate never calls the timing factory.
	 *
	 * @param callable|null $timing_factory
	 * @param string        $timing_class
	 * @param callable|null $payload_encoder
	 * @param callable|null $response_factory
	 */
	public function __construct(
		Cetech_Pos_Bridge_Auth $auth,
		Cetech_Pos_Bridge_Correlation $correlation,
		Cetech_Pos_Bridge_Quote_Engine $engine,
		$timing_factory = null,
		$timing_class = 'Cetech_Pos_Bridge_Quote_Timing',
		$payload_encoder = null,
		$response_factory = null
	) {
		$this->auth             = $auth;
		$this->correlation      = $correlation;
		$this->engine           = $engine;
		$this->timing_factory   = is_callable( $timing_factory ) ? $timing_factory : null;
		$this->timing_class     = is_string( $timing_class ) && $timing_class !== ''
			? $timing_class
			: 'Cetech_Pos_Bridge_Quote_Timing';
		$this->payload_encoder  = is_callable( $payload_encoder ) ? $payload_encoder : null;
		$this->response_factory = is_callable( $response_factory ) ? $response_factory : null;
	}

	public function permission_callback( $request ) {
		unset( $request );
		return $this->auth->permission_callback();
	}

	public function handle( $request ) {
		$recorder = $this->open_timing();
		$accepted = false;
		$outcome  = 'incomplete';
		$aborted  = false;
		try {
			$correlation = $this->correlation->require_header( $request );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $correlation ) ) {
				return Cetech_Pos_Bridge_Response::from_wp_error( $correlation, Cetech_Pos_Bridge_Correlation::generate_uuid() );
			}
			if ( $recorder instanceof Cetech_Pos_Bridge_Quote_Timing && $recorder->select( $correlation ) ) {
				$accepted = true;
			} else {
				$recorder = null;
			}
			$body = array();
			if ( is_object( $request ) && method_exists( $request, 'get_json_params' ) ) {
				$params = $request->get_json_params();
				if ( is_array( $params ) ) {
					$body = $params;
				}
			}
			try {
				$result = $this->engine->quote( $body, $accepted ? $recorder : null );
			} catch ( \Throwable $e ) {
				$this->log_quote_abort( $e );
				$result  = Cetech_Pos_Bridge_Response::wp_error(
					'INTEGRATION_UNAVAILABLE',
					'Quote runtime aborted before returning a priced cart.',
					true,
					'resolve',
					503
				);
				$aborted = true;
			}
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $result ) ) {
				$response = $this->no_store( Cetech_Pos_Bridge_Response::from_wp_error( $result, $correlation ) );
				$outcome  = $aborted ? 'engine_aborted' : 'typed_error';
				return $response;
			}
			$encoded = $this->encode_quote_payload( $result, $correlation );
			if ( Cetech_Pos_Bridge_Quote_Request::is_error( $encoded ) ) {
				$response = $this->no_store( Cetech_Pos_Bridge_Response::from_wp_error( $encoded, $correlation ) );
				$outcome  = 'typed_error';
				return $response;
			}
			$response = $this->no_store( Cetech_Pos_Bridge_Response::success( $result, $correlation ) );
			$outcome  = 'success';
			return $response;
		} finally {
			if ( $accepted && $recorder instanceof Cetech_Pos_Bridge_Quote_Timing ) {
				$recorder->finish( $outcome );
			}
		}
	}

	/**
	 * Disabled gates return before any recorder, clock, counter, or log work.
	 *
	 * @return Cetech_Pos_Bridge_Quote_Timing|null
	 */
	private function open_timing() {
		$class = $this->timing_class;
		try {
			if ( $class !== 'Cetech_Pos_Bridge_Quote_Timing' && ! is_subclass_of( $class, 'Cetech_Pos_Bridge_Quote_Timing' ) ) {
				return null;
			}
			if ( ! $class::enabled() ) {
				return null;
			}
		} catch ( \Throwable $e ) {
			unset( $e );
			return null;
		}
		try {
			if ( $this->timing_factory !== null ) {
				$recorder = call_user_func( $this->timing_factory );
			} else {
				$recorder = new $class();
			}
		} catch ( \Throwable $e ) {
			unset( $e );
			return null;
		}
		if ( ! $recorder instanceof Cetech_Pos_Bridge_Quote_Timing ) {
			return null;
		}
		$recorder->begin_controller();
		return $recorder;
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
		if ( $this->payload_encoder !== null ) {
			$json = call_user_func( $this->payload_encoder, $payload );
		} else {
			$json = function_exists( 'wp_json_encode' ) ? wp_json_encode( $payload ) : json_encode( $payload );
		}
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
		if ( $this->response_factory !== null ) {
			return call_user_func( $this->response_factory, $response );
		}
		return $response;
	}
}
