<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Test double for the Woo runtime boundary.
 * Catalog rows are injected authoritative totals, not WoodMart/B2BKing formulas.
 */
class Cetech_Pos_Bridge_Fake_Woo_Runtime extends Cetech_Pos_Bridge_Woo_Runtime {
	/** @var array<string,string> customerId => kind */
	public $customers = array();
	/** @var array<string,array<string,array<string,array<string,mixed>>>> */
	public $catalog = array();
	public $throw_on_calculate = false;
	/** @var callable|null */
	public $during_calculate = null;
	public $bag_key          = 'cetech_pos_fake_wc';
	/** @var int */
	public $hold_stock_minutes = 60;
	/** @var array<string,int> productId => remaining units */
	public $stock = array();
	/** @var array<int,array<string,mixed>> */
	public $orders = array();
	/** @var array<string,array<string,int>> orderId => productId => qty */
	public $reservations = array();
	/** @var int */
	public $next_order_id = 1001;
	/** @var int storefront competing checkouts that took stock */
	public $storefront_orders = 0;
	/** @var callable|null */
	public $during_create = null;
	/** @var callable|null */
	public $during_reserve = null;
	/** @var callable|null fired after each managed product reservation row is written */
	public $after_product_reserve = null;
	/** @var string|null force an invalid PreparedSale stockCommitment */
	public $force_commitment = null;
	/** @var int */
	public $create_calls = 0;
	/** @var int|null unix expiry written onto fake reservation rows */
	public $reservation_expiry_unix = null;
	/** @var array<string,array<string,mixed>> productId => managing_stock/backorders_allowed/stock_managed_by */
	public $product_stock_rules = array();
	/** @var string|null ReserveStockException error code to throw from reserve */
	public $reserve_exception = null;
	/** @var array<string,array<string,array<string,mixed>>> orderId => productId => row */
	public $reservation_rows = array();

	public function available() {
		return (bool) $this->environment->wc_available();
	}

	public function currency() {
		return Cetech_Pos_Bridge_Constants::SETTLEMENT_CURRENCY;
	}

	public function price_decimals() {
		return Cetech_Pos_Bridge_Constants::PRICE_DECIMALS;
	}

	public function snapshot() {
		$bag = $this->bag();
		return array(
			'customer' => $bag['customer'],
			'cart'     => $bag['cart'],
		);
	}

	public function restore( array $snapshot ) {
		$this->write_bag(
			isset( $snapshot['customer'] ) ? $snapshot['customer'] : '__idle__',
			isset( $snapshot['cart'] ) ? $snapshot['cart'] : array()
		);
	}

