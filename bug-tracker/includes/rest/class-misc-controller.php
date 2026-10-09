<?php
defined( 'ABSPATH' ) || exit;

/**
 * Dashboard, reports, users, notifications and settings endpoints.
 */
class BT_Misc_Controller {

	/* ================================================================ */
	/* Helpers                                                          */
	/* ================================================================ */

	/** Count bugs grouped by a column of bugs, honouring the user's scope. */
	private function group_count( $column, $extra_where = '' ) {
		global $wpdb;
		$scope = BT_Permissions::bug_scope_sql( 'b' );
		$col   = in_array( $column, array( 'status', 'priority', 'severity', 'project_id', 'assignee_id' ), true ) ? $column : 'status';
		return $wpdb->get_results( 'SELECT b.' . $col . ' AS k, COUNT(*) AS n FROM ' . BT_Database::table( 'bugs' ) . " b WHERE $scope $extra_where GROUP BY b.$col" ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	private function config_series( $list, $rows ) {
		$counts = array();
		foreach ( $rows as $r ) {
			$counts[ $r->k ] = (int) $r->n;
		}
		$out = array();
		foreach ( BT_Settings::get()[ $list ] as $item ) {
			$out[] = array( 'key' => $item['slug'], 'label' => $item['label'], 'color' => $item['color'], 'count' => isset( $counts[ $item['slug'] ] ) ? $counts[ $item['slug'] ] : 0 );
		}
		return $out;
	}

	/** Build a zero-filled created/resolved time series between local dates. */
	private function time_series( $from_local, $to_local, $granularity, $created, $resolved ) {
		$map = array();
		$fmt = 'month' === $granularity ? 'Y-m' : 'Y-m-d';
		$cur = new DateTimeImmutable( $from_local, wp_timezone() );
		$end = new DateTimeImmutable( $to_local, wp_timezone() );
		if ( 'month' === $granularity ) {
			$cur = $cur->modify( 'first day of this month' );
		}
		while ( $cur <= $end ) {
			$map[ $cur->format( $fmt ) ] = array( 'date' => $cur->format( $fmt ), 'created' => 0, 'resolved' => 0 );
			$cur                         = $cur->modify( 'month' === $granularity ? '+1 month' : '+1 day' );
		}
		foreach ( $created as $r ) {
			if ( isset( $map[ $r->d ] ) ) {
				$map[ $r->d ]['created'] = (int) $r->n;
			}
		}
		foreach ( $resolved as $r ) {
			if ( isset( $map[ $r->d ] ) ) {
				$map[ $r->d ]['resolved'] = (int) $r->n;
			}
		}
		return array_values( $map );
	}

	private function time_counts( $column, $from_local, $granularity ) {
		global $wpdb;
		$off   = BT_Helpers::tz_offset();
		$scope = BT_Permissions::bug_scope_sql( 'b' );
		$expr  = $wpdb->prepare( "DATE_ADD(b.$column, INTERVAL %d SECOND)", $off ); // phpcs:ignore WordPress.DB.PreparedSQL
		$group = 'month' === $granularity ? "DATE_FORMAT($expr, '%%Y-%%m')" : "DATE($expr)";
		$group = str_replace( '%%', '%', $group );
		$from  = ( new DateTimeImmutable( $from_local, wp_timezone() ) )->setTimezone( new DateTimeZone( 'UTC' ) )->format( 'Y-m-d H:i:s' );
		return $wpdb->get_results( $wpdb->prepare(
			"SELECT $group AS d, COUNT(*) AS n FROM " . BT_Database::table( 'bugs' ) . " b WHERE $scope AND b.$column IS NOT NULL AND b.$column >= %s GROUP BY d", // phpcs:ignore WordPress.DB.PreparedSQL
			$from
		) );
	}

	/* ================================================================ */
	/* Dashboard                                                        */
	/* ================================================================ */

	public function dashboard() {
		global $wpdb;
		$by_status = $this->group_count( 'status' );
		$cats      = array( 'open' => 0, 'in_progress' => 0, 'resolved' => 0, 'closed' => 0 );
		$total     = 0;
		foreach ( $by_status as $r ) {
			$cats[ BT_Settings::status_category( $r->k ) ] += (int) $r->n;
			$total                                         += (int) $r->n;
		}
		$done_slugs = array();
		foreach ( BT_Settings::get()['statuses'] as $s ) {
			if ( in_array( $s['category'], array( 'resolved', 'closed' ), true ) ) {
				$done_slugs[] = esc_sql( $s['slug'] );
			}
		}
		$not_done = $done_slugs ? "AND b.status NOT IN ('" . implode( "','", $done_slugs ) . "')" : '';
		$scope    = BT_Permissions::bug_scope_sql( 'b' );
		$bt       = BT_Database::table( 'bugs' );

		$critical = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $bt b WHERE $scope $not_done AND b.priority = %s", BT_Settings::top_priority() ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		$mine     = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $bt b WHERE $scope $not_done AND b.assignee_id = %d", get_current_user_id() ) ); // phpcs:ignore WordPress.DB.PreparedSQL

		// 30-day trend (site-local days).
		$from_local = ( new DateTimeImmutable( 'today', wp_timezone() ) )->modify( '-29 days' )->format( 'Y-m-d' );
		$to_local   = ( new DateTimeImmutable( 'today', wp_timezone() ) )->format( 'Y-m-d' );
		$trend      = $this->time_series( $from_local, $to_local, 'day', $this->time_counts( 'created_at', $from_local, 'day' ), $this->time_counts( 'resolved_at', $from_local, 'day' ) );

		$bugs_ctl = new BT_Bugs_Controller();
		$recent   = $wpdb->get_results( "SELECT b.* FROM $bt b WHERE $scope ORDER BY b.id DESC LIMIT 8" ); // phpcs:ignore WordPress.DB.PreparedSQL

		$ids       = BT_Permissions::accessible_project_ids();
		$proj_cond = null === $ids ? '1=1' : ( $ids ? 'a.project_id IN (' . implode( ',', array_map( 'intval', $ids ) ) . ')' : '1=0' );
		$act       = $wpdb->get_results( // phpcs:ignore WordPress.DB.PreparedSQL
			'SELECT a.*, b.title AS bug_title FROM ' . BT_Database::table( 'activity' ) . " a LEFT JOIN $bt b ON b.id = a.bug_id WHERE ((a.bug_id > 0 AND b.id IS NOT NULL AND $scope) OR (a.bug_id = 0 AND $proj_cond)) ORDER BY a.id DESC LIMIT 12"
		);

		return rest_ensure_response( array(
			'totals'          => array(
				'total'         => $total,
				'open'          => $cats['open'],
				'in_progress'   => $cats['in_progress'],
				'resolved'      => $cats['resolved'],
				'closed'        => $cats['closed'],
				'critical'      => $critical,
				'assigned_to_me' => $mine,
			),
			'status_chart'    => $this->config_series( 'statuses', $by_status ),
			'priority_chart'  => $this->config_series( 'priorities', $this->group_count( 'priority' ) ),
			'trend'           => $trend,
			'recent_bugs'     => array_map( array( $bugs_ctl, 'format_bug' ), $recent ),
			'recent_activity' => array_map( array( 'BT_Bugs_Controller', 'format_activity' ), $act ),
		) );
	}

