<?php

$customers_correlation = '550e8400-e29b-41d4-a716-446655440099';

$engine = new Cetech_Pos_Bridge_Customers_Engine(
	function ( $query ) {
		$users = array(
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
		);
		$trimmed = is_string( $query ) ? strtolower( trim( $query ) ) : '';
		if ( $trimmed === '' ) {
			return array( 'users' => $users );
		}
		$matched = array();
		foreach ( $users as $user ) {
			$haystack = strtolower(
				$user['display_name'] . ' ' .
				( isset( $user['billing_company'] ) ? $user['billing_company'] : '' ) . ' ' .
				( isset( $user['billing_phone'] ) ? $user['billing_phone'] : '' )
			);
			if ( strpos( $haystack, $trimmed ) !== false ) {
				$matched[] = $user;
			}
		}
		return array( 'users' => $matched );
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

$name = $engine->search( 'Ada', 50 );
br01_assert_eq( 1, count( $name['items'] ), 'name search matches display name' );
br01_assert_eq( '12', $name['items'][0]['id'], 'name search returns Ada' );

$company = $engine->search( 'Accra', 50 );
br01_assert_eq( 1, count( $company['items'] ), 'company search matches billing company' );
br01_assert_eq( '44', $company['items'][0]['id'], 'company search returns wholesale customer' );

$phone = $engine->search( '024123', 50 );
br01_assert_eq( 1, count( $phone['items'] ), 'phone search matches billing phone' );
br01_assert_eq( '12', $phone['items'][0]['id'], 'phone search returns Ada' );

$queries = Cetech_Pos_Bridge_Customers_Engine::woo_user_queries( 'Accra', 50 );
br01_assert_eq( 2, count( $queries ), 'name and meta queries are both issued' );
br01_assert_eq( array( 'user_login', 'user_email', 'display_name' ), $queries[0]['search_columns'], 'standard search uses WP identity columns' );
br01_assert_eq( 'OR', $queries[1]['meta_query']['relation'], 'meta search is OR' );
br01_assert_eq( 'billing_company', $queries[1]['meta_query'][0]['key'], 'meta search includes billing company' );
br01_assert_eq( 'billing_phone', $queries[1]['meta_query'][1]['key'], 'meta search includes billing phone' );

$merged = Cetech_Pos_Bridge_Customers_Engine::merge_users_by_id(
	array(
		array( 'ID' => 12, 'display_name' => 'Ada' ),
		array( 'ID' => 12, 'display_name' => 'Ada duplicate' ),
		array( 'ID' => 44, 'display_name' => 'Buildworks' ),
	),
	50
);
br01_assert_eq( 2, count( $merged ), 'duplicate customer ids are merged' );

$capped = Cetech_Pos_Bridge_Customers_Engine::merge_users_by_id(
	array(
		array( 'ID' => 1, 'display_name' => 'A' ),
		array( 'ID' => 2, 'display_name' => 'B' ),
		array( 'ID' => 3, 'display_name' => 'C' ),
	),
	2
);
br01_assert_eq( 2, count( $capped ), 'merge respects the result limit' );

$plugin = new Cetech_Pos_Bridge_Plugin( new Cetech_Pos_Bridge_Environment() );
$plugin->register_routes();
$routes = $plugin->get_registered_routes();
$last   = $routes[ count( $routes ) - 1 ];
br01_assert_eq( Cetech_Pos_Bridge_Constants::CUSTOMERS_ROUTE, $last['route'], 'customers route registered' );
unset( $customers_correlation );
