<?php
defined( 'ABSPATH' ) || exit;

/**
 * Plugin-owned user registry. A WordPress account is only *authentication*; whether
 * somebody may use the Bug Tracker, and with which permissions, is decided here and
 * never by WordPress roles or capabilities.
 *
 * Statuses:  active   – may use the tracker
 *            inactive – account kept (history intact) but access suspended
 *            removed  – no longer part of the tracker; row kept for audit/history
 */
class BT_Users {

	const ADMIN_OPTION    = 'bug_tracker_admin_user_id';
	const MIGRATED_OPTION = 'bug_tracker_users_migrated';

	/** Untranslated permission identifiers (safe to use before `init`). */
	const PERMISSION_IDS = array( 'create_bug', 'edit_bug', 'delete_bug', 'manage_projects' );

	/** Per-user permissions an admin can toggle, with labels. (Admin-only powers are not in this list.) */
	public static function permission_keys() {
		return array(
			'create_bug'      => __( 'Report bugs, comment and attach files', 'bug-tracker' ),
			'edit_bug'        => __( 'Edit bugs (status, priority, assignee…)', 'bug-tracker' ),
			'delete_bug'      => __( 'Delete bugs and comments', 'bug-tracker' ),
			'manage_projects' => __( 'Create, edit and delete projects they can access', 'bug-tracker' ),
		);
	}

	public static function default_permissions() {
		return array( 'create_bug', 'edit_bug' );
	}

	public static function sanitize_permissions( $in ) {
		$in = is_array( $in ) ? $in : array();
		return array_values( array_intersect( self::PERMISSION_IDS, array_map( 'sanitize_key', $in ) ) );
	}

	/* ---------------------------------------------------------------- */
	/* Admin                                                            */
	/* ---------------------------------------------------------------- */

	/** WordPress user id of the Bug Tracker Admin (0 = not assigned yet). */
	public static function admin_id() {
		$id = (int) get_option( self::ADMIN_OPTION, 0 );
		return ( $id && get_userdata( $id ) ) ? $id : 0;
	}

	/**
	 * Assign the Bug Tracker Admin. The caller must already have verified that the
	 * actor is a site administrator (see BT_Settings_Page / activation).
	 */
	public static function set_admin( $user_id ) {
		$user_id = (int) $user_id;
		if ( ! $user_id || ! get_userdata( $user_id ) ) {
			return new WP_Error( 'bt_invalid_user', __( 'That user does not exist.', 'bug-tracker' ), array( 'status' => 400 ) );
		}
		$prev = self::admin_id();
		update_option( self::ADMIN_OPTION, $user_id, false );
		// The admin always has a live row (and is exempt from the activation limit so they cannot be locked out).
		$row = self::by_wp_user( $user_id );
		global $wpdb;
		$now = BT_Helpers::now();
		if ( $row ) {
			$wpdb->update( BT_Database::table( 'users' ), array( 'status' => 'active', 'updated_at' => $now, 'status_changed_at' => $now ), array( 'id' => $row->id ) );
		} else {
			$wpdb->insert( BT_Database::table( 'users' ), array(
				'user_id' => $user_id, 'status' => 'active', 'permissions' => wp_json_encode( self::PERMISSION_IDS ),
				'created_by' => get_current_user_id(), 'created_at' => $now, 'updated_at' => $now, 'status_changed_at' => $now,
			) );
		}
		self::audit( 'admin_assigned', $user_id, (string) $prev );
		self::flush_cache();
		return true;
	}

	public static function is_admin( $user_id = 0 ) {
		$user_id = $user_id ? (int) $user_id : get_current_user_id();
		$admin   = self::admin_id();
		return $user_id > 0 && $admin > 0 && $user_id === $admin;
	}

	/* ---------------------------------------------------------------- */
	/* Rows                                                             */
	/* ---------------------------------------------------------------- */

	private static $cache = array();

	public static function flush_cache() {
		self::$cache = array();
	}

	public static function by_wp_user( $user_id ) {
		global $wpdb;
		$user_id = (int) $user_id;
		if ( ! array_key_exists( $user_id, self::$cache ) ) {
			self::$cache[ $user_id ] = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . BT_Database::table( 'users' ) . ' WHERE user_id = %d', $user_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		}
		return self::$cache[ $user_id ];
	}

