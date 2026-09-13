<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Cetech_Pos_Bridge_Plugin {
	/** @var self|null */
	private static $instance = null;
	/** @var Cetech_Pos_Bridge_Health_Controller */
	private $controller;
	/** @var Cetech_Pos_Bridge_Quote_Controller */
	private $quote_controller;
	/** @var array<int,array<string,mixed>> */
	private $registered_routes = array();

	public static function instance() {
		if ( self::$instance === null ) {
			self::$instance = new self( new Cetech_Pos_Bridge_Environment() );
		}
		return self::$instance;
	}

	public function __construct( Cetech_Pos_Bridge_Environment $environment, $runtime = null ) {
		$auth             = new Cetech_Pos_Bridge_Auth( $environment );
		$correlation      = new Cetech_Pos_Bridge_Correlation();
		$detector         = new Cetech_Pos_Bridge_Detector( $environment );
		$this->controller = new Cetech_Pos_Bridge_Health_Controller( $auth, $correlation, $detector );
		if ( ! $runtime instanceof Cetech_Pos_Bridge_Woo_Runtime ) {
			$runtime = new Cetech_Pos_Bridge_Woo_Runtime( $environment );
		}
		$store                  = new Cetech_Pos_Bridge_Quote_Store();
		$engine                 = new Cetech_Pos_Bridge_Quote_Engine( $runtime, $store );
		$this->quote_controller = new Cetech_Pos_Bridge_Quote_Controller( $auth, $correlation, $engine );
	}

	public function boot() {
		if ( function_exists( 'add_action' ) ) {
			add_action( 'rest_api_init', array( $this, 'register_routes' ) );
		}
		if ( function_exists( 'add_filter' ) ) {
			add_filter( 'rest_post_dispatch', array( $this, 'normalize_error_response' ), 10, 3 );
		}
	}

	public function register_routes() {
		$health_args = array(
			'methods'             => 'GET',
			'callback'            => array( $this->controller, 'handle' ),
			'permission_callback' => array( $this->controller, 'permission_callback' ),
		);
		$quote_args  = array(
			'methods'             => 'POST',
			'callback'            => array( $this->quote_controller, 'handle' ),
			'permission_callback' => array( $this->quote_controller, 'permission_callback' ),
		);
		$this->registered_routes[] = array(
			'namespace' => Cetech_Pos_Bridge_Constants::NAMESPACE,
			'route'     => Cetech_Pos_Bridge_Constants::HEALTH_ROUTE,
			'args'      => $health_args,
		);
		$this->registered_routes[] = array(
			'namespace' => Cetech_Pos_Bridge_Constants::NAMESPACE,
			'route'     => Cetech_Pos_Bridge_Constants::QUOTE_ROUTE,
			'args'      => $quote_args,
		);
		if ( function_exists( 'register_rest_route' ) ) {
			register_rest_route(
				Cetech_Pos_Bridge_Constants::NAMESPACE,
				Cetech_Pos_Bridge_Constants::HEALTH_ROUTE,
				$health_args
			);
			register_rest_route(
				Cetech_Pos_Bridge_Constants::NAMESPACE,
				Cetech_Pos_Bridge_Constants::QUOTE_ROUTE,
				$quote_args
			);
		}
	}

	public function get_registered_routes() {
		return $this->registered_routes;
	}

	public function get_controller() {
		return $this->controller;
	}

	public function get_quote_controller() {
		return $this->quote_controller;
	}

	/**
	 * Rewrite WordPress REST errors for this namespace into the frozen ApiFailure envelope.
	 * Does not add CORS headers or privileged public access.
	 */
	public function normalize_error_response( $response, $server, $request ) {
		unset( $server );
		$route = '';
		if ( is_object( $request ) && method_exists( $request, 'get_route' ) ) {
			$route = (string) $request->get_route();
		}
		if ( strpos( $route, '/' . Cetech_Pos_Bridge_Constants::NAMESPACE ) !== 0 ) {
			return $response;
		}
		$error = null;
		if ( function_exists( 'is_wp_error' ) && is_wp_error( $response ) ) {
			$error = $response;
		} elseif ( is_object( $response ) && method_exists( $response, 'is_error' ) && $response->is_error() && method_exists( $response, 'as_error' ) ) {
			$error = $response->as_error();
		}
		if ( $error === null ) {
			return $response;
		}
		$correlation = $this->resolve_correlation_for_error( $request, $error );
		return Cetech_Pos_Bridge_Response::from_wp_error( $error, $correlation );
	}

	private function resolve_correlation_for_error( $request, $error ) {
		$data = array();
		if ( is_object( $error ) && method_exists( $error, 'get_error_data' ) ) {
			$data = (array) $error->get_error_data();
		}
		if ( isset( $data['correlationId'] ) && is_string( $data['correlationId'] ) && $data['correlationId'] !== '' ) {
			return $data['correlationId'];
		}
		$header = $this->controller_correlation_or_generated( $request );
		return $header;
	}

	private function controller_correlation_or_generated( $request ) {
		$result = ( new Cetech_Pos_Bridge_Correlation() )->require_header( $request );
		if ( is_string( $result ) ) {
			return $result;
		}
		return Cetech_Pos_Bridge_Correlation::generate_uuid();
	}
}
