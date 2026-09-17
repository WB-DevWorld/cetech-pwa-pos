<?php

$catalog_correlation = '550e8400-e29b-41d4-a716-446655440000';

final class Cetech_Pos_Bridge_Test_Catalog_Product {
	public $id;
	public $parent_id         = 0;
	public $type              = 'simple';
	public $name              = 'Item';
	public $sku               = '';
	public $status            = 'publish';
	public $purchasable       = true;
	public $stock_status      = 'instock';
	public $modified          = '2026-01-15T12:00:00Z';
	public $attribute_summary = '';
	/** @var array<string,string> */
	public $attributes = array();

	public function get_id() {
		return $this->id;
	}

	public function get_parent_id() {
		return $this->parent_id;
	}

	public function get_type() {
		return $this->type;
	}

	public function get_name() {
		return $this->name;
	}

	public function get_sku() {
		return $this->sku;
	}

	public function get_status() {
		return $this->status;
	}

	public function is_purchasable() {
		return (bool) $this->purchasable;
	}

	public function get_stock_status() {
		return $this->stock_status;
	}

	public function get_date_modified() {
		return $this->modified;
	}

	public function get_attribute_summary() {
		return $this->attribute_summary;
	}

	public function get_attributes() {
		return $this->attributes;
	}
}

function stg05_product( $id, $overrides = array() ) {
	$product     = new Cetech_Pos_Bridge_Test_Catalog_Product();
	$product->id = $id;
	foreach ( $overrides as $key => $value ) {
		$product->$key = $value;
	}
	return $product;
}

function stg05_loader( $products ) {
	return static function ( $cursor, $limit, $modified_after ) use ( $products ) {
		$matched = array();
		foreach ( $products as $product ) {
			$id = (string) $product->get_id();
			if ( is_string( $cursor ) && $cursor !== '' && (int) $id <= (int) $cursor ) {
				continue;
			}
			if ( is_string( $modified_after ) && $modified_after !== '' && (string) $product->get_date_modified() < $modified_after ) {
				continue;
			}
			$matched[] = $product;
		}
		$has_more = count( $matched ) > $limit;
		return array(
			'products' => array_slice( $matched, 0, $limit ),
			'hasMore'  => $has_more,
		);
	};
}

function stg05_engine( $products ) {
	return new Cetech_Pos_Bridge_Catalog_Engine( stg05_loader( $products ) );
}

function stg05_dispatch( $engine, $headers, $params = array(), $env = null ) {
	$env          = $env instanceof Cetech_Pos_Bridge_Test_Environment ? $env : br01_authorized_env();
	$auth         = new Cetech_Pos_Bridge_Auth( $env );
	$correlation  = new Cetech_Pos_Bridge_Correlation();
	$controller   = new Cetech_Pos_Bridge_Catalog_Controller( $auth, $correlation, $engine );
	$request      = new Cetech_Pos_Bridge_Test_Request( $headers, '/cetech-pos/v1/catalog', array(), $params );
	$permission   = $controller->permission_callback( $request );
	if ( $permission !== true ) {
		$plugin = new Cetech_Pos_Bridge_Plugin( $env );
		return $plugin->normalize_error_response( $permission, null, $request );
	}
	return $controller->handle( $request );
}

$simple = stg05_product(
	101,
	array(
		'name'         => 'Simple Cable',
		'sku'          => '00123',
		'stock_status' => 'instock',
	)
);
$variable = stg05_product(
	200,
	array(
		'type'         => 'variable',
		'name'         => 'Shirt',
		'sku'          => 'SHIRT',
		'purchasable'  => false,
		'stock_status' => 'instock',
	)
);
$variation = stg05_product(
	201,
	array(
		'type'              => 'variation',
		'parent_id'         => 200,
		'name'              => 'Shirt - Blue',
		'sku'               => '00456',
		'attribute_summary' => 'Color: Blue',
		'stock_status'      => 'outofstock',
		'purchasable'       => true,
	)
);
$tombstone = stg05_product(
	300,
	array(
		'name'    => 'Retired Item',
		'sku'     => 'OLD-1',
		'status'  => 'trash',
	)
);
$grouped = stg05_product(
	400,
	array(
		'type' => 'grouped',
		'name' => 'Bundle',
		'sku'  => 'BNDL',
	)
);

