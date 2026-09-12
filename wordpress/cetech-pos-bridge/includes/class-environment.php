<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Thin adapter over WordPress public/runtime APIs so health can be tested
 * without a live WordPress install. Does not grant capabilities or mutate commerce.
 */
class Cetech_Pos_Bridge_Environment {
	public function is_user_logged_in() {
		return function_exists( 'is_user_logged_in' ) && is_user_logged_in();
	}

	public function current_user_can( $capability ) {
		return function_exists( 'current_user_can' ) && current_user_can( $capability );
	}

	public function class_exists( $class_name ) {
		return class_exists( $class_name );
	}

	public function function_exists( $function_name ) {
		return function_exists( $function_name );
	}

	public function defined_constant( $name ) {
		return defined( $name );
	}

	public function is_plugin_active( $basename ) {
		if ( ! function_exists( 'is_plugin_active' ) && defined( 'ABSPATH' ) ) {
			$plugin_api = ABSPATH . 'wp-admin/includes/plugin.php';
			if ( is_readable( $plugin_api ) ) {
				include_once $plugin_api;
			}
		}
		return function_exists( 'is_plugin_active' ) && is_plugin_active( $basename );
	}

	public function wc_available() {
		if ( $this->defined_constant( 'WC_VERSION' ) ) {
			return true;
		}
		if ( $this->class_exists( 'WooCommerce' ) ) {
			return true;
		}
		if ( $this->function_exists( 'WC' ) ) {
			$wc = WC();
			return is_object( $wc );
		}
		return $this->is_plugin_active( Cetech_Pos_Bridge_Constants::WOO_PLUGIN_BASENAME );
	}

	/**
	 * Detect WoodMart via active theme stylesheet or parent/template slug.
	 * Does not execute WoodMart pricing.
	 */
	public function woodmart_available() {
		if ( ! function_exists( 'wp_get_theme' ) ) {
			return false;
		}
		$theme = wp_get_theme();
		if ( ! is_object( $theme ) ) {
			return false;
		}
		$slug = Cetech_Pos_Bridge_Constants::WOODMART_THEME_SLUG;
		if ( $this->theme_matches( $theme, $slug ) ) {
			return true;
		}
		if ( method_exists( $theme, 'parent' ) ) {
			$parent = $theme->parent();
			if ( is_object( $parent ) && $this->theme_matches( $parent, $slug ) ) {
				return true;
			}
		}
		return false;
	}

	private function theme_matches( $theme, $slug ) {
		$stylesheet = method_exists( $theme, 'get_stylesheet' ) ? strtolower( (string) $theme->get_stylesheet() ) : '';
		$template   = method_exists( $theme, 'get_template' ) ? strtolower( (string) $theme->get_template() ) : '';
		return $stylesheet === $slug || $template === $slug;
	}

	/**
	 * Detect B2BKing via public class/constant/plugin-active signals only.
	 * Does not invoke commercial/pricing hooks.
	 */
	public function b2bking_available() {
		if ( $this->class_exists( 'B2bking' ) || $this->class_exists( 'B2Bking' ) ) {
			return true;
		}
		if ( $this->defined_constant( 'B2BKING_DIR' ) || $this->defined_constant( 'B2BKING_VERSION' ) ) {
			return true;
		}
		foreach ( Cetech_Pos_Bridge_Constants::B2BKING_PLUGIN_BASENAMES as $basename ) {
			if ( $this->is_plugin_active( $basename ) ) {
				return true;
			}
		}
		return false;
	}
}
