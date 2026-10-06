<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Request-local quote diagnostics. Default off.
 *
 * A recorder exists only for the controller invocation that constructs it.
 * It is not static, not stored on the engine, and not enabled by a browser
 * header or query parameter. Clock, counter, encoder, and sink failures stay
 * inside this object.
 */
class Cetech_Pos_Bridge_Quote_Timing {
	const EVENT           = 'cetech_pos_quote_timing';
	const VERSION         = 1;
	const MAX_EVENT_BYTES = 2048;

	/** @var callable|null */
	private $clock;
	/** @var callable|null */
	private $counter;
	/** @var callable|null */
	private $sink;
	/** @var callable|null */
	private $encoder;
	/** @var bool */
	private $accepted = false;
	/** @var bool */
	private $finished = false;
	/** @var string|null */
	private $open = null;
	/** @var int|float|null */
	private $open_clock = null;
	/** @var int|null */
	private $open_queries = null;
	/** @var int|float|null */
	private $controller_clock = null;
	/** @var int|null */
	private $controller_queries = null;
	/** @var array<string,int|float> */
	private $phases = array();
	/** @var array<string,int> */
	private $query_deltas = array();
	/** @var int|float|null */
	private $controller_ms = null;
	/** @var int|null */
	private $controller_query_delta = null;
	/** @var string */
	private $correlation = '';

	/**
	 * @param callable|null $clock
	 * @param callable|null $counter
	 * @param callable|null $sink
	 * @param callable|null $encoder
	 */
	public function __construct( $clock = null, $counter = null, $sink = null, $encoder = null ) {
		$this->clock   = is_callable( $clock ) ? $clock : null;
		$this->counter = is_callable( $counter ) ? $counter : null;
		$this->sink    = is_callable( $sink ) ? $sink : null;
		$this->encoder = is_callable( $encoder ) ? $encoder : null;
	}

	/**
	 * True only when both server constants select one valid correlation.
	 * Does not read the clock, the query counter, or the log.
	 *
	 * @return bool
	 */
	public static function enabled() {
		if ( ! defined( 'CETECH_POS_QUOTE_TIMING_ENABLED' ) || CETECH_POS_QUOTE_TIMING_ENABLED !== true ) {
			return false;
		}
		return self::is_valid_correlation( self::configured_correlation() );
	}

	/**
	 * @return string
	 */
	public static function configured_correlation() {
		if ( ! defined( 'CETECH_POS_QUOTE_TIMING_CORRELATION_ID' ) ) {
			return '';
		}
		$id = CETECH_POS_QUOTE_TIMING_CORRELATION_ID;
		return is_string( $id ) ? $id : '';
	}

	/**
	 * @param mixed $value
	 * @return bool
	 */
	public static function is_valid_correlation( $value ) {
		return is_string( $value ) && preg_match( Cetech_Pos_Bridge_Constants::UUID_PATTERN, $value ) === 1;
	}

	/**
	 * @return string
	 */
	public function selected_correlation() {
		return static::configured_correlation();
	}

	/**
	 * Sample the controller interval. Safe to call before correlation matching.
	 */
	public function begin_controller() {
		try {
			$this->controller_clock   = $this->read_clock();
			$this->controller_queries = $this->read_queries();
		} catch ( \Throwable $e ) {
			unset( $e );
			$this->controller_clock   = null;
			$this->controller_queries = null;
		}
	}

	/**
	 * Accept only the one configured UUID. A mismatch discards the request
	 * and does not retain the raw header.
	 *
	 * @param mixed $correlation
	 * @return bool
	 */
	public function select( $correlation ) {
		try {
			$selected = $this->selected_correlation();
			if ( ! self::is_valid_correlation( $correlation ) || ! self::is_valid_correlation( $selected ) ) {
				$this->accepted    = false;
				$this->correlation = '';
				return false;
			}
			if ( strlen( $correlation ) !== strlen( $selected ) || ! hash_equals( $selected, $correlation ) ) {
				$this->accepted    = false;
				$this->correlation = '';
				return false;
			}
			$this->accepted    = true;
			$this->correlation = $selected;
			return true;
		} catch ( \Throwable $e ) {
			unset( $e );
			$this->accepted    = false;
			$this->correlation = '';
			return false;
		}
	}