	/* ================================================================ */
	/* Reports                                                          */
	/* ================================================================ */

	public function reports( WP_REST_Request $r ) {
		$days = (int) $r->get_param( 'days' );
		if ( ! in_array( $days, array( 7, 30, 90, 180, 365 ), true ) ) {
			$days = 30;
		}
		$gran       = $days > 90 ? 'month' : 'day';
		$from_local = ( new DateTimeImmutable( 'today', wp_timezone() ) )->modify( '-' . ( $days - 1 ) . ' days' )->format( 'Y-m-d' );
		$to_local   = ( new DateTimeImmutable( 'today', wp_timezone() ) )->format( 'Y-m-d' );

		$projects = array();
		foreach ( $this->group_count( 'project_id' ) as $row ) {
			$p          = BT_Helpers::project_summary( $row->k );
			$projects[] = array( 'key' => (string) $row->k, 'label' => $p ? $p['name'] : __( 'Unknown', 'bug-tracker' ), 'color' => $p ? $p['color'] : '#94a3b8', 'count' => (int) $row->n );
		}
		$assignees = array();
		foreach ( $this->group_count( 'assignee_id' ) as $row ) {
			$u           = (int) $row->k ? BT_Helpers::user( $row->k ) : null;
			$assignees[] = array( 'key' => (string) $row->k, 'label' => $u ? $u['name'] : __( 'Unassigned', 'bug-tracker' ), 'avatar' => $u ? $u['avatar'] : null, 'count' => (int) $row->n );
		}
		usort( $assignees, function ( $a, $b ) { return $b['count'] <=> $a['count']; } );
		usort( $projects, function ( $a, $b ) { return $b['count'] <=> $a['count']; } );

		return rest_ensure_response( array(
			'days'        => $days,
			'granularity' => $gran,
			'by_status'   => $this->config_series( 'statuses', $this->group_count( 'status' ) ),
			'by_priority' => $this->config_series( 'priorities', $this->group_count( 'priority' ) ),
			'by_severity' => $this->config_series( 'severities', $this->group_count( 'severity' ) ),
			'by_project'  => $projects,
			'by_assignee' => array_slice( $assignees, 0, 25 ),
			'over_time'   => $this->time_series( $from_local, $to_local, $gran, $this->time_counts( 'created_at', $from_local, $gran ), $this->time_counts( 'resolved_at', $from_local, $gran ) ),
		) );
	}

