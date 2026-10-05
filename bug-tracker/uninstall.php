<?php
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}
require_once plugin_dir_path( __FILE__ ) . 'includes/class-database.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-settings.php';

$bt_settings = get_option( BT_Settings::OPTION, array() );
if ( ! empty( $bt_settings['uninstall']['delete_data'] ) ) {
	BT_Database::drop_tables();
	delete_option( BT_Settings::OPTION );
	foreach ( array( 'bug_tracker_manager', 'bug_tracker_contributor' ) as $bt_role ) {
		remove_role( $bt_role );
	}
	$bt_dir = trailingslashit( wp_upload_dir()['basedir'] ) . 'bug-tracker';
	if ( is_dir( $bt_dir ) ) {
		foreach ( (array) glob( $bt_dir . '/{,.}*', GLOB_BRACE ) as $bt_file ) {
			if ( is_file( $bt_file ) ) {
				wp_delete_file( $bt_file );
			}
		}
		@rmdir( $bt_dir ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
	}
}
