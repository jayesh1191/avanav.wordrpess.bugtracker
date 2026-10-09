<?php
defined( 'ABSPATH' ) || exit;

/**
 * Bug Tracker user management. Every route is guarded by the Bug Tracker Admin
 * permission (see BT_REST_API); nobody else can reach these handlers.
 */
class BT_Users_Controller {

	/** Row of a user that is part of the tracker, or a 404. */
	private function row_or_404( $id ) {
		$row = BT_Users::find( $id );
		if ( ! $row ) {
			return BT_Helpers::error( 'bt_not_found', __( 'User not found.', 'bug-tracker' ), 404 );
		}
		return $row;
	}

	/** WordPress accounts with user-administration power are never edited from here (takeover risk). */
	private function profile_protected( $wp_user_id ) {
		return user_can( $wp_user_id, 'manage_options' ) || user_can( $wp_user_id, 'edit_users' ) || user_can( $wp_user_id, 'promote_users' );
	}

	/** @param array|null $assignments user_id => list of {project_id, role} (null = query per user) */
	private function format( $row, $assignments = null ) {
		$u = get_userdata( $row->user_id );
		$a = null === $assignments ? BT_Users::project_assignments( $row->user_id ) : ( isset( $assignments[ (int) $row->user_id ] ) ? $assignments[ (int) $row->user_id ] : array() );
		return array(
			'id'                => (int) $row->id,
			'user_id'           => (int) $row->user_id,
			'name'              => $u ? $u->display_name : __( 'Deleted user', 'bug-tracker' ),
			'login'             => $u ? $u->user_login : '',
			'email'             => $u ? $u->user_email : '',
			'avatar'            => get_avatar_url( $u ? $u->ID : 0, array( 'size' => 64 ) ),
			'status'            => $row->status,
			'is_admin'          => BT_Users::is_admin( $row->user_id ),
			'permissions'       => BT_Users::is_admin( $row->user_id ) ? array_keys( BT_Users::permission_keys() ) : BT_Users::row_permissions( $row ),
			'projects'          => array_map( function ( $x ) {
				return array( 'project_id' => (int) $x->project_id, 'role' => $x->role );
			}, $a ),
			'project_count'     => count( $a ),
			'added_at'          => BT_Helpers::iso( $row->created_at ),
			'status_changed_at' => BT_Helpers::iso( $row->status_changed_at ),
			'profile_editable'  => $u && ! $this->profile_protected( $u->ID ),
		);
	}

	/* ---------------------------------------------------------------- */

	public function index( WP_REST_Request $r ) {
		global $wpdb;
		$t      = BT_Database::table( 'users' );
		$page   = max( 1, (int) $r->get_param( 'page' ) );
		$per    = max( 1, min( 100, (int) ( $r->get_param( 'per_page' ) ?: 20 ) ) );
		$status = (string) $r->get_param( 'status' );
		$where  = array( '1=1' );
		if ( in_array( $status, array( 'active', 'inactive', 'removed' ), true ) ) {
			$where[] = $wpdb->prepare( 'tu.status = %s', $status );
		} else {
			$where[] = "tu.status <> 'removed'";
		}
		$search = trim( sanitize_text_field( (string) $r->get_param( 'search' ) ) );
		if ( '' !== $search ) {
			$like    = '%' . $wpdb->esc_like( $search ) . '%';
			$where[] = $wpdb->prepare( '(u.display_name LIKE %s OR u.user_login LIKE %s OR u.user_email LIKE %s)', $like, $like, $like );
		}
		$from  = "FROM $t tu JOIN {$wpdb->users} u ON u.ID = tu.user_id WHERE " . implode( ' AND ', $where );
		$total = (int) $wpdb->get_var( "SELECT COUNT(*) $from" ); // phpcs:ignore WordPress.DB.PreparedSQL
		$rows  = $wpdb->get_results( $wpdb->prepare( "SELECT tu.* $from ORDER BY u.display_name ASC LIMIT %d OFFSET %d", $per, ( $page - 1 ) * $per ) ); // phpcs:ignore WordPress.DB.PreparedSQL

		$assign = array();
		if ( $rows ) {
			$in = implode( ',', array_map( 'intval', wp_list_pluck( $rows, 'user_id' ) ) );
			foreach ( $wpdb->get_results( 'SELECT user_id, project_id, role FROM ' . BT_Database::table( 'project_members' ) . " WHERE user_id IN ($in)" ) as $x ) { // phpcs:ignore WordPress.DB.PreparedSQL
				$assign[ (int) $x->user_id ][] = $x;
			}
		}
		$counts = array( 'active' => 0, 'inactive' => 0, 'removed' => 0 );
		foreach ( $wpdb->get_results( "SELECT status, COUNT(*) n FROM $t GROUP BY status" ) as $c ) { // phpcs:ignore WordPress.DB.PreparedSQL
			$counts[ $c->status ] = (int) $c->n;
		}
		return rest_ensure_response( array(
			'items'       => array_map( function ( $row ) use ( $assign ) {
				return $this->format( $row, $assign );
			}, $rows ),
			'total'       => $total,
			'page'        => $page,
			'total_pages' => (int) max( 1, ceil( $total / $per ) ),
			'counts'      => $counts,
			'license'     => BT_License::status(),
			'permission_keys' => BT_Users::permission_keys(),
		) );
	}