	/* ================================================================ */
	/* Users                                                            */
	/* ================================================================ */

	/** Directory of active tracker users (assignee pickers, Team page). */
	public function users( WP_REST_Request $r ) {
		global $wpdb;
		$per  = max( 1, min( 200, (int) ( $r->get_param( 'per_page' ) ?: 100 ) ) );
		$page = max( 1, (int) $r->get_param( 'page' ) );
		$ids  = BT_Users::active_user_ids();
		// Non-admins only see people they share at least one project with.
		if ( ! BT_Users::is_admin() ) {
			$mine = BT_Permissions::accessible_project_ids();
			$pm   = BT_Database::table( 'project_members' );
			$ids  = $mine ? array_map( 'intval', $wpdb->get_col( "SELECT DISTINCT user_id FROM $pm WHERE project_id IN (" . implode( ',', array_map( 'intval', $mine ) ) . ')' ) ) : array(); // phpcs:ignore WordPress.DB.PreparedSQL
			$ids  = array_values( array_unique( array_merge( array_intersect( $ids, BT_Users::active_user_ids() ), array( get_current_user_id() ) ) ) );
		}
		$args = array(
			'include'     => $ids ? $ids : array( 0 ),
			'number'      => $per,
			'paged'       => $page,
			'orderby'     => 'display_name',
			'order'       => 'ASC',
			'fields'      => 'all',
			'count_total' => true,
		);
		$search = trim( sanitize_text_field( (string) $r->get_param( 'search' ) ) );
		if ( '' !== $search ) {
			$args['search']         = '*' . $search . '*';
			$args['search_columns'] = array( 'user_login', 'user_nicename', 'display_name', 'user_email' );
		}
		$q     = new WP_User_Query( $args );
		$users = $q->get_results();
		$uids  = wp_list_pluck( $users, 'ID' );

		$assigned = array();
		$last     = array();
		if ( $uids ) {
			$in    = implode( ',', array_map( 'intval', $uids ) );
			$stats = $wpdb->get_results( 'SELECT assignee_id, status, COUNT(*) AS n FROM ' . BT_Database::table( 'bugs' ) . " WHERE assignee_id IN ($in) AND " . BT_Permissions::bug_scope_sql( BT_Database::table( 'bugs' ) ) . ' GROUP BY assignee_id, status' ); // phpcs:ignore WordPress.DB.PreparedSQL
			foreach ( $stats as $s ) {
				$u = (int) $s->assignee_id;
				if ( ! isset( $assigned[ $u ] ) ) {
					$assigned[ $u ] = array( 'total' => 0, 'open' => 0 );
				}
				$assigned[ $u ]['total'] += (int) $s->n;
				if ( ! BT_Settings::is_done( $s->status ) ) {
					$assigned[ $u ]['open'] += (int) $s->n;
				}
			}
			foreach ( $wpdb->get_results( 'SELECT user_id, MAX(created_at) AS last_at FROM ' . BT_Database::table( 'activity' ) . " WHERE user_id IN ($in) AND bug_id > 0 GROUP BY user_id" ) as $a ) { // phpcs:ignore WordPress.DB.PreparedSQL
				$last[ (int) $a->user_id ] = $a->last_at;
			}
		}

		$show_email = BT_Permissions::can( 'manage_bug_tracker_users' );
		$items      = array();
		foreach ( $users as $u ) {
			$last_at = isset( $last[ $u->ID ] ) ? $last[ $u->ID ] : null;
			$is_admin = BT_Users::is_admin( $u->ID );
			$item    = array(
				'id'                => (int) $u->ID,
				'name'              => $u->display_name,
				'login'             => $u->user_login,
				'avatar'            => get_avatar_url( $u->ID, array( 'size' => 64 ) ),
				'roles'             => array( $is_admin ? 'Bug Tracker Admin' : 'Member' ),
				'assigned'          => isset( $assigned[ $u->ID ] ) ? $assigned[ $u->ID ] : array( 'total' => 0, 'open' => 0 ),
				'last_active'       => BT_Helpers::iso( $last_at ),
				'status'            => ( $last_at && strtotime( $last_at . ' UTC' ) > time() - 30 * DAY_IN_SECONDS ) ? 'active' : 'inactive',
				'sees_all_projects' => $is_admin,
			);
			if ( $show_email ) {
				$item['email'] = $u->user_email;
			}
			$items[] = $item;
		}
		return rest_ensure_response( array(
			'items'       => $items,
			'total'       => (int) $q->get_total(),
			'page'        => $page,
			'total_pages' => (int) max( 1, ceil( $q->get_total() / $per ) ),
		) );
	}

