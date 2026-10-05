<?php
defined( 'ABSPATH' ) || exit;

/**
 * Registers the admin menu and mounts the React app. No application HTML is rendered in PHP.
 */
class BT_Admin_Page {

	const SLUG = 'bug-tracker';

	private $hook = '';

	public function init() {
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	public function register_menu() {
		$this->hook = add_menu_page(
			__( 'Bug Tracker', 'bug-tracker' ),
			__( 'Bug Tracker', 'bug-tracker' ),
			'view_bug_tracker',
			self::SLUG,
			array( $this, 'render' ),
			'dashicons-buddicons-bbpress-logo',
			30
		);
	}

	public function render() {
		echo '<div id="bug-tracker-root" class="bt-root"></div>';
	}

	public function enqueue( $hook ) {
		if ( $hook !== $this->hook ) {
			return;
		}
		$js  = BUG_TRACKER_PATH . 'build/app.js';
		$css = BUG_TRACKER_PATH . 'build/app.css';
		if ( ! file_exists( $js ) ) {
			add_action( 'admin_notices', function () {
				echo '<div class="notice notice-error"><p>' . esc_html__( 'Bug Tracker: compiled assets are missing. Run "npm install && npm run build" inside the plugin folder.', 'bug-tracker' ) . '</p></div>';
			} );
			return;
		}
		$ver = BUG_TRACKER_VERSION . '.' . filemtime( $js );
		if ( file_exists( $css ) ) {
			wp_enqueue_style( 'bug-tracker-app', BUG_TRACKER_URL . 'build/app.css', array(), $ver );
		}
		wp_enqueue_script( 'bug-tracker-app', BUG_TRACKER_URL . 'build/app.js', array(), $ver, true );

		$user = wp_get_current_user();
		wp_add_inline_script(
			'bug-tracker-app',
			'window.BugTrackerConfig = ' . wp_json_encode( array(
				'restUrl'  => esc_url_raw( rest_url( BUG_TRACKER_NAMESPACE . '/' ) ),
				'nonce'    => wp_create_nonce( 'wp_rest' ),
				'siteName' => get_bloginfo( 'name' ),
				'adminUrl' => admin_url(),
				'user'     => array(
					'id'     => $user->ID,
					'name'   => $user->display_name,
					'avatar' => get_avatar_url( $user->ID, array( 'size' => 64 ) ),
					'caps'   => BT_Permissions::client_caps(),
				),
			) ) . ';',
			'before'
		);
	}
}
