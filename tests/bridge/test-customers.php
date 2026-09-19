<?php

$customers_correlation = '550e8400-e29b-41d4-a716-446655440099';

$engine = new Cetech_Pos_Bridge_Customers_Engine(
	function () {
		return array(
			'users' => array(
				array(
					'ID'           => 12,
					'display_name' => 'Ada Boateng',
					'billing_phone' => '0241234567',
					'b2bking_b2buser' => '',
				),
				array(
					'ID'           => 44,
					'display_name' => 'Accra Buildworks Ltd',
					'billing_company' => 'Accra Buildworks Ltd',
					'billing_phone' => '0209988776',
					'b2bking_b2buser' => 'yes',
					'b2bking_group_name' => 'Trade account',
				),
			),
		);
	}
);

$page = $engine->search( '', 50 );
br01_assert( is_array( $page ) && isset( $page['items'] ), 'customers engine returns items' );
br01_assert_eq( 2, count( $page['items'] ), 'customers engine item count' );
br01_assert_eq( 'retail', $page['items'][0]['kind'], 'retail customer kind' );
br01_assert_eq( 'b2b', $page['items'][1]['kind'], 'b2b customer kind' );
br01_assert( strpos( $page['items'][0]['phoneMasked'], '***' ) !== false, 'phone is masked' );
br01_assert_eq( 'Trade account', $page['items'][1]['commercialContext'], 'optional commercial context is a label only' );
br01_assert( ! isset( $page['items'][1]['price'] ), 'customer payload has no price' );

$plugin = new Cetech_Pos_Bridge_Plugin( new Cetech_Pos_Bridge_Environment() );
$plugin->register_routes();
$routes = $plugin->get_registered_routes();
$last   = $routes[ count( $routes ) - 1 ];
br01_assert_eq( Cetech_Pos_Bridge_Constants::CUSTOMERS_ROUTE, $last['route'], 'customers route registered' );
unset( $customers_correlation );
