<?php

$rules_env            = new Cetech_Pos_Bridge_Test_Environment();
$rules_env->woodmart  = false;
$rules_env->b2bking   = false;
$absent               = new Cetech_Pos_Bridge_Fake_Pricing_Rules( $rules_env );
$woodmart_absent      = $absent->woodmart_quantity_breakpoints();
br01_assert_eq( 'NOT_APPLICABLE_WITH_EVIDENCE', $woodmart_absent['applicability'], 'WoodMart absent is not a fabricated parity row' );
br01_assert_eq( array(), $woodmart_absent['breakpoints'], 'no invented WoodMart thresholds when absent' );

$b2b_absent = $absent->b2bking_commercial_rules();
br01_assert_eq( 'NOT_APPLICABLE_WITH_EVIDENCE', $b2b_absent['applicability'], 'B2BKing absent is not a fabricated parity row' );

$detected             = new Cetech_Pos_Bridge_Test_Environment();
$detected->woodmart   = true;
$detected->b2bking    = true;
$unread               = new Cetech_Pos_Bridge_Fake_Pricing_Rules( $detected );
$unread_wm            = $unread->woodmart_quantity_breakpoints();
br01_assert_eq( 'PERMISSION_REQUIRED', $unread_wm['applicability'], 'unread WoodMart config is PERMISSION_REQUIRED not PASS' );
br01_assert_eq( array(), $unread_wm['breakpoints'], 'unread WoodMart does not invent breakpoints' );
$unread_b2b           = $unread->b2bking_commercial_rules();
br01_assert_eq( 'PERMISSION_REQUIRED', $unread_b2b['applicability'], 'unread B2BKing config is PERMISSION_REQUIRED not PASS' );

$configured                      = new Cetech_Pos_Bridge_Fake_Pricing_Rules( $detected );
$configured->woodmart_records    = array(
	array( 'min_qty' => '5' ),
	array( 'min_qty' => '10' ),
);
$configured->b2bking_records     = array(
	'groups'           => array( 'group-wholesale' ),
	'customerSpecific' => true,
	'minQty'           => '2',
	'maxQty'           => null,
	'multiple'         => null,
);
$wm = $configured->woodmart_quantity_breakpoints();
br01_assert_eq( 'CONFIGURED', $wm['applicability'], 'injected runtime config is CONFIGURED' );
br01_assert_eq( array( '10', '5' ), $wm['breakpoints'], 'breakpoints come from runtime records not a formula' );
$b2b = $configured->b2bking_commercial_rules();
br01_assert_eq( 'CONFIGURED', $b2b['applicability'], 'injected B2BKing config is CONFIGURED' );
br01_assert_eq( true, $b2b['customerSpecific'], 'customer-specific flag is presence only' );
br01_assert_eq( '2', $b2b['minQty'], 'min qty is recorded from config not computed' );

$empty_records                   = new Cetech_Pos_Bridge_Fake_Pricing_Rules( $detected );
$empty_records->woodmart_records = array();
$empty_records->b2bking_records  = array();
br01_assert_eq( 'NOT_APPLICABLE_WITH_EVIDENCE', $empty_records->woodmart_quantity_breakpoints()['applicability'], 'detected but empty WoodMart rules are not synthetic parity' );
br01_assert_eq( 'NOT_APPLICABLE_WITH_EVIDENCE', $empty_records->b2bking_commercial_rules()['applicability'], 'detected but empty B2BKing rules are not synthetic parity' );

$qty_runtime = br02_fake_runtime();
$qty_runtime->catalog['walkin']['101']['4'] = array(
	'unitPrice'   => '10.00',
	'subtotal'    => '40.00',
	'discount'    => '0.00',
	'tax'         => '0.00',
	'stockStatus' => 'in_stock',
	'purchasable' => true,
);
$qty_runtime->catalog['walkin']['101']['5'] = array(
	'unitPrice'   => '9.00',
	'subtotal'    => '45.00',
	'discount'    => '0.00',
	'tax'         => '0.00',
	'stockStatus' => 'in_stock',
	'purchasable' => true,
);
$qty_runtime->catalog['walkin']['101']['6'] = array(
	'unitPrice'   => '8.00',
	'subtotal'    => '48.00',
	'discount'    => '0.00',
	'tax'         => '0.00',
	'stockStatus' => 'in_stock',
	'purchasable' => true,
);
$qty_engine = br02_engine( $qty_runtime );
$below      = $qty_engine->quote( br02_guest_request( $cart_id, $line_id_a, $location_id, '4' ) );
$at         = $qty_engine->quote( br02_guest_request( $cart_id, $line_id_a, $location_id, '5' ) );
$above      = $qty_engine->quote( br02_guest_request( $cart_id, $line_id_a, $location_id, '6' ) );
br01_assert_eq( 4000, $below['total']['minor'], 'quantity below configured breakpoint uses runtime total' );
br01_assert_eq( 4500, $at['total']['minor'], 'quantity at configured breakpoint uses runtime total' );
br01_assert_eq( 4800, $above['total']['minor'], 'quantity above configured breakpoint uses runtime total' );

$b2b_runtime = br02_fake_runtime();
$b2b_runtime->catalog['b2b:cust_b2b_1']['101']['1'] = array(
	'unitPrice'   => '6.00',
	'subtotal'    => '6.00',
	'discount'    => '0.00',
	'tax'         => '0.00',
	'stockStatus' => 'in_stock',
	'purchasable' => true,
);
$b2b_engine = br02_engine( $b2b_runtime );
$b2b_quote  = $b2b_engine->quote(
	array(
		'cartId'       => $cart_id,
		'cartRevision' => 1,
		'customer'     => array(
			'kind'       => 'b2b',
			'customerId' => 'cust_b2b_1',
		),
		'locationId'   => $location_id,
		'lines'        => array(
			array(
				'lineId'    => $line_id_a,
				'productId' => '101',
				'quantity'  => '1',
			),
		),
	)
);
br01_assert_eq( 600, $b2b_quote['total']['minor'], 'B2B context uses runtime total not a group formula' );
br01_assert( $b2b_quote['total']['minor'] !== 1000 && $b2b_quote['total']['minor'] !== 800, 'B2B total is distinct from guest and retail runtime totals' );

$overlap_runtime = br02_fake_runtime();
$overlap_runtime->catalog['b2b:cust_b2b_1']['101']['5'] = array(
	'unitPrice'   => '5.00',
	'subtotal'    => '25.00',
	'discount'    => '0.00',
	'tax'         => '0.00',
	'stockStatus' => 'in_stock',
	'purchasable' => true,
);
$overlap = br02_engine( $overlap_runtime )->quote(
	array(
		'cartId'       => $cart_id,
		'cartRevision' => 1,
		'customer'     => array(
			'kind'       => 'b2b',
			'customerId' => 'cust_b2b_1',
		),
		'locationId'   => $location_id,
		'lines'        => array(
			array(
				'lineId'    => $line_id_a,
				'productId' => '101',
				'quantity'  => '5',
			),
		),
	)
);
br01_assert_eq( 2500, $overlap['total']['minor'], 'overlap qty+B2B total is whatever the runtime returned' );
br01_assert_eq( 0, $overlap_runtime->side_effect_counts()['orders'], 'overlap quote creates no order' );
