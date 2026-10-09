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
			( new BT_Settings_Page() )->init();
		}
	}

	public static function activate() {
		BT_Database::create_tables();
		BT_Users::maybe_migrate(); // converts legacy role-based users on upgrades (no-op on fresh installs)
		// Secure initial setup: activating the plugin is a privileged WordPress action, so a site
		// administrator doing it becomes the first Bug Tracker Admin. If nobody is assigned yet
		// (e.g. WP-CLI / network activation) the app stays locked until a site admin assigns one.
		if ( ! BT_Users::admin_id() && current_user_can( 'manage_options' ) ) {
			BT_Users::set_admin( get_current_user_id() );
		}
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