	/** WordPress users that could be added (not already active/inactive in the tracker). */
	public function candidates( WP_REST_Request $r ) {
		global $wpdb;
		$exclude = $wpdb->get_col( 'SELECT user_id FROM ' . BT_Database::table( 'users' ) . " WHERE status <> 'removed'" ); // phpcs:ignore WordPress.DB.PreparedSQL
		$args    = array( 'number' => 20, 'orderby' => 'display_name', 'order' => 'ASC', 'exclude' => array_map( 'intval', $exclude ), 'fields' => 'all' );
		$search  = trim( sanitize_text_field( (string) $r->get_param( 'search' ) ) );
		if ( '' !== $search ) {
			$args['search']         = '*' . $search . '*';
			$args['search_columns'] = array( 'user_login', 'user_nicename', 'display_name', 'user_email' );
		}
		$out = array();
		foreach ( ( new WP_User_Query( $args ) )->get_results() as $u ) {
			$out[] = array( 'id' => (int) $u->ID, 'name' => $u->display_name, 'login' => $u->user_login, 'email' => $u->user_email, 'avatar' => get_avatar_url( $u->ID, array( 'size' => 64 ) ) );
		}
		return rest_ensure_response( $out );
	}

	public function license() {
		return rest_ensure_response( BT_License::status() );
	}

	/* ---------------------------------------------------------------- */

	private function validate_project_ids( $ids ) {
		$map = BT_Helpers::projects_map( true );
		$out = array();
		foreach ( (array) $ids as $pid ) {
			$pid = (int) $pid;
			if ( $pid && isset( $map[ $pid ] ) ) {
				$out[ $pid ] = true;
			}
		}
		return array_keys( $out );
	}

