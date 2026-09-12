<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Cetech_Pos_Bridge_Response {
	const POLICY = array(
		'VALIDATION_ERROR'        => array( 400, false, 'none' ),
		'AUTH_REQUIRED'           => array( 401, false, 'reauthenticate' ),
		'FORBIDDEN'               => array( 403, false, 'none' ),
		'NOT_FOUND'               => array( 404, false, 'none' ),
		'INTEGRATION_UNAVAILABLE' => array( 503, true, 'resolve' ),
	);

	public static function success( array $data, $correlation_id ) {
		$payload = array(
			'ok'            => true,
			'data'          => $data,
			'correlationId' => (string) $correlation_id,
		);
		if ( class_exists( 'WP_REST_Response' ) ) {
			return new WP_REST_Response( $payload, 200 );
		}
		return $payload;
	}

	public static function failure( $code, $message, $correlation_id, $details = null ) {
		$policy = isset( self::POLICY[ $code ] ) ? self::POLICY[ $code ] : self::POLICY['VALIDATION_ERROR'];
		$error  = array(
			'code'       => $code,
			'message'    => $message,
			'retryable'  => $policy[1],
			'nextAction' => $policy[2],
		);
		if ( is_array( $details ) && $details !== array() ) {
			$error['details'] = self::sanitize_details( $details );
		}
		$payload = array(
			'ok'            => false,
			'error'         => $error,
			'correlationId' => (string) $correlation_id,
		);
		if ( class_exists( 'WP_REST_Response' ) ) {
			return new WP_REST_Response( $payload, $policy[0] );
		}
		$payload['_httpStatus'] = $policy[0];
		return $payload;
	}

	public static function wp_error( $code, $message, $retryable, $next_action, $status, $details = null, $correlation_id = null ) {
		$data = array(
			'status'        => $status,
			'cetech_pos'    => true,
			'code'          => $code,
			'message'       => $message,
			'retryable'     => $retryable,
			'nextAction'    => $next_action,
			'correlationId' => $correlation_id,
		);
		if ( is_array( $details ) ) {
			$data['details'] = self::sanitize_details( $details );
		}
		if ( class_exists( 'WP_Error' ) ) {
			return new WP_Error( $code, $message, $data );
		}
		return (object) array(
			'is_wp_error' => true,
			'code'        => $code,
			'message'     => $message,
			'data'        => $data,
		);
	}

	public static function from_wp_error( $error, $fallback_correlation_id ) {
		$data    = array();
		$code    = 'VALIDATION_ERROR';
		$message = 'Request failed.';
		if ( is_object( $error ) && method_exists( $error, 'get_error_data' ) ) {
			$data    = (array) $error->get_error_data();
			$code    = $error->get_error_code();
			$message = $error->get_error_message();
		} elseif ( is_object( $error ) && ! empty( $error->is_wp_error ) ) {
			$data    = (array) $error->data;
			$code    = $error->code;
			$message = $error->message;
		}
		$correlation = isset( $data['correlationId'] ) && is_string( $data['correlationId'] ) && $data['correlationId'] !== ''
			? $data['correlationId']
			: $fallback_correlation_id;
		$details = isset( $data['details'] ) && is_array( $data['details'] ) ? $data['details'] : null;
		return self::failure( $code, $message, $correlation, $details );
	}

	public static function sanitize_details( array $details ) {
		$allowed = array();
		if ( isset( $details['field'] ) && is_string( $details['field'] ) ) {
			$allowed['field'] = $details['field'];
		}
		if ( isset( $details['operationId'] ) && is_string( $details['operationId'] ) ) {
			$allowed['operationId'] = $details['operationId'];
		}
		if ( isset( $details['currentQuoteId'] ) && is_string( $details['currentQuoteId'] ) ) {
			$allowed['currentQuoteId'] = $details['currentQuoteId'];
		}
		return $allowed;
	}

	public static function extract_payload( $response ) {
		if ( is_object( $response ) && method_exists( $response, 'get_data' ) ) {
			return $response->get_data();
		}
		if ( is_array( $response ) ) {
			unset( $response['_httpStatus'] );
			return $response;
		}
		return array();
	}

	public static function extract_status( $response ) {
		if ( is_object( $response ) && method_exists( $response, 'get_status' ) ) {
			return (int) $response->get_status();
		}
		if ( is_array( $response ) && isset( $response['_httpStatus'] ) ) {
			return (int) $response['_httpStatus'];
		}
		return 200;
	}
}