	/* ================================================================ */
	/* Notifications                                                    */
	/* ================================================================ */

	public function notifications( WP_REST_Request $r ) {
		global $wpdb;
		$t      = BT_Database::table( 'notifications' );
		$uid    = get_current_user_id();
		$per    = max( 1, min( 100, (int) ( $r->get_param( 'per_page' ) ?: 30 ) ) );
		$page   = max( 1, (int) $r->get_param( 'page' ) );
		$where  = $wpdb->prepare( 'user_id = %d', $uid );
		if ( rest_sanitize_boolean( $r->get_param( 'unread' ) ) ) {
			$where .= ' AND is_read = 0';
		}
		$total  = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $t WHERE $where" ); // phpcs:ignore WordPress.DB.PreparedSQL
		$unread = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $t WHERE user_id = %d AND is_read = 0", $uid ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		$rows   = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $t WHERE $where ORDER BY id DESC LIMIT %d OFFSET %d", $per, ( $page - 1 ) * $per ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		$items  = array();
		foreach ( $rows as $n ) {
			$items[] = array(
				'id'         => (int) $n->id,
				'type'       => $n->type,
				'message'    => $n->message,
				'bug_id'     => (int) $n->bug_id,
				'actor'      => BT_Helpers::user( $n->actor_id ),
				'is_read'    => (bool) $n->is_read,
				'created_at' => BT_Helpers::iso( $n->created_at ),
			);
		}
		return rest_ensure_response( array( 'items' => $items, 'total' => $total, 'unread_count' => $unread, 'page' => $page, 'total_pages' => (int) max( 1, ceil( $total / $per ) ) ) );
	}

	public function notification_read( WP_REST_Request $r ) {
		global $wpdb;
		$n = $wpdb->update( BT_Database::table( 'notifications' ), array( 'is_read' => 1 ), array( 'id' => (int) $r['id'], 'user_id' => get_current_user_id() ) );
		if ( false === $n ) {
			return BT_Helpers::error( 'bt_db_error', __( 'Could not update the notification.', 'bug-tracker' ), 500 );
		}
		return rest_ensure_response( array( 'id' => (int) $r['id'], 'is_read' => true ) );
	}

	public function notifications_read_all() {
		global $wpdb;
		$wpdb->update( BT_Database::table( 'notifications' ), array( 'is_read' => 1 ), array( 'user_id' => get_current_user_id(), 'is_read' => 0 ) );
		return rest_ensure_response( array( 'ok' => true ) );
	}

	/* ================================================================ */
	/* Settings                                                         */
	/* ================================================================ */

	private function settings_payload() {
		$s = BT_Settings::get();
		if ( ! BT_Permissions::can( 'manage_bug_tracker' ) ) {
			// Everyone else only needs the vocabularies, not operational settings.
			unset( $s['uninstall'] );
		}
		$s['limits'] = array( 'server_max_upload_mb' => (int) floor( wp_max_upload_size() / MB_IN_BYTES ) );
		return $s;
	}

	public function settings_get() {
		return rest_ensure_response( $this->settings_payload() );
	}

	public function settings_update( WP_REST_Request $r ) {
		$body  = $r->get_json_params();
		$body  = is_array( $body ) ? $body : $r->get_params();
		$clean = BT_Settings::sanitize( $body );
		if ( is_wp_error( $clean ) ) {
			return $clean;
		}
		BT_Settings::save( $clean );
		return rest_ensure_response( $this->settings_payload() );
	}
}