	public function create( WP_REST_Request $r ) {
		$status = 'inactive' === $r->get_param( 'status' ) ? 'inactive' : 'active';
		$perms  = null === $r->get_param( 'permissions' ) ? null : BT_Users::sanitize_permissions( (array) $r->get_param( 'permissions' ) );
		$new    = $r->get_param( 'new_user' );

		// Check the licence first so we never create a WordPress account we cannot activate.
		if ( 'active' === $status ) {
			$ok = BT_License::assert_can_activate();
			if ( is_wp_error( $ok ) ) {
				return $ok;
			}
		}

		$created_wp = false;
		if ( is_array( $new ) ) {
			$username = isset( $new['username'] ) ? sanitize_user( (string) $new['username'], true ) : '';
			$email    = isset( $new['email'] ) ? sanitize_email( (string) $new['email'] ) : '';
			$display  = isset( $new['display_name'] ) ? trim( sanitize_text_field( (string) $new['display_name'] ) ) : '';
			$errors   = array();
			if ( '' === $username || ! validate_username( $username ) || strlen( $username ) > 60 ) {
				$errors['username'] = __( 'Enter a valid username (letters, numbers, . _ - @).', 'bug-tracker' );
			} elseif ( username_exists( $username ) ) {
				$errors['username'] = __( 'That username is already taken. Add the existing user instead.', 'bug-tracker' );
			}
			if ( ! is_email( $email ) ) {
				$errors['email'] = __( 'Enter a valid e-mail address.', 'bug-tracker' );
			} elseif ( email_exists( $email ) ) {
				$errors['email'] = __( 'A WordPress user with that e-mail already exists. Add the existing user instead.', 'bug-tracker' );
			}
			if ( '' === $display ) {
				$display = $username;
			}
			if ( mb_strlen( $display ) > 100 ) {
				$errors['display_name'] = __( 'Name is too long.', 'bug-tracker' );
			}
			if ( $errors ) {
				return BT_Helpers::error( 'bt_validation', __( 'Please fix the highlighted fields.', 'bug-tracker' ), 400, array( 'fields' => $errors ) );
			}
			$wp_id = wp_insert_user( array(
				'user_login'   => $username,
				'user_email'   => $email,
				'display_name' => $display,
				'nickname'     => $display,
				'user_pass'    => wp_generate_password( 24 ),
				'role'         => '', // Deliberately no WordPress role – access is managed by the plugin.
			) );
			if ( is_wp_error( $wp_id ) ) {
				return BT_Helpers::error( 'bt_validation', $wp_id->get_error_message(), 400 );
			}
			$created_wp = true;
			if ( ! empty( $new['send_notification'] ) ) {
				wp_new_user_notification( $wp_id, null, 'user' ); // sends a "set your password" link
			}
		} else {
			$wp_id = (int) $r->get_param( 'user_id' );
			if ( $wp_id <= 0 || ! get_userdata( $wp_id ) ) {
				return BT_Helpers::error( 'bt_validation', __( 'Choose an existing WordPress user or create a new one.', 'bug-tracker' ), 400, array( 'fields' => array( 'user_id' => __( 'Select a user.', 'bug-tracker' ) ) ) );
			}
		}

		$row = BT_Users::add( $wp_id, $perms, $status );
		if ( is_wp_error( $row ) ) {
			if ( $created_wp ) {
				require_once ABSPATH . 'wp-admin/includes/user.php';
				wp_delete_user( $wp_id );
			}
			return $row;
		}
		foreach ( $this->validate_project_ids( (array) $r->get_param( 'projects' ) ) as $pid ) {
			BT_Users::grant_project( $wp_id, $pid );
			BT_Users::audit( 'access_granted', $wp_id, BT_Helpers::projects_map()[ $pid ]->name, $pid );
		}
		$resp = rest_ensure_response( $this->format( BT_Users::find( $row->id ) ) );
		$resp->set_status( 201 );
		return $resp;
	}

