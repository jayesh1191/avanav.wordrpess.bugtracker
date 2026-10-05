<?php
defined( 'ABSPATH' ) || exit;

/**
 * Adds a "Bug Tracker" entry to the WordPress admin menu that simply opens the
 * standalone app URL. No application UI is rendered inside wp-admin.
 */
class BT_Admin_Page {

	const SLUG = 'bug-tracker';

	public function init() {
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
	}

	public function register_menu() {
		$hook = add_menu_page(
			__( 'Bug Tracker', 'bug-tracker' ),
			__( 'Bug Tracker', 'bug-tracker' ),
			'view_bug_tracker',
			self::SLUG,
			'__return_null',
			'dashicons-buddicons-bbpress-logo',
			30
		);
		add_action( 'load-' . $hook, function () {
			wp_safe_redirect( BT_App_Page::url() );
			exit;
		} );
	}
}
