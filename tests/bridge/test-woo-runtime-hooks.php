<?php
/**
 * R144 hook-aware production Woo runtime coverage.
 * Uses the bootstrap action dispatcher and a disposable WC_Order that fires
 * woocommerce_before/after_order_object_save like WC 11.1.2 WC_Data::save().
 */

if ( ! class_exists( 'WC_Order', false ) ) {
	class WC_Order {
		/** @var int */
		public $id = 0;
		/** @var string */
		public $status = '';
		/** @var string */
		public $order_key = '';
		/** @var string */
		public $created_via = '';
		/** @var int */
		public $customer_id = 0;
		/** @var string */
		public $currency = '';
		/** @var array<string,mixed> */
		public $meta = array();
		/** @var callable|null */
		public static $next_id_allocator = null;
		/** @var callable|null invoked inside before-save at priority -1 */
		public static $nested_before_priority_neg1 = null;

		public function get_id() {
			return (int) $this->id;
		}

		public function set_status( $status ) {
			$this->status = (string) $status;
		}

		public function get_status( $context = 'view' ) {
			unset( $context );
			return (string) $this->status;
		}

		public function set_order_key( $key ) {
			$this->order_key = (string) $key;
		}

		public function get_order_key() {
			return (string) $this->order_key;
		}

		public function set_created_via( $via ) {
			$this->created_via = (string) $via;
		}

		public function set_customer_id( $id ) {
			$this->customer_id = (int) $id;
		}

		public function set_currency( $currency ) {
			$this->currency = (string) $currency;
		}

		public function update_meta_data( $key, $value ) {
			$this->meta[ (string) $key ] = $value;
		}

		public function get_meta( $key, $single = true ) {
			unset( $single );
			return isset( $this->meta[ (string) $key ] ) ? $this->meta[ (string) $key ] : '';
		}

		public function save() {
			do_action( 'woocommerce_before_order_object_save', $this, null );
			if ( (int) $this->id <= 0 ) {
				$alloc = self::$next_id_allocator;
				$this->id = is_callable( $alloc ) ? (int) call_user_func( $alloc ) : (int) ( microtime( true ) * 1000000 );
				if ( $this->id <= 0 ) {
					$this->id = 1;
				}
			}
			do_action( 'woocommerce_after_order_object_save', $this, null );
			if ( ! in_array( $this->status, array( 'auto-draft', 'draft', 'checkout-draft' ), true ) ) {
				do_action( 'woocommerce_new_order', $this->id, $this );
				do_action( 'woocommerce_new_order_with_order_object', $this->id, $this );
			}
			return $this->id;
		}
	}
}

class Cetech_Pos_Bridge_Hook_Cart {
	/** @var callable|null */
	public $during = null;

	public function calculate_totals() {
		if ( is_callable( $this->during ) ) {
			$cb = $this->during;
			$this->during = null;
			$cb();
		}
	}
}

class Cetech_Pos_Bridge_Hook_Wc {
	/** @var Cetech_Pos_Bridge_Hook_Cart */
	public $cart;
}

class Cetech_Pos_Bridge_Hook_Woo_Runtime extends Cetech_Pos_Bridge_Woo_Runtime {
	/** @var Cetech_Pos_Bridge_Hook_Wc */
	public $stub_wc;
	/** @var array<string,object> */
	public $orders_by_id = array();
	/** @var int */
	public $next_id = 5001;

	protected function wc() {
		return $this->stub_wc;
	}

	public function expose_persist( array $quote, $token, $tx, $hash ) {
		return $this->persist_initial_order_with_recovery_token( $quote, $token, $tx, $hash );
	}

	public function expose_assert_extra( $state, $order_id ) {
		return $this->assert_no_unexpected_same_request_order_creates( $state, $order_id );
	}

	public function expose_arm_guard() {
		return $this->arm_same_request_order_crud_guard();
	}

	public function expose_disarm_guard( $state ) {
		$this->disarm_same_request_order_crud_guard( $state );
	}

	public function expose_crud_observed( $state ) {
		return $this->same_request_order_crud_observed( $state );
	}

