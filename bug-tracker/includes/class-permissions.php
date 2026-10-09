<?php
defined( 'ABSPATH' ) || exit;

/**
 * Authorisation for the Bug Tracker.
 *
 * WordPress provides *authentication only* (who is logged in). Authorisation is the
 * plugin's own: the registry in BT_Users (status + per-user permissions), the single
 * Bug Tracker Admin, and explicit project assignments. WordPress roles and
 * capabilities are never consulted here.
 *
 * Permission names (kept stable for the REST layer and the UI):
 *   view_bug_tracker          any active tracker user
 *   create_bug / edit_bug / delete_bug / manage_projects   per-user flags
 *   manage_bug_tracker / manage_bug_tracker_users           Bug Tracker Admin only
 */
class BT_Permissions {

	const ADMIN_ONLY = array( 'manage_bug_tracker', 'manage_bug_tracker_users' );

	public static function permission_names() {
		return array_merge( array( 'view_bug_tracker' ), BT_Users::PERMISSION_IDS, self::ADMIN_ONLY );
	}

	/** Can a given WordPress user (default: current) exercise a permission? */
	public static function user_can( $user_id, $permission ) {
		$user_id = (int) $user_id;
		if ( $user_id <= 0 ) {
			return false;
		}
		$row = BT_Users::active_row( $user_id );
		if ( ! $row ) {
			return false;
		}
		if ( BT_Users::is_admin( $user_id ) ) {
			return true; // The Bug Tracker Admin holds every permission.
		}
		if ( 'view_bug_tracker' === $permission ) {
			return true;
		}
		if ( in_array( $permission, self::ADMIN_ONLY, true ) ) {
			return false;
		}
		return in_array( $permission, BT_Users::row_permissions( $row ), true );
	}

	public static function can( $permission ) {
		return self::user_can( get_current_user_id(), $permission );
	}

	/* ---- REST permission callbacks ---------------------------------- */

	/** Returns a permission_callback requiring the given plugin permission. */
	public static function require_cap( $permission ) {
		return function () use ( $permission ) {
			if ( ! is_user_logged_in() ) {
				return new WP_Error( 'bt_unauthenticated', __( 'You must be logged in.', 'bug-tracker' ), array( 'status' => 401 ) );
			}
			if ( ! self::can( $permission ) ) {
				return new WP_Error( 'bt_forbidden', __( 'You do not have permission to do that.', 'bug-tracker' ), array( 'status' => 403 ) );
			}
			return true;
		};
	}

	/* ---- Project scoping -------------------------------------------- */

	/** Only the Bug Tracker Admin sees every project. */
	public static function sees_all_projects( $user_id = 0 ) {
		$user_id = $user_id ? (int) $user_id : get_current_user_id();
		return BT_Users::is_admin( $user_id ) && null !== BT_Users::active_row( $user_id );
	}

	/**
	 * Project ids the user may access, or null for "all" (Bug Tracker Admin).
	 * Everyone else: explicit assignments only, and only while active.
	 */
	public static function accessible_project_ids( $user_id = 0 ) {
		global $wpdb;
		$user_id = $user_id ? (int) $user_id : get_current_user_id();
		if ( self::sees_all_projects( $user_id ) ) {
			return null;
		}
		if ( ! BT_Users::active_row( $user_id ) ) {
			return array();
		}
		$ids = $wpdb->get_col( $wpdb->prepare( 'SELECT project_id FROM ' . BT_Database::table( 'project_members' ) . ' WHERE user_id = %d', $user_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		return array_map( 'intval', $ids );
	}

	/** SQL fragment restricting a bugs query to the current user's projects. */
	public static function bug_scope_sql( $alias = 'b' ) {
		$ids = self::accessible_project_ids();
		if ( null === $ids ) {
			return '1=1';
		}
		return $ids ? "$alias.project_id IN (" . implode( ',', array_map( 'intval', $ids ) ) . ')' : '1=0';
	}

	public static function can_access_project( $project_id ) {
		$ids = self::accessible_project_ids();
		return null === $ids || in_array( (int) $project_id, $ids, true );
	}

	public static function can_access_bug( $bug ) {
		return self::can_access_project( $bug->project_id );
	}

	/** Mutating a bug requires the permission *and* access to its project. */
	public static function can_edit_bug( $bug ) {
		return self::can( 'edit_bug' ) && self::can_access_bug( $bug );
	}

	public static function can_delete_bug( $bug ) {
		return self::can( 'delete_bug' ) && self::can_access_bug( $bug );
	}

	/** Permission flags exposed to the client (UI hints only; the server enforces). */
	public static function client_caps() {
		$out = array();
		foreach ( self::permission_names() as $p ) {
			$out[ $p ] = self::can( $p );
		}
		return $out;
	}
}
