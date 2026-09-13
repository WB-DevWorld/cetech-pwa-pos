<?php

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/fake-wp/' );
}

$GLOBALS['cetech_pos_test_theme']          = null;
$GLOBALS['cetech_pos_registered_routes']   = array();

class WP_Error {
	public $code;
	public $message;
	public $data;

	public function __construct( $code, $message, $data = array() ) {
		$this->code    = $code;
		$this->message = $message;
		$this->data    = $data;
	}

	public function get_error_code() {
		return $this->code;
	}

	public function get_error_message() {
		return $this->message;
	}

	public function get_error_data() {
		return $this->data;
	}
}

class WP_REST_Response {
	public $data;
	public $status;
	public $headers = array();

	public function __construct( $data, $status = 200 ) {
		$this->data   = $data;
		$this->status = $status;
	}

	public function get_data() {
		return $this->data;
	}

	public function get_status() {
		return $this->status;
	}

	public function header( $name, $value ) {
		$this->headers[ $name ] = $value;
	}

	public function get_headers() {
		return $this->headers;
	}

	public function is_error() {
		return $this->status >= 400;
	}
}

class Cetech_Pos_Bridge_Test_Request {
	public $headers = array();
	public $route   = '/cetech-pos/v1/health';
	public $json    = array();

	public function __construct( array $headers = array(), $route = '/cetech-pos/v1/health', array $json = array() ) {
		foreach ( $headers as $name => $value ) {
			$this->headers[ strtolower( $name ) ] = $value;
		}
		$this->route = (string) $route;
		$this->json  = $json;
	}

	public function get_header( $name ) {
		$key = strtolower( $name );
		return isset( $this->headers[ $key ] ) ? $this->headers[ $key ] : '';
	}

	public function get_route() {
		return $this->route;
	}

	public function get_json_params() {
		return $this->json;
	}
}

class Cetech_Pos_Bridge_Test_Theme {
	public $stylesheet;
	public $template;
	public $parent_theme;

	public function __construct( $stylesheet, $template, $parent_theme = null ) {
		$this->stylesheet   = $stylesheet;
		$this->template     = $template;
		$this->parent_theme = $parent_theme;
	}

	public function get_stylesheet() {
		return $this->stylesheet;
	}

	public function get_template() {
		return $this->template;
	}

	public function parent() {
		return $this->parent_theme;
	}
}

function wp_get_theme() {
	return $GLOBALS['cetech_pos_test_theme'];
}

function register_rest_route( $namespace, $route, $args ) {
	$GLOBALS['cetech_pos_registered_routes'][] = array(
		'namespace' => $namespace,
		'route'     => $route,
		'args'      => $args,
	);
	return true;
}

function add_action( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
	return true;
}

function add_filter( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
	return true;
}

function is_wp_error( $thing ) {
	return $thing instanceof WP_Error;
}

$plugin_dir = dirname( __DIR__, 2 ) . '/wordpress/cetech-pos-bridge';
require_once $plugin_dir . '/includes/class-constants.php';
require_once $plugin_dir . '/includes/class-environment.php';
require_once $plugin_dir . '/includes/class-auth.php';
require_once $plugin_dir . '/includes/class-correlation.php';
require_once $plugin_dir . '/includes/class-detector.php';
require_once $plugin_dir . '/includes/class-response.php';
require_once $plugin_dir . '/includes/class-health-controller.php';
require_once $plugin_dir . '/includes/class-money.php';
require_once $plugin_dir . '/includes/class-ephemeral-session.php';
require_once $plugin_dir . '/includes/class-woo-runtime.php';
require_once $plugin_dir . '/includes/class-quote-request.php';
require_once $plugin_dir . '/includes/class-quote-store.php';
require_once $plugin_dir . '/includes/class-quote-engine.php';
require_once $plugin_dir . '/includes/class-quote-controller.php';
require_once $plugin_dir . '/includes/class-plugin.php';

class Cetech_Pos_Bridge_Test_Environment extends Cetech_Pos_Bridge_Environment {
	public $logged_in  = false;
	public $capability = null;
	public $woo        = false;
	public $woodmart   = false;
	public $b2bking    = false;
	public $use_theme  = false;
	public $mutations  = array();

	public function is_user_logged_in() {
		return (bool) $this->logged_in;
	}

	public function current_user_can( $capability ) {
		return $this->capability === $capability;
	}

	public function wc_available() {
		return (bool) $this->woo;
	}

	public function woodmart_available() {
		if ( $this->use_theme ) {
			return parent::woodmart_available();
		}
		return (bool) $this->woodmart;
	}

	public function b2bking_available() {
		return (bool) $this->b2bking;
	}

	public function record_mutation( $name ) {
		$this->mutations[] = $name;
	}
}

class Cetech_Pos_Bridge_Probe_Environment extends Cetech_Pos_Bridge_Environment {
	public $classes    = array();
	public $constants  = array();
	public $functions  = array();
	public $plugins    = array();

	public function class_exists( $class_name ) {
		return in_array( $class_name, $this->classes, true );
	}

	public function function_exists( $function_name ) {
		return in_array( $function_name, $this->functions, true );
	}

	public function defined_constant( $name ) {
		return in_array( $name, $this->constants, true );
	}

	public function is_plugin_active( $basename ) {
		return in_array( $basename, $this->plugins, true );
	}
}