	/**
	 * @param string $phase
	 */
	public function begin( $phase ) {
		try {
			if ( ! $this->accepted || ! is_string( $phase ) ) {
				return;
			}
			$this->close_open();
			$this->open         = $phase;
			$this->open_clock   = $this->read_clock();
			$this->open_queries = $this->read_queries();
		} catch ( \Throwable $e ) {
			unset( $e );
			$this->open = null;
		}
	}

	public function close_open() {
		try {
			if ( $this->open === null ) {
				return;
			}
			$phase              = $this->open;
			$start              = $this->open_clock;
			$start_queries      = $this->open_queries;
			$this->open         = null;
			$this->open_clock   = null;
			$this->open_queries = null;
			$elapsed            = $this->elapsed_ms( $start, $this->read_clock() );
			if ( $elapsed !== null ) {
				$this->phases[ $phase ] = $elapsed;
			}
			$delta = $this->query_delta( $start_queries, $this->read_queries() );
			if ( $delta !== null ) {
				$this->query_deltas[ $phase ] = $delta;
			}
		} catch ( \Throwable $e ) {
			unset( $e );
			$this->open = null;
		}
	}

	/**
	 * Emit at most one event. A second call is a no-op for this recorder.
	 *
	 * @param string $outcome
	 */
	public function finish( $outcome ) {
		if ( $this->finished ) {
			return;
		}
		$this->finished = true;
		if ( ! $this->accepted ) {
			return;
		}
		try {
			$this->close_open();
			$this->controller_ms = $this->elapsed_ms( $this->controller_clock, $this->read_clock() );
			$this->controller_query_delta = $this->query_delta( $this->controller_queries, $this->read_queries() );
			$payload = $this->payload( $outcome );
			$json    = $this->encode_payload( $payload );
			if ( ! is_string( $json ) || $json === '' || strlen( $json ) > self::MAX_EVENT_BYTES ) {
				return;
			}
			$decoded = json_decode( $json, true );
			if ( ! is_array( $decoded ) || ! $this->allowlisted( $decoded ) ) {
				return;
			}
			$this->write( $json );
		} catch ( \Throwable $e ) {
			unset( $e );
		}
	}

	/**
	 * @param mixed $outcome
	 * @return array<string,mixed>
	 */
	private function payload( $outcome ) {
		$event = array(
			'event'         => self::EVENT,
			'version'       => self::VERSION,
			'correlationId' => $this->correlation,
			'outcome'       => $this->outcome( $outcome ),
		);
		$this->put_ms( $event, 'controller_ms', $this->controller_ms );
		foreach ( array( 'context', 'pricing', 'result', 'restore' ) as $phase ) {
			if ( array_key_exists( $phase, $this->phases ) ) {
				$this->put_ms( $event, $phase . '_ms', $this->phases[ $phase ] );
			}
		}
		if ( $this->controller_query_delta !== null ) {
			$event['controller_query_delta'] = $this->controller_query_delta;
		}
		foreach ( array( 'context', 'pricing', 'result', 'restore' ) as $phase ) {
			if ( array_key_exists( $phase, $this->query_deltas ) ) {
				$event[ $phase . '_query_delta' ] = $this->query_deltas[ $phase ];
			}
		}
		return $event;
	}

	/**
	 * @param array<string,mixed> $event
	 * @param string              $key
	 * @param mixed               $value
	 */
	private function put_ms( array &$event, $key, $value ) {
		if ( self::is_nonnegative_number( $value ) ) {
			$event[ $key ] = $value + 0;
		}
	}

	/**
	 * @param mixed $outcome
	 * @return string
	 */
	private function outcome( $outcome ) {
		if ( $outcome === 'success' || $outcome === 'typed_error' || $outcome === 'engine_aborted' || $outcome === 'incomplete' ) {
			return $outcome;
		}
		return 'incomplete';
	}