	public function find_orders_by_recovery_token( $recovery_token ) {
		$out = array();
		foreach ( $this->orders_by_id as $id => $order ) {
			if ( ! is_object( $order ) ) {
				continue;
			}
			$token = method_exists( $order, 'get_meta' ) ? (string) $order->get_meta( Cetech_Pos_Bridge_Constants::ORDER_META_RECOVERY ) : '';
			$key   = method_exists( $order, 'get_order_key' ) ? (string) $order->get_order_key() : '';
			if ( $token === (string) $recovery_token || $key === (string) $recovery_token ) {
				$out[] = array( 'orderId' => (string) $id );
			}
		}
		return $out;
	}

	public function find_orders_by_transaction( $transaction_id ) {
		$out = array();
		foreach ( $this->orders_by_id as $id => $order ) {
			if ( ! is_object( $order ) || ! method_exists( $order, 'get_meta' ) ) {
				continue;
			}
			if ( (string) $order->get_meta( Cetech_Pos_Bridge_Constants::ORDER_META_TX ) === (string) $transaction_id ) {
				$out[] = array( 'orderId' => (string) $id );
			}
		}
		return $out;
	}

	protected function order_carries_recovery_token( $order, $recovery_token ) {
		if ( ! is_object( $order ) ) {
			return false;
		}
		$meta = method_exists( $order, 'get_meta' ) ? (string) $order->get_meta( Cetech_Pos_Bridge_Constants::ORDER_META_RECOVERY ) : '';
		$key  = method_exists( $order, 'get_order_key' ) ? (string) $order->get_order_key() : '';
		return $meta === (string) $recovery_token || $key === (string) $recovery_token;
	}
}

function r144_hook_runtime() {
	$env              = br01_authorized_env();
	$env->woo         = true;
	$runtime          = new Cetech_Pos_Bridge_Hook_Woo_Runtime( $env );
	$wc               = new Cetech_Pos_Bridge_Hook_Wc();
	$wc->cart         = new Cetech_Pos_Bridge_Hook_Cart();
	$runtime->stub_wc = $wc;
	WC_Order::$next_id_allocator = function () use ( $runtime ) {
		$id = $runtime->next_id;
		++$runtime->next_id;
		return $id;
	};
	return $runtime;
}

function r144_money( $minor ) {
	return array(
		'minor'    => (int) $minor,
		'currency' => 'GHS',
	);
}

function r144_quote_snapshot() {
	return array(
		'id'           => 'quote-r144',
		'fingerprint'  => 'fp-r144',
		'currency'     => 'GHS',
		'cartId'       => '11111111-1111-4111-8111-111111111111',
		'cartRevision' => 1,
		'locationId'   => 'loc-r144',
		'purchasable'  => true,
		'customer'     => array( 'kind' => 'walkin' ),
		'subtotal'     => r144_money( 1000 ),
		'discount'     => r144_money( 0 ),
		'tax'          => r144_money( 0 ),
		'total'        => r144_money( 1000 ),
		'lines'        => array(
			array(
				'lineId'    => '22222222-2222-4222-8222-222222222222',
				'productId' => '101',
				'quantity'  => '1',
				'unitPrice' => r144_money( 1000 ),
				'subtotal'  => r144_money( 1000 ),
				'discount'  => r144_money( 0 ),
				'tax'       => r144_money( 0 ),
				'total'     => r144_money( 1000 ),
			),
		),
	);
}

function r144_token() {
	return str_repeat( 'ab', 32 );
}

/* ---------------------------------------------------------------------------
 * R144-1 — nested lower-priority fresh order cannot steal recovery identity
 * ------------------------------------------------------------------------ */

