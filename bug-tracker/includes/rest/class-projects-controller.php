<?php
defined( 'ABSPATH' ) || exit;

class BT_Projects_Controller {

	private function find( $id ) {
		global $wpdb;
		$p = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . BT_Database::table( 'projects' ) . ' WHERE id = %d', (int) $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		if ( ! $p || ! BT_Permissions::can_access_project( $p->id ) ) {
			return BT_Helpers::error( 'bt_not_found', __( 'Project not found.', 'bug-tracker' ), 404 );
		}
		return $p;
	}

	/** project_id => array(status => count) */
	private function stats_for( array $ids ) {
		global $wpdb;
		$out = array();
		foreach ( $ids as $id ) {
			$out[ $id ] = array( 'total' => 0, 'open' => 0, 'in_progress' => 0, 'resolved' => 0, 'closed' => 0 );
		}
		if ( ! $ids ) {
			return $out;
		}
		$in   = implode( ',', array_map( 'intval', $ids ) );
		$rows = $wpdb->get_results( 'SELECT project_id, status, COUNT(*) AS n FROM ' . BT_Database::table( 'bugs' ) . " WHERE project_id IN ($in) GROUP BY project_id, status" ); // phpcs:ignore WordPress.DB.PreparedSQL
		foreach ( $rows as $r ) {
			$cat                          = BT_Settings::status_category( $r->status );
			$out[ (int) $r->project_id ][ $cat ] += (int) $r->n;
			$out[ (int) $r->project_id ]['total'] += (int) $r->n;
		}
		return $out;
	}

	private function members_for( array $ids ) {
		global $wpdb;
		$out = array_fill_keys( $ids, array() );
		if ( ! $ids ) {
			return $out;
		}
		$in   = implode( ',', array_map( 'intval', $ids ) );
		$rows = $wpdb->get_results( 'SELECT project_id, user_id, role FROM ' . BT_Database::table( 'project_members' ) . " WHERE project_id IN ($in) ORDER BY id ASC" ); // phpcs:ignore WordPress.DB.PreparedSQL
		foreach ( $rows as $r ) {
			$out[ (int) $r->project_id ][] = array( 'user' => BT_Helpers::user( $r->user_id ), 'role' => $r->role );
		}
		return $out;
	}

	private function format_many( array $rows ) {
		$ids     = array_map( 'intval', wp_list_pluck( $rows, 'id' ) );
		$stats   = $this->stats_for( $ids );
		$members = $this->members_for( $ids );
		$out     = array();
		foreach ( $rows as $p ) {
			$out[] = array(
				'id'          => (int) $p->id,
				'name'        => $p->name,
				'key'         => $p->project_key,
				'description' => (string) $p->description,
				'color'       => $p->color,
				'status'      => $p->status,
				'lead'        => BT_Helpers::user( $p->lead_id ),
				'members'     => $members[ (int) $p->id ],
				'stats'       => $stats[ (int) $p->id ],
				'created_at'  => BT_Helpers::iso( $p->created_at ),
				'updated_at'  => BT_Helpers::iso( $p->updated_at ),
			);
		}
		return $out;
	}

	public function index( WP_REST_Request $r ) {
		global $wpdb;
		$t     = BT_Database::table( 'projects' );
		$where = array( '1=1' );
		$ids   = BT_Permissions::accessible_project_ids();
		if ( null !== $ids ) {
			$where[] = $ids ? 'id IN (' . implode( ',', array_map( 'intval', $ids ) ) . ')' : '1=0';
		}
		$status = (string) $r->get_param( 'status' );
		if ( in_array( $status, array( 'active', 'archived' ), true ) ) {
			$where[] = $wpdb->prepare( 'status = %s', $status );
		}
		$search = trim( sanitize_text_field( (string) $r->get_param( 'search' ) ) );
		if ( '' !== $search ) {
			$like    = '%' . $wpdb->esc_like( $search ) . '%';
			$where[] = $wpdb->prepare( '(name LIKE %s OR project_key LIKE %s)', $like, $like );
		}
		$rows = $wpdb->get_results( "SELECT * FROM $t WHERE " . implode( ' AND ', $where ) . ' ORDER BY name ASC' ); // phpcs:ignore WordPress.DB.PreparedSQL
		return rest_ensure_response( $this->format_many( $rows ) );
	}

