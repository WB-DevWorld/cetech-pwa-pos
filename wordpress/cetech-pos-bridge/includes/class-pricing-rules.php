<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads whether pricing rules are configured. Does not compute WoodMart or B2BKing prices.
 */
class Cetech_Pos_Bridge_Pricing_Rules {
	/** @var Cetech_Pos_Bridge_Environment */
	protected $environment;

	public function __construct( Cetech_Pos_Bridge_Environment $environment ) {
		$this->environment = $environment;
	}

	/**
	 * @return array{applicability:string,breakpoints:array<int,string>,source:string,reason:string}
	 */
	public function woodmart_quantity_breakpoints() {
		if ( ! $this->environment->woodmart_available() ) {
			return $this->none( 'NOT_APPLICABLE_WITH_EVIDENCE', 'WoodMart is not detected.' );
		}
		$raw = $this->read_woodmart_discount_records();
		if ( $raw === null ) {
			return $this->none( 'PERMISSION_REQUIRED', 'WoodMart configuration is not readable in this process; live capture is not authorized from this tree.' );
		}
		if ( $raw === array() ) {
			return $this->none( 'NOT_APPLICABLE_WITH_EVIDENCE', 'WoodMart is detected but no quantity-discount records were present.' );
		}
		$breakpoints = array();
		foreach ( $raw as $record ) {
			if ( isset( $record['min_qty'] ) && is_string( $record['min_qty'] ) && preg_match( Cetech_Pos_Bridge_Constants::QUANTITY_PATTERN, $record['min_qty'] ) ) {
				$breakpoints[] = $record['min_qty'];
			}
		}
		$breakpoints = array_values( array_unique( $breakpoints ) );
		sort( $breakpoints, SORT_STRING );
		if ( $breakpoints === array() ) {
			return $this->none( 'NOT_APPLICABLE_WITH_EVIDENCE', 'WoodMart discount records existed but contained no canonical quantity breakpoints.' );
		}
		return array(
			'applicability' => 'CONFIGURED',
			'breakpoints'   => $breakpoints,
			'source'        => 'woodmart-runtime-config',
			'reason'        => 'Quantity breakpoints read from runtime configuration only; prices still come from Woo calculate_totals.',
		);
	}

	/**
	 * @return array{applicability:string,groups:array<int,string>,customerSpecific:bool,minQty:?string,maxQty:?string,multiple:?string,source:string,reason:string}
	 */
	public function b2bking_commercial_rules() {
		if ( ! $this->environment->b2bking_available() ) {
			return $this->b2b_none( 'NOT_APPLICABLE_WITH_EVIDENCE', 'B2BKing is not detected.' );
		}
		$raw = $this->read_b2bking_rule_records();
		if ( $raw === null ) {
			return $this->b2b_none( 'PERMISSION_REQUIRED', 'B2BKing configuration is not readable in this process; live capture is not authorized from this tree.' );
		}
		if ( $raw === array() ) {
			return $this->b2b_none( 'NOT_APPLICABLE_WITH_EVIDENCE', 'B2BKing is detected but no commercial rule records were present.' );
		}
		return array(
			'applicability'     => 'CONFIGURED',
			'groups'            => isset( $raw['groups'] ) && is_array( $raw['groups'] ) ? $raw['groups'] : array(),
			'customerSpecific'  => ! empty( $raw['customerSpecific'] ),
			'minQty'            => isset( $raw['minQty'] ) ? $raw['minQty'] : null,
			'maxQty'            => isset( $raw['maxQty'] ) ? $raw['maxQty'] : null,
			'multiple'          => isset( $raw['multiple'] ) ? $raw['multiple'] : null,
			'source'            => 'b2bking-runtime-config',
			'reason'            => 'Commercial rule presence read from runtime configuration only; prices still come from Woo calculate_totals.',
		);
	}

	/**
	 * Live WoodMart internals are not a pricing formula. Returns null when unreadably absent.
	 *
	 * @return array<int,array<string,mixed>>|null
	 */
	protected function read_woodmart_discount_records() {
		return null;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	protected function read_b2bking_rule_records() {
		return null;
	}

	protected function none( $applicability, $reason ) {
		return array(
			'applicability' => $applicability,
			'breakpoints'   => array(),
			'source'        => 'none',
			'reason'        => $reason,
		);
	}

	protected function b2b_none( $applicability, $reason ) {
		return array(
			'applicability'    => $applicability,
			'groups'           => array(),
			'customerSpecific' => false,
			'minQty'           => null,
			'maxQty'           => null,
			'multiple'         => null,
			'source'           => 'none',
			'reason'           => $reason,
		);
	}
}