$mapped_simple = Cetech_Pos_Bridge_Catalog_Engine::map_product( $simple );
br01_assert_eq( 'woocommerce', $mapped_simple['sourceSystem'], 'producer sourceSystem is Woo' );
br01_assert_eq( '101', $mapped_simple['sourceItemId'], 'simple sourceItemId is a string' );
br01_assert( is_string( $mapped_simple['sourceItemId'] ), 'sourceItemId type string' );
br01_assert_eq( 'simple', $mapped_simple['kind'], 'simple kind' );
br01_assert_eq( 'Simple Cable', $mapped_simple['name'], 'simple name' );
br01_assert_eq( '00123', $mapped_simple['sku'], 'leading-zero SKU preserved as string' );
br01_assert( is_string( $mapped_simple['sku'] ), 'sku remains a string' );
br01_assert_eq( array( '00123' ), $mapped_simple['barcodes'], 'training barcode source is SKU string' );
br01_assert_eq( 'in_stock', $mapped_simple['stockStatus'], 'instock maps to in_stock' );
br01_assert_eq( true, $mapped_simple['purchasable'], 'simple purchasable' );
br01_assert( ! isset( $mapped_simple['sourceParentId'] ), 'simple has no parent' );
br01_assert( ! isset( $mapped_simple['displayPrice'] ), 'producer omits displayPrice' );
br01_assert( ! isset( $mapped_simple['unitPrice'] ), 'producer omits unitPrice' );
br01_assert( ! isset( $mapped_simple['price'] ), 'producer omits price' );
$sku_json = json_encode( $mapped_simple );
br01_assert( strpos( $sku_json, '"00123"' ) !== false, 'JSON keeps leading-zero SKU quoted' );
br01_assert( strpos( $sku_json, ':123' ) === false && strpos( $sku_json, ':00123' ) === false, 'JSON does not emit SKU as a number' );

$mapped_variable = Cetech_Pos_Bridge_Catalog_Engine::map_product( $variable );
br01_assert_eq( 'variable', $mapped_variable['kind'], 'variable parent kind' );
br01_assert_eq( false, $mapped_variable['purchasable'], 'variable parent is not sold directly' );
br01_assert( ! isset( $mapped_variable['sourceParentId'] ), 'variable parent has no sourceParentId' );

$mapped_variation = Cetech_Pos_Bridge_Catalog_Engine::map_product( $variation );
br01_assert_eq( 'variation', $mapped_variation['kind'], 'variation kind' );
br01_assert_eq( '200', $mapped_variation['sourceParentId'], 'variation parent identity is Woo parent string' );
br01_assert_eq( '00456', $mapped_variation['sku'], 'variation leading-zero SKU preserved' );
br01_assert_eq( 'Color: Blue', $mapped_variation['variationLabel'], 'variation label from attribute summary' );
br01_assert_eq( 'out_of_stock', $mapped_variation['stockStatus'], 'outofstock maps' );

$mapped_tombstone = Cetech_Pos_Bridge_Catalog_Engine::map_product( $tombstone );
br01_assert_eq( true, $mapped_tombstone['deleted'], 'trash is a tombstone' );
br01_assert_eq( null, Cetech_Pos_Bridge_Catalog_Engine::map_product( $grouped ), 'grouped products are not catalog sellables' );

$engine = stg05_engine( array( $simple, $variable, $variation, $tombstone, $grouped ) );
$page   = $engine->page( null, 2, null );
br01_assert_eq( 2, count( $page['items'] ), 'page respects limit' );
br01_assert_eq( '101', $page['items'][0]['sourceItemId'], 'first page starts at lowest id' );
br01_assert_eq( '200', $page['nextCursor'], 'nextCursor is last included sourceItemId' );
$page2 = $engine->page( '200', 10, null );
br01_assert_eq( '201', $page2['items'][0]['sourceItemId'], 'cursor is exclusive' );
br01_assert_eq( null, $page2['nextCursor'], 'final page has no nextCursor' );