	public static function find( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . BT_Database::table( 'users' ) . ' WHERE id = %d', (int) $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/** The row if (and only if) the WordPress user is currently allowed to use the tracker. */
	public static function active_row( $user_id ) {
		$row = self::by_wp_user( $user_id );
		return ( $row && 'active' === $row->status ) ? $row : null;
	}

	public static function row_permissions( $row ) {
		$p = $row && $row->permissions ? json_decode( $row->permissions, true ) : array();
		return self::sanitize_permissions( is_array( $p ) ? $p : array() );
	}

	public static function count_active() {
		global $wpdb;
		return (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . BT_Database::table( 'users' ) . " WHERE status = 'active'" ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	public static function active_user_ids() {
		global $wpdb;
		return array_map( 'intval', $wpdb->get_col( 'SELECT user_id FROM ' . BT_Database::table( 'users' ) . " WHERE status = 'active'" ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/* ---------------------------------------------------------------- */
	/* Mutations (callers have already authorised the actor)            */
	/* ---------------------------------------------------------------- */

	/** Add (or re-add) a WordPress user. Returns the row or WP_Error. */
	public static function add( $user_id, array $permissions = null, $status = 'active', $bypass_license = false ) {
		global $wpdb;
		$user_id = (int) $user_id;
		if ( ! $user_id || ! get_userdata( $user_id ) ) {
			return new WP_Error( 'bt_invalid_user', __( 'That WordPress user does not exist.', 'bug-tracker' ), array( 'status' => 400 ) );
		}
		$existing = self::by_wp_user( $user_id );
		if ( $existing && 'removed' !== $existing->status ) {
			return new WP_Error( 'bt_duplicate_user', __( 'That user is already part of the Bug Tracker.', 'bug-tracker' ), array( 'status' => 409 ) );
		}
		$status = 'inactive' === $status ? 'inactive' : 'active';
		if ( 'active' === $status && ! $bypass_license ) {
			$ok = BT_License::assert_can_activate();
			if ( is_wp_error( $ok ) ) {
				return $ok;
			}
		}
		$perms = null === $permissions ? self::default_permissions() : self::sanitize_permissions( $permissions );
		$now   = BT_Helpers::now();
		if ( $existing ) { // re-adding a previously removed user: keep the row (and thus the history link).
			$wpdb->update( BT_Database::table( 'users' ), array( 'status' => $status, 'permissions' => wp_json_encode( $perms ), 'updated_at' => $now, 'status_changed_at' => $now, 'created_by' => get_current_user_id() ), array( 'id' => $existing->id ) );
		} else {
			$wpdb->insert( BT_Database::table( 'users' ), array(
				'user_id' => $user_id, 'status' => $status, 'permissions' => wp_json_encode( $perms ),
				'created_by' => get_current_user_id(), 'created_at' => $now, 'updated_at' => $now, 'status_changed_at' => $now,
			) );
		}
		self::flush_cache();
		self::audit( 'user_added', $user_id, get_userdata( $user_id )->display_name );
		return self::by_wp_user( $user_id );
	}

	public static function set_status( $row, $status ) {
		global $wpdb;
		if ( ! in_array( $status, array( 'active', 'inactive' ), true ) ) {
			return new WP_Error( 'bt_invalid_status', __( 'Invalid status.', 'bug-tracker' ), array( 'status' => 400 ) );
		}
		if ( self::is_admin( $row->user_id ) ) {
			return new WP_Error( 'bt_admin_protected', __( 'The Bug Tracker Admin cannot be deactivated. Assign another admin first.', 'bug-tracker' ), array( 'status' => 409 ) );
		}
		if ( $row->status === $status ) {
			return $row;
		}
		if ( 'active' === $status ) { // inactive/removed -> active consumes a seat
			$ok = BT_License::assert_can_activate();
			if ( is_wp_error( $ok ) ) {
				return $ok;
			}
		}
		$now = BT_Helpers::now();
		$wpdb->update( BT_Database::table( 'users' ), array( 'status' => $status, 'updated_at' => $now, 'status_changed_at' => $now ), array( 'id' => $row->id ) );
		self::flush_cache();
		self::audit( 'active' === $status ? 'user_activated' : 'user_deactivated', $row->user_id, get_userdata( $row->user_id ) ? get_userdata( $row->user_id )->display_name : '' );
		return self::find( $row->id );
	}

	public static function set_permissions( $row, array $permissions ) {
		global $wpdb;
		$wpdb->update( BT_Database::table( 'users' ), array( 'permissions' => wp_json_encode( self::sanitize_permissions( $permissions ) ), 'updated_at' => BT_Helpers::now() ), array( 'id' => $row->id ) );
		self::flush_cache();
		self::audit( 'user_updated', $row->user_id, 'permissions' );
		return self::find( $row->id );
	}

	/** Soft-remove: bugs, comments, activity and the row itself are preserved; project access is revoked. */
	public static function remove( $row ) {
		global $wpdb;
		if ( self::is_admin( $row->user_id ) ) {
			return new WP_Error( 'bt_admin_protected', __( 'The Bug Tracker Admin cannot be removed. Assign another admin first.', 'bug-tracker' ), array( 'status' => 409 ) );
		}
		$now = BT_Helpers::now();
		$wpdb->update( BT_Database::table( 'users' ), array( 'status' => 'removed', 'updated_at' => $now, 'status_changed_at' => $now ), array( 'id' => $row->id ) );
		$wpdb->delete( BT_Database::table( 'project_members' ), array( 'user_id' => $row->user_id ) );
		// Unassign their open work so nothing sits with someone who has no access (comments/reports stay).
		$wpdb->update( BT_Database::table( 'bugs' ), array( 'assignee_id' => 0 ), array( 'assignee_id' => $row->user_id ) );
		self::flush_cache();
		self::audit( 'user_removed', $row->user_id, get_userdata( $row->user_id ) ? get_userdata( $row->user_id )->display_name : '' );
		return self::find( $row->id );
	}

	/** Hard delete – only used for demo users that were created by this plugin. */
	public static function purge( $user_id ) {
		global $wpdb;
		$wpdb->delete( BT_Database::table( 'users' ), array( 'user_id' => (int) $user_id ) );
		$wpdb->delete( BT_Database::table( 'project_members' ), array( 'user_id' => (int) $user_id ) );
		self::flush_cache();
	}

	/* ---------------------------------------------------------------- */
	/* Project access                                                   */
	/* ---------------------------------------------------------------- */

	public static function project_assignments( $user_id ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare( 'SELECT project_id, role FROM ' . BT_Database::table( 'project_members' ) . ' WHERE user_id = %d', (int) $user_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	public static function grant_project( $user_id, $project_id, $role = 'member' ) {
		global $wpdb;
		$role = 'maintainer' === $role ? 'maintainer' : 'member';
		$t    = BT_Database::table( 'project_members' );
		$has  = $wpdb->get_var( $wpdb->prepare( "SELECT id FROM $t WHERE project_id = %d AND user_id = %d", $project_id, $user_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		if ( $has ) {
			$wpdb->update( $t, array( 'role' => $role ), array( 'id' => $has ) );
		} else {
			$wpdb->insert( $t, array( 'project_id' => (int) $project_id, 'user_id' => (int) $user_id, 'role' => $role, 'created_at' => BT_Helpers::now() ) );
		}
	}

	public static function revoke_project( $user_id, $project_id ) {
		global $wpdb;
		$wpdb->delete( BT_Database::table( 'project_members' ), array( 'project_id' => (int) $project_id, 'user_id' => (int) $user_id ) );
	}

	/* ---------------------------------------------------------------- */
	/* Audit trail (re-uses the existing activity table)                */
	/* ---------------------------------------------------------------- */

	public static function audit( $action, $target_user_id, $detail = '', $project_id = 0 ) {
		global $wpdb;
		$wpdb->insert( BT_Database::table( 'activity' ), array(
			'bug_id' => 0, 'project_id' => (int) $project_id, 'user_id' => get_current_user_id(), 'action' => $action,
			'field' => (string) (int) $target_user_id, 'old_value' => null, 'new_value' => (string) $detail, 'created_at' => BT_Helpers::now(),
		) );
	}

	/* ---------------------------------------------------------------- */
	/* One-time migration from the legacy WP role/capability model      */
	/* ---------------------------------------------------------------- */

	public static function maybe_migrate() {
		if ( get_option( self::MIGRATED_OPTION ) ) {
			return;
		}
		global $wpdb;
		$legacy = get_role( 'bug_tracker_manager' ) || get_role( 'bug_tracker_contributor' )
			|| ( get_role( 'administrator' ) && get_role( 'administrator' )->has_cap( 'view_bug_tracker' ) );
		if ( $legacy ) {
			$now      = BT_Helpers::now();
			$projects = $wpdb->get_col( 'SELECT id FROM ' . BT_Database::table( 'projects' ) ); // phpcs:ignore WordPress.DB.PreparedSQL
			$open     = ! BT_Settings::get()['project']['restrict_to_members']; // previously "everyone sees everything"
			$query    = new WP_User_Query( array( 'capability__in' => array( 'view_bug_tracker' ), 'number' => -1, 'fields' => 'all' ) );
			foreach ( $query->get_results() as $u ) {
				if ( self::by_wp_user( $u->ID ) ) {
					continue;
				}
				$perms = array();
				foreach ( self::PERMISSION_IDS as $k ) {
					if ( user_can( $u, $k ) ) {
						$perms[] = $k;
					}
				}
				$wpdb->insert( BT_Database::table( 'users' ), array(
					'user_id' => $u->ID, 'status' => 'active', 'permissions' => wp_json_encode( $perms ),
					'created_by' => 0, 'created_at' => $now, 'updated_at' => $now, 'status_changed_at' => $now,
				) );
				self::flush_cache();
				// Preserve effective access: people who could see every project keep that as explicit assignments.
				if ( $open || user_can( $u, 'manage_projects' ) || user_can( $u, 'manage_bug_tracker' ) ) {
					foreach ( $projects as $pid ) {
						self::grant_project( $u->ID, (int) $pid );
					}
				}
			}
			// Leads and creators used to have implicit access – make it explicit.
			$rows = $wpdb->get_results( 'SELECT id, lead_id, created_by FROM ' . BT_Database::table( 'projects' ) ); // phpcs:ignore WordPress.DB.PreparedSQL
			foreach ( $rows as $p ) {
				foreach ( array( (int) $p->lead_id, (int) $p->created_by ) as $uid ) {
					if ( $uid && self::by_wp_user( $uid ) ) {
						self::grant_project( $uid, (int) $p->id );
					}
				}
			}
		}
		update_option( self::MIGRATED_OPTION, BT_Helpers::now(), false );
	}
}
