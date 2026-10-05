<?php
defined( 'ABSPATH' ) || exit;

class BT_Plugin {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'plugins_loaded', array( 'BT_Database', 'maybe_upgrade' ) );
		( new BT_REST_API() )->init();
		( new BT_App_Page() )->init();
		if ( is_admin() ) {
			( new BT_Admin_Page() )->init();
		}
	}

	public static function activate() {
		BT_Database::create_tables();
		BT_Permissions::install_roles();
		if ( false === get_option( BT_Settings::OPTION ) ) {
			add_option( BT_Settings::OPTION, BT_Settings::defaults(), '', false );
		}
		BT_Helpers::upload_dir();
		BT_App_Page::add_rewrite();
		flush_rewrite_rules();
	}

	public static function deactivate() {
		// Data and roles are kept so re-activation loses nothing.
		flush_rewrite_rules();
	}
}