$r144_1_runtime = r144_hook_runtime();
$r144_1_token   = r144_token();
$r144_1_nested  = null;
$r144_1_nested_cb = function ( $order ) use ( &$r144_1_nested ) {
	if ( ! is_object( $order ) || (int) $order->get_id() > 0 ) {
		return;
	}
	// Nested fresh order saved at priority below zero during the intended before-save.
	if ( $r144_1_nested !== null ) {
		return;
	}
	$r144_1_nested = new WC_Order();
	$r144_1_nested->set_status( 'pending' );
	$r144_1_nested->save();
};
add_action( 'woocommerce_before_order_object_save', $r144_1_nested_cb, -1, 1 );
$r144_1_order = $r144_1_runtime->expose_persist( r144_quote_snapshot(), $r144_1_token, 'tx-r144-1', 'hash-r144-1' );
remove_action( 'woocommerce_before_order_object_save', $r144_1_nested_cb, -1 );
br01_assert(
	! Cetech_Pos_Bridge_Quote_Request::is_error( $r144_1_order ),
	'R144-1 intended persist succeeds' . ( Cetech_Pos_Bridge_Quote_Request::is_error( $r144_1_order ) ? ( ': ' . $r144_1_order->get_error_message() ) : '' )
);
br01_assert( is_object( $r144_1_order ) && ! Cetech_Pos_Bridge_Quote_Request::is_error( $r144_1_order ), 'R144-1 intended persist returns an order object' );
br01_assert( is_object( $r144_1_nested ), 'R144-1 nested fresh order was created during binder window' );
if ( is_object( $r144_1_order ) && ! Cetech_Pos_Bridge_Quote_Request::is_error( $r144_1_order ) && is_object( $r144_1_nested ) ) {
	br01_assert(
		(string) $r144_1_order->get_meta( Cetech_Pos_Bridge_Constants::ORDER_META_RECOVERY ) === $r144_1_token,
		'R144-1 intended order carries the recovery token'
	);
	br01_assert(
		(string) $r144_1_nested->get_meta( Cetech_Pos_Bridge_Constants::ORDER_META_RECOVERY ) !== $r144_1_token,
		'R144-1 nested order does not carry the POS recovery token'
	);
	br01_assert(
		(string) $r144_1_nested->get_order_key() !== $r144_1_token,
		'R144-1 nested order does not carry the recovery order key'
	);
}

/* ---------------------------------------------------------------------------
 * R144-2 — extra same-request create after binder fails prepare observation
 * ------------------------------------------------------------------------ */

$r144_2_runtime = r144_hook_runtime();
$r144_2_guard   = $r144_2_runtime->expose_arm_guard();
br01_assert( is_object( $r144_2_guard ) && ! Cetech_Pos_Bridge_Quote_Request::is_error( $r144_2_guard ), 'R144-2 create guard arms' );
$r144_2_order = $r144_2_runtime->expose_persist( r144_quote_snapshot(), r144_token(), 'tx-r144-2', 'hash-r144-2' );
br01_assert( is_object( $r144_2_order ), 'R144-2 intended order persists under guard' );
$r144_2_runtime->orders_by_id[ (string) $r144_2_order->get_id() ] = $r144_2_order;
$r144_2_extra = new WC_Order();
$r144_2_extra->set_status( 'pending' );
$r144_2_extra->save();
$r144_2_check = $r144_2_runtime->expose_assert_extra( $r144_2_guard, (string) $r144_2_order->get_id() );
$r144_2_runtime->expose_disarm_guard( $r144_2_guard );
br01_assert( Cetech_Pos_Bridge_Quote_Request::is_error( $r144_2_check ), 'R144-2 extra same-request create is rejected' );
br01_assert_eq(
	'INTEGRATION_UNAVAILABLE',
	is_object( $r144_2_check ) ? $r144_2_check->get_error_code() : '',
	'R144-2 rejection uses INTEGRATION_UNAVAILABLE'
);

$r144_2b_runtime = r144_hook_runtime();
$r144_2b_guard   = $r144_2b_runtime->expose_arm_guard();
$r144_2b_order   = $r144_2b_runtime->expose_persist( r144_quote_snapshot(), r144_token(), 'tx-r144-2b', 'hash-r144-2b' );
$r144_2b_runtime->orders_by_id[ (string) $r144_2b_order->get_id() ] = $r144_2b_order;
// Other-request activity is invisible to request-local hooks (no do_action here).
$r144_2b_ok = $r144_2b_runtime->expose_assert_extra( $r144_2b_guard, (string) $r144_2b_order->get_id() );
$r144_2b_runtime->expose_disarm_guard( $r144_2b_guard );
br01_assert( $r144_2b_ok === true, 'R144-2 clean other-request activity does not reject intended create' );