	public function show( WP_REST_Request $r ) {
		$p = $this->find( $r['id'] );
		if ( is_wp_error( $p ) ) {
			return $p;
		}
		return rest_ensure_response( $this->format_many( array( $p ) )[0] );
	}

	/** Validate payload. Returns array( fields, member_rows ) or WP_Error. */
	private function read( WP_REST_Request $r, $partial ) {
		$f   = array();
		$err = array();
		if ( null !== $r->get_param( 'name' ) || ! $partial ) {
			$name = trim( sanitize_text_field( (string) $r->get_param( 'name' ) ) );
			if ( '' === $name ) {
				$err['name'] = __( 'Name is required.', 'bug-tracker' );
			} elseif ( mb_strlen( $name ) > 190 ) {
				$err['name'] = __( 'Name is too long.', 'bug-tracker' );
			} else {
				$f['name'] = $name;
			}
		}
		if ( null !== $r->get_param( 'key' ) ) {
			$key = strtoupper( preg_replace( '/[^A-Za-z0-9]/', '', (string) $r->get_param( 'key' ) ) );
			if ( strlen( $key ) > 10 ) {
				$err['key'] = __( 'Key can be at most 10 letters or digits.', 'bug-tracker' );
			} else {
				$f['project_key'] = $key;
			}
		}
		if ( null !== $r->get_param( 'description' ) ) {
			$f['description'] = sanitize_textarea_field( (string) $r->get_param( 'description' ) );
		}
		if ( null !== $r->get_param( 'color' ) ) {
			$c = sanitize_hex_color( (string) $r->get_param( 'color' ) );
			if ( ! $c ) {
				$err['color'] = __( 'Invalid colour.', 'bug-tracker' );
			} else {
				$f['color'] = $c;
			}
		}
		if ( null !== $r->get_param( 'status' ) ) {
			$s = (string) $r->get_param( 'status' );
			if ( ! in_array( $s, array( 'active', 'archived' ), true ) ) {
				$err['status'] = __( 'Invalid status.', 'bug-tracker' );
			} else {
				$f['status'] = $s;
			}
		}
		if ( null !== $r->get_param( 'lead_id' ) ) {
			$lead = (int) $r->get_param( 'lead_id' );
			if ( $lead && ( ! get_userdata( $lead ) || ! user_can( $lead, 'view_bug_tracker' ) ) ) {
				$err['lead_id'] = __( 'Choose a Bug Tracker user.', 'bug-tracker' );
			} else {
				$f['lead_id'] = max( 0, $lead );
			}
		}

		$members = null;
		if ( null !== $r->get_param( 'members' ) ) {
			$members = array();
			foreach ( (array) $r->get_param( 'members' ) as $m ) {
				$uid  = (int) ( is_array( $m ) ? ( $m['user_id'] ?? 0 ) : $m );
				$role = is_array( $m ) && isset( $m['role'] ) && in_array( $m['role'], array( 'member', 'maintainer' ), true ) ? $m['role'] : 'member';
				if ( $uid && get_userdata( $uid ) && user_can( $uid, 'view_bug_tracker' ) ) {
					$members[ $uid ] = $role;
				} elseif ( $uid ) {
					$err['members'] = __( 'One of the selected users cannot use the Bug Tracker.', 'bug-tracker' );
				}
			}
		}
		if ( $err ) {
			return BT_Helpers::error( 'bt_validation', __( 'Please fix the highlighted fields.', 'bug-tracker' ), 400, array( 'fields' => $err ) );
		}
		return array( $f, $members );
	}

	private function auto_key( $name ) {
		$words = preg_split( '/\s+/', trim( preg_replace( '/[^A-Za-z0-9 ]/', '', $name ) ) );
		$key   = '';
		if ( count( $words ) > 1 ) {
			foreach ( $words as $w ) {
				$key .= substr( $w, 0, 1 );
			}
		} else {
			$key = substr( $words[0], 0, 4 );
		}
		return strtoupper( substr( $key, 0, 10 ) );
	}