	/**
	 * @param array<string,mixed> $payload
	 * @return string|null
	 */
	private function encode_payload( array $payload ) {
		try {
			if ( $this->encoder !== null ) {
				$json = call_user_func( $this->encoder, $payload );
			} else {
				$json = json_encode( $payload );
			}
		} catch ( \Throwable $e ) {
			unset( $e );
			return null;
		}
		return is_string( $json ) ? $json : null;
	}

	/**
	 * @param array<string,mixed> $decoded
	 * @return bool
	 */
	private function allowlisted( array $decoded ) {
		$allowed = array(
			'event'                   => true,
			'version'                 => true,
			'correlationId'           => true,
			'outcome'                 => true,
			'controller_ms'           => true,
			'context_ms'              => true,
			'pricing_ms'              => true,
			'result_ms'               => true,
			'restore_ms'              => true,
			'controller_query_delta'  => true,
			'context_query_delta'     => true,
			'pricing_query_delta'     => true,
			'result_query_delta'      => true,
			'restore_query_delta'     => true,
		);
		foreach ( $decoded as $key => $value ) {
			if ( ! isset( $allowed[ $key ] ) ) {
				return false;
			}
		}
		if ( ( $decoded['event'] ?? null ) !== self::EVENT || ( $decoded['version'] ?? null ) !== self::VERSION ) {
			return false;
		}
		if ( ! self::is_valid_correlation( $decoded['correlationId'] ?? null ) ) {
			return false;
		}
		if ( ! in_array( $decoded['outcome'] ?? null, array( 'success', 'typed_error', 'engine_aborted', 'incomplete' ), true ) ) {
			return false;
		}
		foreach ( $decoded as $key => $value ) {
			if ( substr( (string) $key, -3 ) === '_ms' && ! self::is_nonnegative_number( $value ) ) {
				return false;
			}
			if ( substr( (string) $key, -12 ) === '_query_delta' && ( ! is_int( $value ) || $value < 0 ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * @param string $json
	 */
	private function write( $json ) {
		if ( $this->sink !== null ) {
			call_user_func( $this->sink, $json );
			return;
		}
		error_log( $json );
	}

	/**
	 * @return int|float|null
	 */
	private function read_clock() {
		try {
			if ( $this->clock !== null ) {
				$value = call_user_func( $this->clock );
			} elseif ( function_exists( 'hrtime' ) ) {
				$value = hrtime( true );
			} else {
				return null;
			}
		} catch ( \Throwable $e ) {
			unset( $e );
			return null;
		}
		if ( is_int( $value ) && $value >= 0 ) {
			return $value;
		}
		if ( is_float( $value ) && is_finite( $value ) && $value >= 0 ) {
			return $value;
		}
		return null;
	}

	/**
	 * @return int|null
	 */
	private function read_queries() {
		try {
			if ( $this->counter !== null ) {
				$value = call_user_func( $this->counter );
			} elseif ( function_exists( 'get_num_queries' ) ) {
				$value = get_num_queries();
			} else {
				return null;
			}
		} catch ( \Throwable $e ) {
			unset( $e );
			return null;
		}
		if ( is_int( $value ) && $value >= 0 ) {
			return $value;
		}
		return null;
	}

	/**
	 * @param mixed $start
	 * @param mixed $end
	 * @return int|float|null
	 */
	private function elapsed_ms( $start, $end ) {
		if ( ! self::is_nonnegative_number( $start ) || ! self::is_nonnegative_number( $end ) || $end < $start ) {
			return null;
		}
		$ms = ( $end - $start ) / 1000000;
		if ( ! self::is_nonnegative_number( $ms ) ) {
			return null;
		}
		return $ms;
	}

	/**
	 * @param mixed $start
	 * @param mixed $end
	 * @return int|null
	 */
	private function query_delta( $start, $end ) {
		if ( ! is_int( $start ) || ! is_int( $end ) || $end < $start ) {
			return null;
		}
		return $end - $start;
	}

	/**
	 * @param mixed $value
	 * @return bool
	 */
	private static function is_nonnegative_number( $value ) {
		if ( is_int( $value ) ) {
			return $value >= 0;
		}
		return is_float( $value ) && is_finite( $value ) && $value >= 0;
	}
}