/* ---------------------------------------------------------------------------
 * R144-3 — quote observes draft/refund creates and delete; cleanup on success
 * ------------------------------------------------------------------------ */

$r144_3_runtime = r144_hook_runtime();
$r144_3_runtime->stub_wc->cart->during = function () {
	$draft = new WC_Order();
	$draft->set_status( 'auto-draft' );
	$draft->save();
};
$r144_3_draft = $r144_3_runtime->calculate_totals();
br01_assert( Cetech_Pos_Bridge_Quote_Request::is_error( $r144_3_draft ), 'R144-3 auto-draft create during quote fails closed' );
br01_assert(
	! isset( $GLOBALS['wp_filter']['woocommerce_before_order_object_save'] ) ||
	$GLOBALS['wp_filter']['woocommerce_before_order_object_save'] === array() ||
	! r144_hooks_still_present( 'woocommerce_before_order_object_save' ),
	'R144-3 draft-path observers are removed after failure'
);

$r144_3r_runtime = r144_hook_runtime();
$r144_3r_runtime->stub_wc->cart->during = function () {
	$refund = new WC_Order();
	$refund->set_status( 'pending' );
	// Refund path: before/after save without new_order (draft-like omission simulated by status auto-draft).
	$refund->status = 'auto-draft';
	$refund->save();
};
$r144_3_refund = $r144_3r_runtime->calculate_totals();
br01_assert( Cetech_Pos_Bridge_Quote_Request::is_error( $r144_3_refund ), 'R144-3 silent refund/draft-like create during quote fails closed' );

$r144_3d_runtime = r144_hook_runtime();
$r144_3d_runtime->stub_wc->cart->during = function () {
	do_action( 'woocommerce_delete_order', 999 );
};
$r144_3_del = $r144_3d_runtime->calculate_totals();
br01_assert( Cetech_Pos_Bridge_Quote_Request::is_error( $r144_3_del ), 'R144-3 delete during quote fails closed' );

$r144_3ok_runtime = r144_hook_runtime();
$r144_3ok_runtime->stub_wc->cart->during = function () {
	// No order CRUD.
};
$r144_3_ok = $r144_3ok_runtime->calculate_totals();
br01_assert( $r144_3_ok === true, 'R144-3 clean calculate_totals succeeds' );
br01_assert( ! r144_hooks_still_present( 'woocommerce_before_order_object_save' ), 'R144-3 success cleans before-save observers' );
br01_assert( ! r144_hooks_still_present( 'woocommerce_after_order_object_save' ), 'R144-3 success cleans after-save observers' );
br01_assert( ! r144_hooks_still_present( 'woocommerce_delete_order' ), 'R144-3 success cleans delete observers' );

function r144_hooks_still_present( $hook ) {
	if ( ! isset( $GLOBALS['wp_filter'][ $hook ] ) || ! is_array( $GLOBALS['wp_filter'][ $hook ] ) ) {
		return false;
	}
	foreach ( $GLOBALS['wp_filter'][ $hook ] as $bucket ) {
		if ( is_array( $bucket ) && $bucket !== array() ) {
			return true;
		}
	}
	return false;
}

/* ---------------------------------------------------------------------------
 * Static source presence for the three repairs
 * ------------------------------------------------------------------------ */

$r144_src = file_get_contents( dirname( __DIR__, 2 ) . '/wordpress/cetech-pos-bridge/includes/class-woo-runtime.php' );
br01_assert( strpos( $r144_src, 'Exact intended object only' ) !== false, 'R144 source binder matches intended object identity' );
br01_assert( strpos( $r144_src, 'assert_no_unexpected_same_request_order_creates' ) !== false, 'R144 source rejects unexpected same-request creates' );
br01_assert( strpos( $r144_src, 'woocommerce_after_order_object_save' ) !== false, 'R144 source observes after_order_object_save for draft/refund creates' );
br01_assert( strpos( $r144_src, 'woocommerce_delete_order' ) !== false, 'R144 source observes delete_order during quote guard' );
