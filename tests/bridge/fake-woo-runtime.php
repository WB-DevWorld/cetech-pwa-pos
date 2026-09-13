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