	public function install_customer_context( array $customer ) {
		if ( $customer['kind'] === 'walkin' ) {
			$this->write_bag( 'walkin', $this->bag()['cart'] );
			return true;
		}
		$id = $customer['customerId'];
		if ( ! isset( $this->customers[ $id ] ) ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'NOT_FOUND',
				'Customer context was not found.',
				false,
				'none',
				404,
				array( 'field' => 'customer' )
			);
		}
		if ( $this->customers[ $id ] !== $customer['kind'] ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'FORBIDDEN',
				'Requested customer kind does not match the authorized commercial context.',
				false,
				'none',
				403,
				array( 'field' => 'customer' )
			);
		}
		$this->write_bag( $customer['kind'] . ':' . $id, $this->bag()['cart'] );
		return true;
	}

	public function reset_cart() {
		$bag = $this->bag();
		$this->write_bag( $bag['customer'], array() );
		return true;
	}

	public function add_line( array $line ) {
		$bag   = $this->bag();
		$cart  = $bag['cart'];
		$cart[] = $line;
		$this->write_bag( $bag['customer'], $cart );
		return true;
	}

	public function calculate_totals() {
		if ( $this->throw_on_calculate ) {
			throw new RuntimeException( 'forced calculate_totals failure' );
		}
		if ( is_callable( $this->during_calculate ) ) {
			$cb = $this->during_calculate;
			$this->during_calculate = null;
			$cb( $this );
		}
		$bag  = $this->bag();
		$cart = array();
		foreach ( $bag['cart'] as $line ) {
			$key = $this->catalog_key( $line );
			if ( ! isset( $this->catalog[ $bag['customer'] ][ $key ][ $line['quantity'] ] ) ) {
				return Cetech_Pos_Bridge_Response::wp_error(
					'VALIDATION_ERROR',
					'WooCommerce rejected a quote line.',
					false,
					'none',
					400,
					array( 'field' => 'lines' )
				);
			}
			$priced         = $this->catalog[ $bag['customer'] ][ $key ][ $line['quantity'] ];
			$priced['line'] = $line;
			$cart[]         = $priced;
		}
		$this->write_bag( $bag['customer'], $cart );
		return true;
	}

	public function get_priced_cart() {
		$bag      = $this->bag();
		$lines    = array();
		$subtotal = 0;
		$discount = 0;
		$tax      = 0;
		foreach ( $bag['cart'] as $priced ) {
			$lines[]   = array(
				'productId'    => $priced['line']['productId'],
				'variationId'  => isset( $priced['line']['variationId'] ) ? $priced['line']['variationId'] : null,
				'quantity'     => $priced['line']['quantity'],
				'unitPrice'    => $priced['unitPrice'],
				'subtotal'     => $priced['subtotal'],
				'discount'     => $priced['discount'],
				'tax'          => $priced['tax'],
				'stockStatus'  => $priced['stockStatus'],
				'purchasable'  => $priced['purchasable'],
				'pricingLabel' => isset( $priced['pricingLabel'] ) ? $priced['pricingLabel'] : null,
				'problems'     => isset( $priced['problems'] ) ? $priced['problems'] : array(),
			);
			$subtotal += Cetech_Pos_Bridge_Money::from_decimal_string( $priced['subtotal'], 'GHS' );
			$discount += Cetech_Pos_Bridge_Money::from_decimal_string( $priced['discount'], 'GHS' );
			$tax      += Cetech_Pos_Bridge_Money::from_decimal_string( $priced['tax'], 'GHS' );
		}
		$total = $subtotal - $discount + $tax;
		return array(
			'currency' => 'GHS',
			'lines'    => $lines,
			'subtotal' => $this->minor_to_decimal( $subtotal ),
			'discount' => $this->minor_to_decimal( $discount ),
			'tax'      => $this->minor_to_decimal( $tax ),
			'total'    => $this->minor_to_decimal( $total ),
		);
	}

	public function bag() {
		if ( ! isset( $GLOBALS[ $this->bag_key ] ) ) {
			$GLOBALS[ $this->bag_key ] = array(
				'customer' => '__idle__',
				'cart'     => array(),
			);
		}
		return $GLOBALS[ $this->bag_key ];
	}

	public function write_bag( $customer, $cart ) {
		$GLOBALS[ $this->bag_key ] = array(
			'customer' => $customer,
			'cart'     => $cart,
		);
	}

	public function hold_stock_seconds() {
		$minutes = (int) $this->hold_stock_minutes;
		if ( $minutes <= 0 ) {
			return 0;
		}
		return $minutes * 60;
	}

	public function pos_order_count() {
		$count = 0;
		foreach ( $this->orders as $order ) {
			if ( ! empty( $order['pos'] ) ) {
				++$count;
			}
		}
		return $count;
	}

	protected function count_orders() {
		return count( $this->orders );
	}

	/**
	 * Competing storefront checkout against the same catalog unit. Not a POS prepare.
	 *
	 * @param string $product_id
	 * @param int    $qty
	 * @return bool
	 */
	public function competing_checkout( $product_id, $qty = 1 ) {
		$qty = (int) $qty;
		if ( ! isset( $this->stock[ $product_id ] ) || $this->stock[ $product_id ] < $qty ) {
			return false;
		}
		$this->stock[ $product_id ] -= $qty;
		++$this->storefront_orders;
		++$this->side_effects['orders'];
		++$this->side_effects['stock'];
		$this->orders[] = array(
			'id'             => 'storefront-' . $this->next_order_id,
			'pos'            => false,
			'transaction_id' => null,
			'status'         => 'processing',
		);
		++$this->next_order_id;
		return true;
	}

	public function create_prepared_order( array $quote, $transaction_id, $request_hash ) {
		$hold = $this->hold_stock_seconds();
		if ( $hold <= 0 ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'INTEGRATION_UNAVAILABLE',
				'Woo hold-stock minutes is not configured; prepare cannot claim a bounded reserved commitment.',
				true,
				'resolve',
				503
			);
		}
		if ( is_callable( $this->during_create ) ) {
			$cb = $this->during_create;
			$this->during_create = null;
			$cb( $this );
		}
		++$this->create_calls;
		$order_id = (string) $this->next_order_id;
		++$this->next_order_id;
		$sale_id  = 'sale-' . $order_id;
		$this->orders[] = array(
			'id'             => $order_id,
			'pos'            => true,
			'transaction_id' => null,
			'request_hash'   => null,
			'sale_id'        => $sale_id,
			'status'         => 'pending',
			'reserved'       => false,
			'quote_lines'    => $quote['lines'],
		);
		$this->fire_seam( $this->after_wc_create );
		$this->attach_recovery_meta( $order_id, $transaction_id, $request_hash );
		$this->fire_seam( $this->after_meta_save );
		$reserved = $this->reserve_order_stock( $order_id );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $reserved ) ) {
			if ( is_object( $reserved ) && method_exists( $reserved, 'get_error_code' ) && $reserved->get_error_code() === 'STOCK_CHANGED' ) {
				$this->trash_pos_order( $order_id );
			}
			return $reserved;
		}
		$described = $this->describe_order( $this->order_as_proof_object_by_id( $order_id ), $hold );
		if ( $described === null || empty( $described['reservationProven'] ) ) {
			return $this->unavailable( 'Woo did not expose a complete current stock reservation after wc_reserve_stock_for_order.' );
		}
		++$this->side_effects['orders'];
		++$this->side_effects['stock'];
		$commitment = $this->force_commitment !== null ? $this->force_commitment : 'reserved';
		if ( $commitment !== 'reserved' && $commitment !== 'reduced' ) {
			$described['reservationProven'] = false;
			unset( $described['stockCommitment'], $described['reservationExpiresAt'] );
			$described['stockCommitment'] = $commitment;
		}
		return $described;
	}

	public function find_orders_by_transaction( $transaction_id ) {
		$out  = array();
		$hold = $this->hold_stock_seconds();
		foreach ( $this->orders as $order ) {
			if ( empty( $order['pos'] ) || $order['transaction_id'] === null || (string) $order['transaction_id'] !== (string) $transaction_id ) {
				continue;
			}
			$described = $this->describe_order( $this->order_as_proof_object( $order ), $hold );
			if ( $described !== null ) {
				$out[] = $described;
			}
		}
		return $out;
	}

	public function complete_stock_reservation( array $found ) {
		if ( ! empty( $found['reservationProven'] ) && isset( $found['stockCommitment'] ) && isset( $found['reservationExpiresAt'] ) && $found['stockCommitment'] === 'reserved' ) {
			return $found;
		}
		$reserved = $this->reserve_order_stock( $found['orderId'] );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $reserved ) ) {
			if ( is_object( $reserved ) && method_exists( $reserved, 'get_error_code' ) && $reserved->get_error_code() === 'STOCK_CHANGED' ) {
				return Cetech_Pos_Bridge_Response::wp_error(
					'REQUIRES_ATTENTION',
					'Existing Woo order reservation could not be completed.',
					false,
					'contact_manager',
					409
				);
			}
			return $reserved;
		}
		++$this->side_effects['stock'];
		$hold      = $this->hold_stock_seconds();
		$described = $this->describe_order( $this->order_as_proof_object_by_id( $found['orderId'] ), $hold );
		if ( $described === null || empty( $described['reservationProven'] ) ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'REQUIRES_ATTENTION',
				'Existing Woo order reservation could not be proven after retry.',
				false,
				'contact_manager',
				409
			);
		}
		return $described;
	}

	public function inject_duplicate_transaction_order( $transaction_id ) {
		$order_id = (string) $this->next_order_id;
		++$this->next_order_id;
		$this->orders[] = array(
			'id'             => $order_id,
			'pos'            => true,
			'transaction_id' => (string) $transaction_id,
			'request_hash'   => 'dup',
			'sale_id'        => 'sale-' . $order_id,
			'status'         => 'pending',
			'reserved'       => true,
		);
	}

	public function inject_pos_order( $transaction_id, $request_hash, $reserved = true ) {
		$order_id = (string) $this->next_order_id;
		++$this->next_order_id;
		$this->orders[] = array(
			'id'             => $order_id,
			'pos'            => true,
			'transaction_id' => (string) $transaction_id,
			'request_hash'   => (string) $request_hash,
			'sale_id'        => 'sale-' . $order_id,
			'status'         => 'pending',
			'reserved'       => false,
			'quote_lines'    => array(
				array(
					'productId' => '101',
					'quantity'  => '1',
				),
			),
		);
		if ( $reserved ) {
			$this->write_reservation_row( $order_id, '101', 1, $this->current_reservation_expiry() );
			$this->mark_reserved( $order_id );
		}
	}

	public function inject_reservation_row( $order_id, $product_id, $quantity, $expires_unix ) {
		$this->write_reservation_row( $order_id, $product_id, $quantity, $expires_unix );
	}

	public function reservation_is_proven( $order_id ) {
		$obj = $this->order_as_proof_object_by_id( $order_id );
		return $obj !== null && is_array( $this->prove_order_reservation( $obj ) );
	}

	private function attach_recovery_meta( $order_id, $transaction_id, $request_hash ) {
		foreach ( $this->orders as $index => $order ) {
			if ( (string) $order['id'] === (string) $order_id ) {
				$this->orders[ $index ]['transaction_id'] = (string) $transaction_id;
				$this->orders[ $index ]['request_hash']   = (string) $request_hash;
				return;
			}
		}
	}

	private function reserve_order_stock( $order_id ) {
		$target = $this->order_array_by_id( $order_id );
		if ( $target === null ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'STOCK_CHANGED',
				'Quoted stock is no longer available.',
				false,
				'review_quote',
				409,
				array( 'field' => 'lines' )
			);
		}
		$obj = $this->order_as_proof_object( $target );
		if ( is_array( $this->prove_order_reservation( $obj ) ) ) {
			$this->mark_reserved( $order_id );
			return true;
		}
		if ( is_callable( $this->during_reserve ) ) {
			$cb = $this->during_reserve;
			$this->during_reserve = null;
			$cb( $this );
		}
		if ( is_string( $this->reserve_exception ) && $this->reserve_exception !== '' ) {
			$ex = new Cetech_Pos_Bridge_Test_ReserveStockException( $this->reserve_exception, 'forced reserve failure' );
			$this->reserve_exception = null;
			return $this->reservation_failure_from_exception( $ex, false );
		}
		$required = $this->expected_managed_reservation_quantities( $obj );
		if ( ! is_array( $required ) || $required === array() ) {
			return $this->unavailable( 'Woo did not expose a complete current stock reservation after wc_reserve_stock_for_order.' );
		}
		ksort( $required );
		foreach ( $required as $pid => $qty ) {
			$pid = (string) $pid;
			$qty = (float) $qty;
			$row = $this->current_reservation_row( $order_id, $pid );
			if ( $row !== null && ( (float) $row['stock_quantity'] + 0.0000001 ) >= $qty ) {
				continue;
			}
			$available = isset( $this->stock[ $pid ] ) ? (int) $this->stock[ $pid ] : 0;
			$already   = isset( $this->reservations[ $order_id ][ $pid ] ) ? (int) $this->reservations[ $order_id ][ $pid ] : 0;
			$need      = (int) $qty - $already;
			if ( $need > 0 && $available < $need ) {
				$this->trash_pos_order( $order_id );
				return Cetech_Pos_Bridge_Response::wp_error(
					'STOCK_CHANGED',
					'Quoted stock is no longer available.',
					false,
					'review_quote',
					409,
					array( 'field' => 'lines' )
				);
			}
			if ( $need > 0 ) {
				$this->stock[ $pid ] -= $need;
				if ( ! isset( $this->reservations[ $order_id ] ) ) {
					$this->reservations[ $order_id ] = array();
				}
				$this->reservations[ $order_id ][ $pid ] = (int) $qty;
			}
			$this->write_reservation_row( $order_id, $pid, $qty, $this->current_reservation_expiry() );
			if ( is_callable( $this->after_product_reserve ) ) {
				$cb = $this->after_product_reserve;
				$this->after_product_reserve = null;
				$cb( $this, $pid );
			}
		}
		if ( is_array( $this->prove_order_reservation( $this->order_as_proof_object_by_id( $order_id ) ) ) ) {
			$this->mark_reserved( $order_id );
		}
		return true;
	}

	protected function read_current_reservation_rows( $order ) {
		if ( ! $order instanceof Cetech_Pos_Bridge_Fake_Order ) {
			return parent::read_current_reservation_rows( $order );
		}
		$order_id = (string) $order->get_id();
		$out      = array();
		if ( ! isset( $this->reservation_rows[ $order_id ] ) || ! is_array( $this->reservation_rows[ $order_id ] ) ) {
			return $out;
		}
		foreach ( $this->reservation_rows[ $order_id ] as $pid => $row ) {
			$exp = isset( $row['expires'] ) ? (int) $row['expires'] : 0;
			if ( $exp <= time() ) {
				continue;
			}
			$out[ (string) $pid ] = array(
				'product_id'     => (string) $pid,
				'stock_quantity' => $row['stock_quantity'],
				'expires'        => $exp,
			);
		}
		return $out;
	}

	private function order_as_proof_object_by_id( $order_id ) {
		$order = $this->order_array_by_id( $order_id );
		return $order === null ? null : $this->order_as_proof_object( $order );
	}

	private function order_array_by_id( $order_id ) {
		foreach ( $this->orders as $order ) {
			if ( (string) $order['id'] === (string) $order_id ) {
				return $order;
			}
		}
		return null;
	}

	private function order_as_proof_object( array $order ) {
		$obj     = new Cetech_Pos_Bridge_Fake_Order( $order['id'] );
		$obj->id = $order['id'];
		$obj->meta[ Cetech_Pos_Bridge_Constants::ORDER_META_TX ]   = isset( $order['transaction_id'] ) ? (string) $order['transaction_id'] : '';
		$obj->meta[ Cetech_Pos_Bridge_Constants::ORDER_META_HASH ] = isset( $order['request_hash'] ) ? (string) $order['request_hash'] : '';
		$obj->meta[ Cetech_Pos_Bridge_Constants::ORDER_META_SALE ] = isset( $order['sale_id'] ) ? (string) $order['sale_id'] : '';
		$lines   = isset( $order['quote_lines'] ) && is_array( $order['quote_lines'] ) ? $order['quote_lines'] : array();
		foreach ( $lines as $line ) {
			$pid   = isset( $line['variationId'] ) ? (string) $line['variationId'] : (string) $line['productId'];
			$rules = $this->product_reserve_rules( $pid, isset( $line['productId'] ) ? (string) $line['productId'] : $pid );
			$item  = new Cetech_Pos_Bridge_Fake_Order_Item(
				new Cetech_Pos_Bridge_Fake_Stock_Product( $rules['managing_stock'], $rules['backorders_allowed'], $rules['stock_managed_by'] ),
				isset( $line['quantity'] ) ? $line['quantity'] : 1
			);
			$obj->items[] = $item;
		}
		return $obj;
	}

	private function product_reserve_rules( $pid, $parent ) {
		$defaults = array(
			'managing_stock'     => true,
			'backorders_allowed' => false,
			'stock_managed_by'   => (string) $pid,
		);
		$rules = isset( $this->product_stock_rules[ $pid ] ) ? $this->product_stock_rules[ $pid ] : ( isset( $this->product_stock_rules[ $parent ] ) ? $this->product_stock_rules[ $parent ] : array() );
		return array_merge( $defaults, $rules );
	}

	private function current_reservation_row( $order_id, $product_id ) {
		if ( ! isset( $this->reservation_rows[ $order_id ][ $product_id ] ) ) {
			return null;
		}
		$row = $this->reservation_rows[ $order_id ][ $product_id ];
		$exp = isset( $row['expires'] ) ? (int) $row['expires'] : 0;
		if ( $exp <= time() ) {
			return null;
		}
		return $row;
	}

	private function write_reservation_row( $order_id, $product_id, $quantity, $expires_unix ) {
		$order_id   = (string) $order_id;
		$product_id = (string) $product_id;
		if ( ! isset( $this->reservation_rows[ $order_id ] ) ) {
			$this->reservation_rows[ $order_id ] = array();
		}
		$this->reservation_rows[ $order_id ][ $product_id ] = array(
			'stock_quantity' => $quantity,
			'expires'        => (int) $expires_unix,
		);
	}

	private function current_reservation_expiry() {
		if ( $this->reservation_expiry_unix !== null ) {
			return (int) $this->reservation_expiry_unix;
		}
		return time() + $this->hold_stock_seconds();
	}

	private function mark_reserved( $order_id ) {
		foreach ( $this->orders as $index => $order ) {
			if ( (string) $order['id'] === (string) $order_id ) {
				$this->orders[ $index ]['reserved'] = true;
				return;
			}
		}
	}

	private function trash_pos_order( $order_id ) {
		$order_id = (string) $order_id;
		if ( isset( $this->reservations[ $order_id ] ) ) {
			foreach ( $this->reservations[ $order_id ] as $pid => $qty ) {
				if ( ! isset( $this->stock[ $pid ] ) ) {
					$this->stock[ $pid ] = 0;
				}
				$this->stock[ $pid ] += $qty;
			}
			unset( $this->reservations[ $order_id ] );
		}
		unset( $this->reservation_rows[ $order_id ] );
		$kept = array();
		foreach ( $this->orders as $order ) {
			if ( (string) $order['id'] !== (string) $order_id ) {
				$kept[] = $order;
			}
		}
		$this->orders = $kept;
	}

	private function catalog_key( array $line ) {
		$key = $line['productId'];
		if ( isset( $line['variationId'] ) ) {
			$key .= ':' . $line['variationId'];
		}
		return $key;
	}

	private function minor_to_decimal( $minor ) {
		$minor = (int) $minor;
		return sprintf( '%d.%02d', intdiv( $minor, 100 ), $minor % 100 );
	}
}

