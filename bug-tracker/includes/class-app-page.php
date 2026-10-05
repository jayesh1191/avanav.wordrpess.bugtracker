<?php
defined( 'ABSPATH' ) || exit;

/**
 * Serves the React app on its own front-end URL (/bug-tracker/), outside wp-admin.
 * Only a bare HTML shell is printed; the theme and wp-admin are not involved.
 */
class BT_App_Page {

	const QUERY_VAR = 'bug_tracker_app';

	public static function slug() {
		return sanitize_title( apply_filters( 'bug_tracker_app_slug', 'bug-tracker' ) );
	}

	/** Public URL of the app. Works with pretty and plain permalinks. */
	public static function url( $hash = '' ) {
		$base = get_option( 'permalink_structure' ) ? home_url( '/' . self::slug() . '/' ) : add_query_arg( self::QUERY_VAR, '1', home_url( '/' ) );
		return $hash ? $base . '#' . ltrim( $hash, '#' ) : $base;
	}

	public function init() {
		add_action( 'init', array( __CLASS__, 'add_rewrite' ) );
		add_filter( 'query_vars', function ( $vars ) {
			$vars[] = self::QUERY_VAR;
			return $vars;
		} );
		add_action( 'template_redirect', array( $this, 'maybe_render' ), 0 );
		add_filter( 'redirect_canonical', array( $this, 'no_canonical_redirect' ) );
	}

	public static function add_rewrite() {
		add_rewrite_rule( '^' . preg_quote( self::slug(), '#' ) . '/?$', 'index.php?' . self::QUERY_VAR . '=1', 'top' );
	}

	public function no_canonical_redirect( $url ) {
		return get_query_var( self::QUERY_VAR ) ? false : $url;
	}

	public function maybe_render() {
		if ( ! get_query_var( self::QUERY_VAR ) ) {
			return;
		}
		if ( ! is_user_logged_in() ) {
			wp_safe_redirect( wp_login_url( self::url() ) );
			exit;
		}
		if ( ! current_user_can( 'view_bug_tracker' ) ) {
			wp_die( esc_html__( 'You do not have access to the Bug Tracker.', 'bug-tracker' ), esc_html__( 'Access denied', 'bug-tracker' ), array( 'response' => 403 ) );
		}
		$this->render();
		exit;
	}

	private function render() {
		nocache_headers();
		header( 'Content-Type: text/html; charset=' . get_bloginfo( 'charset' ) );
		header( 'X-Robots-Tag: noindex, nofollow' );

		$js  = BUG_TRACKER_PATH . 'build/app.js';
		$css = BUG_TRACKER_PATH . 'build/app.css';
		$ver = BUG_TRACKER_VERSION . '.' . ( file_exists( $js ) ? filemtime( $js ) : 0 );
		$user = wp_get_current_user();
		$cfg  = array(
			'restUrl'  => esc_url_raw( rest_url( BUG_TRACKER_NAMESPACE . '/' ) ),
			'nonce'    => wp_create_nonce( 'wp_rest' ),
			'siteName' => get_bloginfo( 'name' ),
			'adminUrl' => admin_url(),
			'homeUrl'  => home_url( '/' ),
			'logoutUrl' => wp_logout_url( self::url() ),
			'user'     => array(
				'id'     => $user->ID,
				'name'   => $user->display_name,
				'avatar' => get_avatar_url( $user->ID, array( 'size' => 64 ) ),
				'caps'   => BT_Permissions::client_caps(),
			),
		);
		?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="robots" content="noindex,nofollow">
	<title><?php echo esc_html( sprintf( '%s — %s', __( 'Bug Tracker', 'bug-tracker' ), get_bloginfo( 'name' ) ) ); ?></title>
	<?php if ( file_exists( $css ) ) : ?>
	<link rel="stylesheet" href="<?php echo esc_url( BUG_TRACKER_URL . 'build/app.css?ver=' . $ver ); ?>">
	<?php endif; ?>
	<style>html,body{margin:0;padding:0}</style>
</head>
<body class="bug-tracker-app">
	<div id="bug-tracker-root"></div>
	<noscript><p style="padding:2rem;font-family:sans-serif"><?php esc_html_e( 'Bug Tracker needs JavaScript.', 'bug-tracker' ); ?></p></noscript>
	<?php if ( file_exists( $js ) ) : ?>
	<script>window.BugTrackerConfig = <?php echo wp_json_encode( $cfg ); ?>;</script>
	<script src="<?php echo esc_url( BUG_TRACKER_URL . 'build/app.js?ver=' . $ver ); ?>"></script>
	<?php else : ?>
	<p style="padding:2rem;font-family:sans-serif"><?php esc_html_e( 'Bug Tracker: compiled assets are missing. Run "npm install && npm run build" in the plugin folder.', 'bug-tracker' ); ?></p>
	<?php endif; ?>
</body>
</html>
		<?php
	}
}
