<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Side-effect-free dependency detection. Never mutates cart, customer, order,
 * stock, or payment state. Detection is not pricing parity.
 */
final class Cetech_Pos_Bridge_Detector {
	/** @var Cetech_Pos_Bridge_Environment */
	private $environment;

	public function __construct( Cetech_Pos_Bridge_Environment $environment ) {
		$this->environment = $environment;
	}

	/**
	 * Frozen v1 BridgeHealth.pricingParityVerified is a global boolean with no
	 * environment or bridge-artifact identity. Training R3 evidence is recorded
	 * separately. This field stays false so unverified environments are not claimed.
	 *
	 * @return array{status:string,contractVersion:string,wooDetected:bool,woodmartDetected:bool,b2bkingDetected:bool,pricingParityVerified:false}
	 */
	public function detect() {
		$woo      = (bool) $this->environment->wc_available();
		$woodmart = (bool) $this->environment->woodmart_available();
		$b2bking  = (bool) $this->environment->b2bking_available();

		if ( ! $woo ) {
			$status = 'unavailable';
		} elseif ( ! $woodmart || ! $b2bking ) {
			$status = 'degraded';
		} else {
			$status = 'healthy';
		}

		return array(
			'status'                => $status,
			'contractVersion'       => Cetech_Pos_Bridge_Constants::CONTRACT,
			'wooDetected'           => $woo,
			'woodmartDetected'      => $woodmart,
			'b2bkingDetected'       => $b2bking,
			'pricingParityVerified' => false,
		);
	}
}
