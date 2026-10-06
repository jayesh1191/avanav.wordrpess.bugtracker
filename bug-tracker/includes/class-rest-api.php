<?php
defined( 'ABSPATH' ) || exit;

/**
 * Registers every route under /wp-json/bug-tracker/v1/.
 *
 * Authentication is WordPress cookie auth: without a valid X-WP-Nonce header
 * WordPress treats the request as anonymous and every permission callback fails.
 */
class BT_REST_API {

	public function init() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
		add_filter( 'rest_post_dispatch', array( $this, 'refresh_nonce_header' ), 10, 3 );
	}

	/** Lets the SPA keep working after the 12–24h nonce lifetime. */
	public function refresh_nonce_header( $response, $server, $request ) {
		if ( 0 === strpos( $request->get_route(), '/' . BUG_TRACKER_NAMESPACE ) && is_user_logged_in() ) {
			$response->header( 'X-BT-Nonce', wp_create_nonce( 'wp_rest' ) );
		}
		return $response;
	}

	public function register_routes() {
		$bugs     = new BT_Bugs_Controller();
		$projects = new BT_Projects_Controller();
		$misc     = new BT_Misc_Controller();
		$ns       = BUG_TRACKER_NAMESPACE;
		$view     = BT_Permissions::require_cap( 'view_bug_tracker' );
		$create   = BT_Permissions::require_cap( 'create_bug' );
		$edit     = BT_Permissions::require_cap( 'edit_bug' );
		$delete   = BT_Permissions::require_cap( 'delete_bug' );
		$mgr_proj = BT_Permissions::require_cap( 'manage_projects' );
		$mgr      = BT_Permissions::require_cap( 'manage_bug_tracker' );
		$id       = array( 'id' => array( 'validate_callback' => function ( $v ) { return ctype_digit( (string) $v ); } ) );

		$route = function ( $path, array $handlers ) use ( $ns ) {
			register_rest_route( $ns, $path, $handlers );
		};
		$h = function ( $methods, $cb, $perm, $args = array() ) {
			return array( 'methods' => $methods, 'callback' => $cb, 'permission_callback' => $perm, 'args' => $args );
		};

		$route( '/dashboard', array( $h( 'GET', array( $misc, 'dashboard' ), $view ) ) );
		$route( '/reports', array( $h( 'GET', array( $misc, 'reports' ), $view ) ) );
		$route( '/users', array( $h( 'GET', array( $misc, 'users' ), $view ) ) );

		$route( '/bugs', array(
			$h( 'GET', array( $bugs, 'index' ), $view ),
			$h( 'POST', array( $bugs, 'create' ), $create ),
		) );
		$route( '/bugs/bulk', array( $h( 'POST', array( $bugs, 'bulk' ), $view ) ) );
		$route( '/bugs/(?P<id>\d+)', array(
			$h( 'GET', array( $bugs, 'show' ), $view, $id ),
			$h( 'PUT,PATCH', array( $bugs, 'update' ), $edit, $id ),
			$h( 'DELETE', array( $bugs, 'destroy' ), $delete, $id ),
		) );
		$route( '/bugs/(?P<id>\d+)/comments', array(
			$h( 'GET', array( $bugs, 'comments_index' ), $view, $id ),
			$h( 'POST', array( $bugs, 'comments_create' ), $create, $id ),
		) );
		$route( '/comments/(?P<id>\d+)', array( $h( 'DELETE', array( $bugs, 'comments_destroy' ), $create, $id ) ) );
		$route( '/bugs/(?P<id>\d+)/activity', array( $h( 'GET', array( $bugs, 'activity_index' ), $view, $id ) ) );
		$route( '/bugs/(?P<id>\d+)/attachments', array( $h( 'POST', array( $bugs, 'attachments_create' ), $create, $id ) ) );
		$route( '/attachments/(?P<id>\d+)', array( $h( 'DELETE', array( $bugs, 'attachments_destroy' ), $create, $id ) ) );
		$route( '/attachments/(?P<id>\d+)/download', array( $h( 'GET', array( $bugs, 'attachments_download' ), $view, $id ) ) );

		$route( '/projects', array(
			$h( 'GET', array( $projects, 'index' ), $view ),
			$h( 'POST', array( $projects, 'create' ), $mgr_proj ),
		) );
		$route( '/projects/(?P<id>\d+)', array(
			$h( 'GET', array( $projects, 'show' ), $view, $id ),
			$h( 'PUT,PATCH', array( $projects, 'update' ), $mgr_proj, $id ),
			$h( 'DELETE', array( $projects, 'destroy' ), $mgr_proj, $id ),
		) );

		$route( '/projects/(?P<id>\d+)/favorite', array( $h( 'PUT,POST', array( $projects, 'favorite' ), $view, $id ) ) );

		$route( '/notifications', array( $h( 'GET', array( $misc, 'notifications' ), $view ) ) );
		$route( '/notifications/read-all', array( $h( 'PUT', array( $misc, 'notifications_read_all' ), $view ) ) );
		$route( '/notifications/(?P<id>\d+)/read', array( $h( 'PUT', array( $misc, 'notification_read' ), $view, $id ) ) );

		$route( '/settings', array(
			$h( 'GET', array( $misc, 'settings_get' ), $view ),
			$h( 'PUT,PATCH', array( $misc, 'settings_update' ), $mgr ),
		) );
	}
}