	private function save_members( $project_id, $members, $lead_id ) {
		global $wpdb;
		$t = BT_Database::table( 'project_members' );
		if ( null === $members && ! $lead_id ) {
			return;
		}
		$current = $wpdb->get_col( $wpdb->prepare( "SELECT user_id FROM $t WHERE project_id = %d", $project_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		if ( null !== $members ) {
			if ( $lead_id && ! isset( $members[ $lead_id ] ) ) {
				$members[ $lead_id ] = 'maintainer';
			}
			$wpdb->delete( $t, array( 'project_id' => $project_id ) );
			foreach ( $members as $uid => $role ) {
				$wpdb->insert( $t, array( 'project_id' => $project_id, 'user_id' => $uid, 'role' => $role, 'created_at' => BT_Helpers::now() ) );
			}
		} elseif ( $lead_id && ! in_array( (string) $lead_id, $current, true ) ) {
			$wpdb->insert( $t, array( 'project_id' => $project_id, 'user_id' => $lead_id, 'role' => 'maintainer', 'created_at' => BT_Helpers::now() ) );
		}
	}

	public function create( WP_REST_Request $r ) {
		global $wpdb;
		$res = $this->read( $r, false );
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		list( $f, $members ) = $res;
		if ( empty( $f['project_key'] ) ) {
			$f['project_key'] = $this->auto_key( $f['name'] );
		}
		$now          = BT_Helpers::now();
		$f['created_by'] = get_current_user_id();
		$f['created_at'] = $now;
		$f['updated_at'] = $now;
		$wpdb->insert( BT_Database::table( 'projects' ), $f );
		$id = (int) $wpdb->insert_id;
		if ( ! $id ) {
			return BT_Helpers::error( 'bt_db_error', __( 'Could not save the project.', 'bug-tracker' ), 500 );
		}
		$this->save_members( $id, $members, isset( $f['lead_id'] ) ? $f['lead_id'] : 0 );
		BT_Helpers::projects_map( true );
		BT_Helpers::log_activity( 0, $id, 'project_created', '', null, $f['name'] );
		$resp = rest_ensure_response( $this->format_many( array( $this->find( $id ) ) )[0] );
		$resp->set_status( 201 );
		return $resp;
	}

	public function update( WP_REST_Request $r ) {
		global $wpdb;
		$p = $this->find( $r['id'] );
		if ( is_wp_error( $p ) ) {
			return $p;
		}
		$res = $this->read( $r, true );
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		list( $f, $members ) = $res;
		if ( $f ) {
			$f['updated_at'] = BT_Helpers::now();
			$wpdb->update( BT_Database::table( 'projects' ), $f, array( 'id' => $p->id ) );
		}
		$this->save_members( (int) $p->id, $members, isset( $f['lead_id'] ) ? $f['lead_id'] : 0 );
		BT_Helpers::projects_map( true );
		return rest_ensure_response( $this->format_many( array( $this->find( $p->id ) ) )[0] );
	}

	public function destroy( WP_REST_Request $r ) {
		global $wpdb;
		$p = $this->find( $r['id'] );
		if ( is_wp_error( $p ) ) {
			return $p;
		}
		$bug_ids = $wpdb->get_col( $wpdb->prepare( 'SELECT id FROM ' . BT_Database::table( 'bugs' ) . ' WHERE project_id = %d', $p->id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		if ( $bug_ids && ! rest_sanitize_boolean( $r->get_param( 'force' ) ) ) {
			return BT_Helpers::error(
				'bt_project_not_empty',
				sprintf( _n( 'This project still has %d bug. Deleting it will delete the bug too.', 'This project still has %d bugs. Deleting it will delete them too.', count( $bug_ids ), 'bug-tracker' ), count( $bug_ids ) ),
				409,
				array( 'bug_count' => count( $bug_ids ) )
			);
		}
		BT_Bugs_Controller::delete_bugs( $bug_ids );
		$wpdb->delete( BT_Database::table( 'project_members' ), array( 'project_id' => $p->id ) );
		$wpdb->delete( BT_Database::table( 'projects' ), array( 'id' => $p->id ) );
		BT_Helpers::projects_map( true );
		return rest_ensure_response( array( 'deleted' => true, 'id' => (int) $p->id ) );
	}
}