$unauth = stg05_dispatch( $engine, array( 'X-Correlation-ID' => $catalog_correlation ), array(), new Cetech_Pos_Bridge_Test_Environment() );
$unauth_payload = br01_payload( $unauth );
br01_assert_eq( 401, br01_status( $unauth ), 'catalog unauthenticated HTTP 401' );
br01_assert_eq( 'AUTH_REQUIRED', $unauth_payload['error']['code'], 'catalog AUTH_REQUIRED' );

$success = stg05_dispatch(
	$engine,
	array( 'X-Correlation-ID' => $catalog_correlation ),
	array( 'limit' => '10' )
);
$success_payload = br01_payload( $success );
br01_assert_eq( 200, br01_status( $success ), 'authorized catalog HTTP 200' );
br01_assert_eq( true, $success_payload['ok'], 'authorized catalog ok' );
br01_assert( isset( $success_payload['data']['items'] ), 'catalog data.items present' );
br01_assert( isset( $success_payload['data']['nextCursor'] ) || array_key_exists( 'nextCursor', $success_payload['data'] ), 'catalog data.nextCursor present' );
br01_assert_eq( '00123', $success_payload['data']['items'][0]['sku'], 'HTTP payload preserves leading-zero SKU' );
foreach ( $success_payload['data']['items'] as $row ) {
	br01_assert( ! isset( $row['displayPrice'] ), 'HTTP catalog row omits displayPrice' );
	br01_assert( ! isset( $row['posItemId'] ), 'producer does not assign POS ids' );
}
$encoded = json_encode( $success_payload );
br01_assert( strpos( $encoded, 'cetech_pos_bridge_access' ) === false, 'catalog success does not leak capability name' );
br01_assert( stripos( $encoded, 'password' ) === false, 'catalog success has no password field' );
br01_assert( strpos( $encoded, 'ABSPATH' ) === false, 'catalog success has no filesystem constant' );

$bad_limit = stg05_dispatch(
	$engine,
	array( 'X-Correlation-ID' => $catalog_correlation ),
	array( 'limit' => '0' )
);
br01_assert_eq( 'VALIDATION_ERROR', br01_payload( $bad_limit )['error']['code'], 'limit 0 is validation' );

$bad_cursor = stg05_dispatch(
	$engine,
	array( 'X-Correlation-ID' => $catalog_correlation ),
	array( 'cursor' => 'abc' )
);
br01_assert_eq( 'VALIDATION_ERROR', br01_payload( $bad_cursor )['error']['code'], 'non-numeric cursor is validation' );

$bad_since = stg05_dispatch(
	$engine,
	array( 'X-Correlation-ID' => $catalog_correlation ),
	array( 'modifiedAfter' => 'yesterday' )
);
br01_assert_eq( 'VALIDATION_ERROR', br01_payload( $bad_since )['error']['code'], 'invalid modifiedAfter is validation' );

$unavailable_engine = new Cetech_Pos_Bridge_Catalog_Engine(
	static function () {
		return 'unavailable';
	}
);
$unavailable = stg05_dispatch( $unavailable_engine, array( 'X-Correlation-ID' => $catalog_correlation ) );
br01_assert_eq( 503, br01_status( $unavailable ), 'missing Woo listing is 503' );
br01_assert_eq( 'INTEGRATION_UNAVAILABLE', br01_payload( $unavailable )['error']['code'], 'missing Woo listing code' );

$missing = stg05_dispatch( $engine, array() );
br01_assert_eq( 'VALIDATION_ERROR', br01_payload( $missing )['error']['code'], 'catalog requires correlation' );

$plugin = new Cetech_Pos_Bridge_Plugin( br01_authorized_env() );
$plugin->register_routes();
$plugin_routes = $plugin->get_registered_routes();
br01_assert_eq( '/catalog', $plugin_routes[10]['route'], 'plugin exposes GET /catalog' );
br01_assert( $plugin->get_catalog_controller() instanceof Cetech_Pos_Bridge_Catalog_Controller, 'catalog controller is wired' );
