<?php
/**
 * Plugin Name:       Bug Tracker
 * Plugin URI:        https://github.com/jayesh1191/avanav.wordrpess.bugtracker
 * Description:       A complete bug-tracking system for WordPress. The whole interface is a React single-page app talking to a custom REST API.
 * Version:           1.0.0
 * Requires at least: 5.9
 * Requires PHP:      7.4
 * Author:            Avanav
 * License:           GPL-2.0-or-later
 * Text Domain:       bug-tracker
 */

defined( 'ABSPATH' ) || exit;

define( 'BUG_TRACKER_VERSION', '1.0.0' );
define( 'BUG_TRACKER_FILE', __FILE__ );
define( 'BUG_TRACKER_PATH', plugin_dir_path( __FILE__ ) );
define( 'BUG_TRACKER_URL', plugin_dir_url( __FILE__ ) );
define( 'BUG_TRACKER_NAMESPACE', 'bug-tracker/v1' );

require_once BUG_TRACKER_PATH . 'includes/class-database.php';
require_once BUG_TRACKER_PATH . 'includes/class-settings.php';
require_once BUG_TRACKER_PATH . 'includes/class-permissions.php';
require_once BUG_TRACKER_PATH . 'includes/class-helpers.php';
require_once BUG_TRACKER_PATH . 'includes/class-notifications.php';
require_once BUG_TRACKER_PATH . 'includes/rest/class-bugs-controller.php';
require_once BUG_TRACKER_PATH . 'includes/rest/class-projects-controller.php';
require_once BUG_TRACKER_PATH . 'includes/rest/class-misc-controller.php';
require_once BUG_TRACKER_PATH . 'includes/class-rest-api.php';
require_once BUG_TRACKER_PATH . 'admin/class-admin-page.php';
require_once BUG_TRACKER_PATH . 'includes/class-plugin.php';

register_activation_hook( __FILE__, array( 'BT_Plugin', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'BT_Plugin', 'deactivate' ) );

BT_Plugin::instance();
