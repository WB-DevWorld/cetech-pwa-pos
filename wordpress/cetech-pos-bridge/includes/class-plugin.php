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
	/** @var Cetech_Pos_Bridge_Prepare_Controller */
	private $prepare_controller;
	/** @var Cetech_Pos_Bridge_Resolve_Controller */
	private $resolve_controller;
	/** @var Cetech_Pos_Bridge_Finalize_Controller */
	private $finalize_controller;
	/** @var Cetech_Pos_Bridge_Cancel_Controller */
	private $cancel_controller;
	/** @var Cetech_Pos_Bridge_Commercial_Refund_Controller */
	private $commercial_refund_controller;
	/** @var Cetech_Pos_Bridge_Stock_Disposition_Controller */
	private $stock_disposition_controller;
	/** @var Cetech_Pos_Bridge_Catalog_Controller */
	private $catalog_controller;
	/** @var Cetech_Pos_Bridge_Customers_Controller */
	private $customers_controller;
	/** @var Cetech_Pos_Bridge_Prepare_Engine */
	private $prepare_engine;
	/** @var Cetech_Pos_Bridge_Command_Engine */
	private $command_engine;
	/** @var Cetech_Pos_Bridge_Return_Effect_Engine */
	private $return_effect_engine;
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
		$store                    = new Cetech_Pos_Bridge_Quote_Store();
		$quotes                   = new Cetech_Pos_Bridge_Quote_Engine( $runtime, $store );
		$this->quote_controller   = new Cetech_Pos_Bridge_Quote_Controller( $auth, $correlation, $quotes );
		$claims                   = new Cetech_Pos_Bridge_Claim_Store();
		$commands                 = new Cetech_Pos_Bridge_Command_Store();
		$this->prepare_engine     = new Cetech_Pos_Bridge_Prepare_Engine( $runtime, $quotes, $store, $claims, $commands );
		$this->command_engine     = new Cetech_Pos_Bridge_Command_Engine( $runtime, $claims, $commands );
		$this->prepare_controller = new Cetech_Pos_Bridge_Prepare_Controller( $auth, $correlation, $this->prepare_engine );
		$this->resolve_controller = new Cetech_Pos_Bridge_Resolve_Controller( $auth, $correlation, $this->prepare_engine );
		$this->finalize_controller = new Cetech_Pos_Bridge_Finalize_Controller( $auth, $correlation, $this->command_engine );
		$this->cancel_controller  = new Cetech_Pos_Bridge_Cancel_Controller( $auth, $correlation, $this->command_engine );
		$effects                  = new Cetech_Pos_Bridge_Return_Effect_Store();
		$this->return_effect_engine = new Cetech_Pos_Bridge_Return_Effect_Engine( $runtime, $store, $claims, $commands, $effects );
		$this->commercial_refund_controller = new Cetech_Pos_Bridge_Commercial_Refund_Controller( $auth, $correlation, $this->return_effect_engine );
		$this->stock_disposition_controller = new Cetech_Pos_Bridge_Stock_Disposition_Controller( $auth, $correlation, $this->return_effect_engine );
		$catalog_engine                     = new Cetech_Pos_Bridge_Catalog_Engine( Cetech_Pos_Bridge_Catalog_Engine::woo_loader() );
		$this->catalog_controller           = new Cetech_Pos_Bridge_Catalog_Controller( $auth, $correlation, $catalog_engine );
		$customers_engine                   = new Cetech_Pos_Bridge_Customers_Engine( Cetech_Pos_Bridge_Customers_Engine::woo_loader() );
		$this->customers_controller         = new Cetech_Pos_Bridge_Customers_Controller( $auth, $correlation, $customers_engine );
	}

	public function boot() {
		Cetech_Pos_Bridge_Schema_Install::maybe_upgrade();
		if ( function_exists( 'add_action' ) ) {
			add_action( 'rest_api_init', array( $this, 'register_routes' ) );
		}
		if ( function_exists( 'add_filter' ) ) {
			add_filter( 'rest_post_dispatch', array( $this, 'normalize_error_response' ), 10, 3 );
			add_filter( 'rest_pre_serve_request', array( $this, 'serve_namespace_json' ), PHP_INT_MAX, 4 );
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
		$prepare_args = array(
			'methods'             => 'POST',
			'callback'            => array( $this->prepare_controller, 'handle' ),
			'permission_callback' => array( $this->prepare_controller, 'permission_callback' ),
		);
		$resolve_args = array(
			'methods'             => 'GET',
			'callback'            => array( $this->resolve_controller, 'handle' ),
			'permission_callback' => array( $this->resolve_controller, 'permission_callback' ),
		);
		$finalize_args = array(
			'methods'             => 'POST',
			'callback'            => array( $this->finalize_controller, 'handle' ),
			'permission_callback' => array( $this->finalize_controller, 'permission_callback' ),
		);
		$cancel_args = array(
			'methods'             => 'POST',
			'callback'            => array( $this->cancel_controller, 'handle' ),
			'permission_callback' => array( $this->cancel_controller, 'permission_callback' ),
		);
		$commercial_args = array(
			'methods'             => 'POST',
			'callback'            => array( $this->commercial_refund_controller, 'handle' ),
			'permission_callback' => array( $this->commercial_refund_controller, 'permission_callback' ),
		);
		$commercial_resolve_args = array(
			'methods'             => 'GET',
			'callback'            => array( $this->commercial_refund_controller, 'handle_resolve' ),
			'permission_callback' => array( $this->commercial_refund_controller, 'permission_callback' ),
		);
		$stock_args = array(
			'methods'             => 'POST',
			'callback'            => array( $this->stock_disposition_controller, 'handle' ),
			'permission_callback' => array( $this->stock_disposition_controller, 'permission_callback' ),
		);
		$stock_resolve_args = array(
			'methods'             => 'GET',
			'callback'            => array( $this->stock_disposition_controller, 'handle_resolve' ),
			'permission_callback' => array( $this->stock_disposition_controller, 'permission_callback' ),
		);
		$catalog_args = array(
			'methods'             => 'GET',
			'callback'            => array( $this->catalog_controller, 'handle' ),
			'permission_callback' => array( $this->catalog_controller, 'permission_callback' ),
		);
		$customers_args = array(
			'methods'             => 'GET',
			'callback'            => array( $this->customers_controller, 'handle' ),
			'permission_callback' => array( $this->customers_controller, 'permission_callback' ),
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
		$this->registered_routes[] = array(
			'namespace' => Cetech_Pos_Bridge_Constants::NAMESPACE,
			'route'     => Cetech_Pos_Bridge_Constants::PREPARE_ROUTE,
			'args'      => $prepare_args,
		);
		$this->registered_routes[] = array(
			'namespace' => Cetech_Pos_Bridge_Constants::NAMESPACE,
			'route'     => Cetech_Pos_Bridge_Constants::RESOLVE_ROUTE,
			'args'      => $resolve_args,
		);
		$this->registered_routes[] = array(
			'namespace' => Cetech_Pos_Bridge_Constants::NAMESPACE,
			'route'     => Cetech_Pos_Bridge_Constants::FINALIZE_ROUTE,
			'args'      => $finalize_args,
		);
		$this->registered_routes[] = array(
			'namespace' => Cetech_Pos_Bridge_Constants::NAMESPACE,
			'route'     => Cetech_Pos_Bridge_Constants::CANCEL_ROUTE,
			'args'      => $cancel_args,
		);
		$this->registered_routes[] = array(
			'namespace' => Cetech_Pos_Bridge_Constants::NAMESPACE,
			'route'     => Cetech_Pos_Bridge_Constants::COMMERCIAL_REFUND_ROUTE,
			'args'      => $commercial_args,
		);
		$this->registered_routes[] = array(
			'namespace' => Cetech_Pos_Bridge_Constants::NAMESPACE,
			'route'     => Cetech_Pos_Bridge_Constants::COMMERCIAL_REFUND_RESOLVE_ROUTE,
			'args'      => $commercial_resolve_args,
		);
		$this->registered_routes[] = array(
			'namespace' => Cetech_Pos_Bridge_Constants::NAMESPACE,
			'route'     => Cetech_Pos_Bridge_Constants::STOCK_DISPOSITION_ROUTE,
			'args'      => $stock_args,
		);
		$this->registered_routes[] = array(
			'namespace' => Cetech_Pos_Bridge_Constants::NAMESPACE,
			'route'     => Cetech_Pos_Bridge_Constants::STOCK_DISPOSITION_RESOLVE_ROUTE,
			'args'      => $stock_resolve_args,
		);
		$this->registered_routes[] = array(
			'namespace' => Cetech_Pos_Bridge_Constants::NAMESPACE,
			'route'     => Cetech_Pos_Bridge_Constants::CATALOG_ROUTE,
			'args'      => $catalog_args,
		);
		$this->registered_routes[] = array(
			'namespace' => Cetech_Pos_Bridge_Constants::NAMESPACE,
			'route'     => Cetech_Pos_Bridge_Constants::CUSTOMERS_ROUTE,
			'args'      => $customers_args,
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
			register_rest_route(
				Cetech_Pos_Bridge_Constants::NAMESPACE,
				Cetech_Pos_Bridge_Constants::PREPARE_ROUTE,
				$prepare_args
			);
			register_rest_route(
				Cetech_Pos_Bridge_Constants::NAMESPACE,
				Cetech_Pos_Bridge_Constants::RESOLVE_ROUTE,
				$resolve_args
			);
			register_rest_route(
				Cetech_Pos_Bridge_Constants::NAMESPACE,
				Cetech_Pos_Bridge_Constants::FINALIZE_ROUTE,
				$finalize_args
			);
			register_rest_route(
				Cetech_Pos_Bridge_Constants::NAMESPACE,
				Cetech_Pos_Bridge_Constants::CANCEL_ROUTE,
				$cancel_args
			);
			register_rest_route(
				Cetech_Pos_Bridge_Constants::NAMESPACE,
				Cetech_Pos_Bridge_Constants::COMMERCIAL_REFUND_ROUTE,
				$commercial_args
			);
			register_rest_route(
				Cetech_Pos_Bridge_Constants::NAMESPACE,
				Cetech_Pos_Bridge_Constants::COMMERCIAL_REFUND_RESOLVE_ROUTE,
				$commercial_resolve_args
			);
			register_rest_route(
				Cetech_Pos_Bridge_Constants::NAMESPACE,
				Cetech_Pos_Bridge_Constants::STOCK_DISPOSITION_ROUTE,
				$stock_args
			);
			register_rest_route(
				Cetech_Pos_Bridge_Constants::NAMESPACE,
				Cetech_Pos_Bridge_Constants::STOCK_DISPOSITION_RESOLVE_ROUTE,
				$stock_resolve_args
			);
			register_rest_route(
				Cetech_Pos_Bridge_Constants::NAMESPACE,
				Cetech_Pos_Bridge_Constants::CATALOG_ROUTE,
				$catalog_args
			);
			register_rest_route(
				Cetech_Pos_Bridge_Constants::NAMESPACE,
				Cetech_Pos_Bridge_Constants::CUSTOMERS_ROUTE,
				$customers_args
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

	public function get_prepare_controller() {
		return $this->prepare_controller;
	}

	public function get_resolve_controller() {
		return $this->resolve_controller;
	}

	public function get_prepare_engine() {
		return $this->prepare_engine;
	}

	public function get_command_engine() {
		return $this->command_engine;
	}

	public function get_finalize_controller() {
		return $this->finalize_controller;
	}

	public function get_cancel_controller() {
		return $this->cancel_controller;
	}

	public function get_commercial_refund_controller() {
		return $this->commercial_refund_controller;
	}

	public function get_stock_disposition_controller() {
		return $this->stock_disposition_controller;
	}

	public function get_catalog_controller() {
		return $this->catalog_controller;
	}

	public function get_return_effect_engine() {
		return $this->return_effect_engine;
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
		if ( $this->is_bridge_envelope( $response ) ) {
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

	/**
	 * Serve this namespace's JSON body before WordPress's default REST echo.
	 * Isolated quotes can succeed and then an empty HTTP 500 happens while the
	 * storefront session is restored around REST output. This does not change
	 * the envelope; it only writes the already-normalized payload.
	 *
	 * @param bool                     $served
	 * @param mixed                    $result
	 * @param object                   $request
	 * @param mixed                    $server
	 * @return bool
	 */
	public function serve_namespace_json( $served, $result, $request, $server ) {
		unset( $server );
		if ( $served ) {
			return $served;
		}
		$route = '';
		if ( is_object( $request ) && method_exists( $request, 'get_route' ) ) {
			$route = (string) $request->get_route();
		}
		if ( strpos( $route, '/' . Cetech_Pos_Bridge_Constants::NAMESPACE ) !== 0 ) {
			return $served;
		}
		$data = null;
		if ( is_object( $result ) && method_exists( $result, 'get_data' ) ) {
			$data = $result->get_data();
		} elseif ( is_array( $result ) ) {
			$data = $result;
		}
		try {
			$json = function_exists( 'wp_json_encode' ) ? wp_json_encode( $data ) : json_encode( $data );
		} catch ( \Throwable $e ) {
			unset( $e );
			$json = false;
		}
		if ( ! is_string( $json ) || $json === '' ) {
			$json = '{"ok":false,"error":{"code":"INTEGRATION_UNAVAILABLE","message":"Quote runtime result could not be encoded as JSON.","retryable":true,"nextAction":"resolve"},"correlationId":""}';
			if ( function_exists( 'status_header' ) ) {
				status_header( 503 );
			}
		}
		echo $json;
		if ( function_exists( 'fastcgi_finish_request' ) ) {
			fastcgi_finish_request();
		}
		return true;
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

	/**
	 * WordPress rest_post_dispatch sees status>=400 as is_error() and as_error()
	 * looks for top-level code/message. Our frozen envelope uses ok/error/correlationId.
	 * Re-wrapping that object would wipe VALIDATION_ERROR/FORBIDDEN onto empty code.
	 *
	 * @param mixed $response
	 * @return bool
	 */
	private function is_bridge_envelope( $response ) {
		$data = null;
		if ( is_object( $response ) && method_exists( $response, 'get_data' ) ) {
			$data = $response->get_data();
		} elseif ( is_array( $response ) ) {
			$data = $response;
		}
		return is_array( $data )
			&& array_key_exists( 'ok', $data )
			&& array_key_exists( 'correlationId', $data )
			&& ( array_key_exists( 'error', $data ) || array_key_exists( 'data', $data ) );
	}

	private function controller_correlation_or_generated( $request ) {
		$result = ( new Cetech_Pos_Bridge_Correlation() )->require_header( $request );
		if ( is_string( $result ) ) {
			return $result;
		}
		return Cetech_Pos_Bridge_Correlation::generate_uuid();
	}
}