class Cetech_Pos_Bridge_Fake_Order {
	public $id;
	public $items = array();
	public $meta  = array();

	public function __construct( $id ) {
		$this->id = $id;
	}

	public function get_id() {
		return $this->id;
	}

	public function get_items() {
		return $this->items;
	}

	public function get_meta( $key ) {
		return isset( $this->meta[ $key ] ) ? $this->meta[ $key ] : '';
	}

	public function get_order_number() {
		return (string) $this->id;
	}
}

class Cetech_Pos_Bridge_Fake_Order_Item {
	public $product;
	public $qty;

	public function __construct( $product, $qty ) {
		$this->product = $product;
		$this->qty     = $qty;
	}

	public function is_type( $type ) {
		return $type === 'line_item';
	}

	public function get_quantity() {
		return $this->qty;
	}

	public function get_product() {
		return $this->product;
	}
}

class Cetech_Pos_Bridge_Fake_Stock_Product {
	public $managing;
	public $backorders;
	public $managed_by;

	public function __construct( $managing, $backorders, $managed_by ) {
		$this->managing   = (bool) $managing;
		$this->backorders = (bool) $backorders;
		$this->managed_by = (string) $managed_by;
	}

	public function managing_stock() {
		return $this->managing;
	}

	public function backorders_allowed() {
		return $this->backorders;
	}

	public function get_stock_managed_by_id() {
		return $this->managed_by;
	}
}

class Cetech_Pos_Bridge_Test_ReserveStockException extends Exception {
	private $error_code;

	public function __construct( $code, $message = '', $http = 403 ) {
		$this->error_code = (string) $code;
		parent::__construct( $message, $http );
	}

	public function getErrorCode() {
		return $this->error_code;
	}
}

class Cetech_Pos_Bridge_Fake_Pricing_Rules extends Cetech_Pos_Bridge_Pricing_Rules {
	/** @var array<int,array<string,mixed>>|null */
	public $woodmart_records = null;
	/** @var array<string,mixed>|null */
	public $b2bking_records  = null;

	protected function read_woodmart_discount_records() {
		return $this->woodmart_records;
	}

	protected function read_b2bking_rule_records() {
		return $this->b2bking_records;
	}
}
