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
	/** @var string|null force an invalid PreparedSale stockCommitment */
	public $force_commitment = null;
	/** @var int */
	public $create_calls = 0;

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
			return $reserved;
		}
		++$this->side_effects['orders'];
		++$this->side_effects['stock'];
		$commitment = $this->force_commitment !== null ? $this->force_commitment : 'reserved';
		$proven     = ( $commitment === 'reserved' || $commitment === 'reduced' );
		return array(
			'orderId'           => $order_id,
			'saleId'            => $sale_id,
			'orderReference'    => $order_id,
			'requestHash'       => (string) $request_hash,
			'reservationProven' => $proven,
			'stockCommitment'   => $commitment,
			'holdSeconds'       => $hold,
		);
	}

	public function find_orders_by_transaction( $transaction_id ) {
		$out  = array();
		$hold = $this->hold_stock_seconds();
		foreach ( $this->orders as $order ) {
			if ( empty( $order['pos'] ) || $order['transaction_id'] === null || (string) $order['transaction_id'] !== (string) $transaction_id ) {
				continue;
			}
			$proven = ! empty( $order['reserved'] );
			$row    = array(
				'orderId'           => (string) $order['id'],
				'saleId'            => (string) $order['sale_id'],
				'orderReference'    => (string) $order['id'],
				'requestHash'       => isset( $order['request_hash'] ) ? (string) $order['request_hash'] : '',
				'reservationProven' => $proven,
				'holdSeconds'       => $hold,
			);
			if ( $proven ) {
				$row['stockCommitment'] = 'reserved';
			}
			$out[] = $row;
		}
		return $out;
	}

	public function complete_stock_reservation( array $found ) {
		if ( ! empty( $found['reservationProven'] ) && isset( $found['stockCommitment'] ) ) {
			return $found;
		}
		$reserved = $this->reserve_order_stock( $found['orderId'] );
		if ( Cetech_Pos_Bridge_Quote_Request::is_error( $reserved ) ) {
			return Cetech_Pos_Bridge_Response::wp_error(
				'REQUIRES_ATTENTION',
				'Existing Woo order reservation could not be completed.',
				false,
				'contact_manager',
				409
			);
		}
		++$this->side_effects['stock'];
		$hold = $this->hold_stock_seconds();
		return array(
			'orderId'           => (string) $found['orderId'],
			'saleId'            => (string) $found['saleId'],
			'orderReference'    => (string) $found['orderReference'],
			'requestHash'       => isset( $found['requestHash'] ) ? (string) $found['requestHash'] : '',
			'reservationProven' => true,
			'stockCommitment'   => 'reserved',
			'holdSeconds'       => $hold,
		);
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
			'reserved'       => (bool) $reserved,
			'quote_lines'    => array(
				array(
					'productId' => '101',
					'quantity'  => '1',
				),
			),
		);
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
		$target = null;
		foreach ( $this->orders as $order ) {
			if ( (string) $order['id'] === (string) $order_id ) {
				$target = $order;
				break;
			}
		}
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
		if ( ! empty( $target['reserved'] ) ) {
			return true;
		}
		if ( is_callable( $this->during_reserve ) ) {
			$cb = $this->during_reserve;
			$this->during_reserve = null;
			$cb( $this );
		}
		$lines = isset( $target['quote_lines'] ) && is_array( $target['quote_lines'] ) ? $target['quote_lines'] : array();
		foreach ( $lines as $line ) {
			$pid = isset( $line['variationId'] ) ? (string) $line['variationId'] : (string) $line['productId'];
			$qty = (int) $line['quantity'];
			if ( $qty < 1 ) {
				$qty = 1;
			}
			$available = isset( $this->stock[ $pid ] ) ? (int) $this->stock[ $pid ] : ( isset( $this->stock[ $line['productId'] ] ) ? (int) $this->stock[ $line['productId'] ] : 0 );
			$key       = isset( $this->stock[ $pid ] ) ? $pid : (string) $line['productId'];
			if ( $available < $qty ) {
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
			$this->stock[ $key ] -= $qty;
			if ( ! isset( $this->reservations[ $order_id ] ) ) {
				$this->reservations[ $order_id ] = array();
			}
			$this->reservations[ $order_id ][ $key ] = $qty;
		}
		$this->mark_reserved( $order_id );
		return true;
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
		if ( isset( $this->reservations[ $order_id ] ) ) {
			foreach ( $this->reservations[ $order_id ] as $pid => $qty ) {
				if ( ! isset( $this->stock[ $pid ] ) ) {
					$this->stock[ $pid ] = 0;
				}
				$this->stock[ $pid ] += $qty;
			}
			unset( $this->reservations[ $order_id ] );
		}
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
