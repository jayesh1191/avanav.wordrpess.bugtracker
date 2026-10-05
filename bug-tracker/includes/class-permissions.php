<?php
defined( 'ABSPATH' ) || exit;

/**
 * Capabilities, roles and per-record access checks.
 */
class BT_Permissions {

	public static function capabilities() {
		return array(
			'view_bug_tracker'         => 'View the bug tracker and the bugs of projects the user belongs to',
			'create_bug'               => 'Report new bugs, comment and attach files',
			'edit_bug'                 => 'Edit bugs (status, priority, assignee, ...)',
			'delete_bug'               => 'Delete bugs and comments',
			'manage_projects'          => 'Create/edit/delete projects and see every project',
			'manage_bug_tracker'       => 'Change bug tracker settings',
			'manage_bug_tracker_users' => 'See user e-mails and edit role permissions',
		);
	}

	public static function default_role_caps() {
		$all = array_keys( self::capabilities() );
		return array(
			'administrator'           => $all,
			'bug_tracker_manager'     => array( 'read', 'view_bug_tracker', 'create_bug', 'edit_bug', 'delete_bug', 'manage_projects' ),
			'bug_tracker_contributor' => array( 'read', 'view_bug_tracker', 'create_bug', 'edit_bug' ),
		);
	}

	public static function install_roles() {
		$names = array(
			'bug_tracker_manager'     => __( 'Bug Tracker Project Manager', 'bug-tracker' ),
			'bug_tracker_contributor' => __( 'Bug Tracker Contributor', 'bug-tracker' ),
		);
		foreach ( self::default_role_caps() as $role => $caps ) {
			$obj = get_role( $role );
			if ( ! $obj ) {
				$obj = add_role( $role, $names[ $role ] ?? $role, array( 'read' => true ) );
			}
			if ( $obj ) {
				foreach ( $caps as $cap ) {
					$obj->add_cap( $cap );
				}
			}
		}
	}

	public static function remove_roles() {
		remove_role( 'bug_tracker_manager' );
		remove_role( 'bug_tracker_contributor' );
		global $wp_roles;
		foreach ( $wp_roles->role_objects as $role ) {
			foreach ( array_keys( self::capabilities() ) as $cap ) {
				$role->remove_cap( $cap );
			}
		}
	}

	/* ---- REST permission callbacks ---------------------------------- */

	/** Returns a permission_callback requiring the given capability. */
	public static function require_cap( $cap ) {
		return function () use ( $cap ) {
			if ( ! is_user_logged_in() ) {
				return new WP_Error( 'bt_unauthenticated', __( 'You must be logged in.', 'bug-tracker' ), array( 'status' => 401 ) );
			}
			if ( ! current_user_can( $cap ) ) {
				return new WP_Error( 'bt_forbidden', __( 'You do not have permission to do that.', 'bug-tracker' ), array( 'status' => 403 ) );
			}
			return true;
		};
	}

	/* ---- Project scoping -------------------------------------------- */

	/** Can the user see every project? */
	public static function sees_all_projects( $user_id = 0 ) {
		$user_id = $user_id ? $user_id : get_current_user_id();
		if ( user_can( $user_id, 'manage_projects' ) || user_can( $user_id, 'manage_bug_tracker' ) ) {
			return true;
		}
		return ! BT_Settings::get()['project']['restrict_to_members'];
	}

	/**
	 * Project ids the user may see, or null for "all".
	 */
	public static function accessible_project_ids( $user_id = 0 ) {
		global $wpdb;
		$user_id = $user_id ? $user_id : get_current_user_id();
		if ( self::sees_all_projects( $user_id ) ) {
			return null;
		}
		$pm  = BT_Database::table( 'project_members' );
		$p   = BT_Database::table( 'projects' );
		$ids = $wpdb->get_col( $wpdb->prepare(
			"SELECT project_id FROM $pm WHERE user_id = %d UNION SELECT id FROM $p WHERE lead_id = %d OR created_by = %d", // phpcs:ignore WordPress.DB.PreparedSQL
			$user_id, $user_id, $user_id
		) );
		return array_map( 'intval', $ids );
	}

	/** SQL fragment restricting a bugs query to what the current user may see. */
	public static function bug_scope_sql( $alias = 'b' ) {
		global $wpdb;
		$ids = self::accessible_project_ids();
		if ( null === $ids ) {
			return '1=1';
		}
		$uid = get_current_user_id();
		$sql = $wpdb->prepare( "($alias.reporter_id = %d OR $alias.assignee_id = %d", $uid, $uid ); // phpcs:ignore WordPress.DB.PreparedSQL
		if ( $ids ) {
			$sql .= " OR $alias.project_id IN (" . implode( ',', array_map( 'intval', $ids ) ) . ')';
		}
		return $sql . ')';
	}

	public static function can_access_project( $project_id ) {
		$ids = self::accessible_project_ids();
		return null === $ids || in_array( (int) $project_id, $ids, true );
	}

	public static function can_access_bug( $bug ) {
		$uid = get_current_user_id();
		return self::can_access_project( $bug->project_id )
			|| (int) $bug->reporter_id === $uid
			|| (int) $bug->assignee_id === $uid;
	}

	/** Mutating a bug requires the capability *and* access to it. */
	public static function can_edit_bug( $bug ) {
		return current_user_can( 'edit_bug' ) && self::can_access_bug( $bug );
	}

	public static function can_delete_bug( $bug ) {
		if ( ! current_user_can( 'delete_bug' ) || ! self::can_access_bug( $bug ) ) {
			return false;
		}
		return current_user_can( 'manage_projects' ) || (int) $bug->reporter_id === get_current_user_id();
	}

	/** Permission flags exposed to the client (UI hints only; the server enforces). */
	public static function client_caps() {
		$out = array();
		foreach ( array_keys( self::capabilities() ) as $cap ) {
			$out[ $cap ] = current_user_can( $cap );
		}
		return $out;
	}
}