	public function update( WP_REST_Request $r ) {
		$row = $this->row_or_404( $r['id'] );
		if ( is_wp_error( $row ) ) {
			return $row;
		}
		if ( 'removed' === $row->status ) {
			return BT_Helpers::error( 'bt_removed', __( 'This user was removed. Add them again to restore access.', 'bug-tracker' ), 409 );
		}
		$u = get_userdata( $row->user_id );

		if ( null !== $r->get_param( 'display_name' ) || null !== $r->get_param( 'email' ) ) {
			if ( ! $u || $this->profile_protected( $u->ID ) ) {
				return BT_Helpers::error( 'bt_profile_protected', __( 'This WordPress account has administrative rights; edit its profile in WordPress.', 'bug-tracker' ), 403 );
			}
			$data   = array( 'ID' => $u->ID );
			$errors = array();
			if ( null !== $r->get_param( 'display_name' ) ) {
				$name = trim( sanitize_text_field( (string) $r->get_param( 'display_name' ) ) );
				if ( '' === $name || mb_strlen( $name ) > 100 ) {
					$errors['display_name'] = __( 'Enter a name (up to 100 characters).', 'bug-tracker' );
				} else {
					$data['display_name'] = $name;
					$data['nickname']     = $name;
				}
			}
			if ( null !== $r->get_param( 'email' ) ) {
				$email = sanitize_email( (string) $r->get_param( 'email' ) );
				if ( ! is_email( $email ) ) {
					$errors['email'] = __( 'Enter a valid e-mail address.', 'bug-tracker' );
				} elseif ( strtolower( $email ) !== strtolower( $u->user_email ) && email_exists( $email ) ) {
					$errors['email'] = __( 'That e-mail address is already used by another account.', 'bug-tracker' );
				} else {
					$data['user_email'] = $email;
				}
			}
			if ( $errors ) {
				return BT_Helpers::error( 'bt_validation', __( 'Please fix the highlighted fields.', 'bug-tracker' ), 400, array( 'fields' => $errors ) );
			}
			if ( count( $data ) > 1 ) {
				$res = wp_update_user( $data );
				if ( is_wp_error( $res ) ) {
					return BT_Helpers::error( 'bt_validation', $res->get_error_message(), 400 );
				}
				BT_Users::audit( 'user_updated', $row->user_id, 'profile' );
			}
		}

		if ( null !== $r->get_param( 'permissions' ) ) {
			if ( BT_Users::is_admin( $row->user_id ) ) {
				return BT_Helpers::error( 'bt_admin_protected', __( 'The Bug Tracker Admin always has every permission.', 'bug-tracker' ), 409 );
			}
			$row = BT_Users::set_permissions( $row, (array) $r->get_param( 'permissions' ) );
		}
		if ( null !== $r->get_param( 'status' ) ) {
			$row = BT_Users::set_status( $row, (string) $r->get_param( 'status' ) );
			if ( is_wp_error( $row ) ) {
				return $row;
			}
		}
		return rest_ensure_response( $this->format( BT_Users::find( $row->id ) ) );
	}

	public function destroy( WP_REST_Request $r ) {
		$row = $this->row_or_404( $r['id'] );
		if ( is_wp_error( $row ) ) {
			return $row;
		}
		$res = BT_Users::remove( $row );
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		return rest_ensure_response( array( 'removed' => true, 'license' => BT_License::status() ) );
	}

	/** PUT /tracker-users/{id}/projects/{project_id}  { granted: bool, role?: member|maintainer } */
	public function set_project( WP_REST_Request $r ) {
		$row = $this->row_or_404( $r['id'] );
		if ( is_wp_error( $row ) ) {
			return $row;
		}
		if ( 'removed' === $row->status ) {
			return BT_Helpers::error( 'bt_removed', __( 'This user was removed. Add them again first.', 'bug-tracker' ), 409 );
		}
		$pid = (int) $r['project_id'];
		$map = BT_Helpers::projects_map( true );
		if ( ! isset( $map[ $pid ] ) ) {
			return BT_Helpers::error( 'bt_not_found', __( 'Project not found.', 'bug-tracker' ), 404 );
		}
		if ( rest_sanitize_boolean( $r->get_param( 'granted' ) ) ) {
			BT_Users::grant_project( $row->user_id, $pid, (string) $r->get_param( 'role' ) );
			BT_Users::audit( 'access_granted', $row->user_id, $map[ $pid ]->name, $pid );
		} else {
			BT_Users::revoke_project( $row->user_id, $pid );
			// Work assigned to them in that project goes back to the pool.
			global $wpdb;
			$wpdb->update( BT_Database::table( 'bugs' ), array( 'assignee_id' => 0 ), array( 'assignee_id' => $row->user_id, 'project_id' => $pid ) );
			BT_Users::audit( 'access_revoked', $row->user_id, $map[ $pid ]->name, $pid );
		}
		return rest_ensure_response( $this->format( $row ) );
	}
}
