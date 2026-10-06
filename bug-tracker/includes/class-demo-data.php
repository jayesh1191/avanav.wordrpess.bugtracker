<?php
defined( 'ABSPATH' ) || exit;

/**
 * Generates (and later removes) realistic sample data for demos and testing.
 * Everything created is recorded in the `bug_tracker_demo` option so removal
 * never touches real data.
 */
class BT_Demo_Data {

	const OPTION = 'bug_tracker_demo';

	public static function tracked() {
		$o = get_option( self::OPTION, array() );
		return array(
			'users'    => array_map( 'intval', isset( $o['users'] ) ? (array) $o['users'] : array() ),
			'projects' => array_map( 'intval', isset( $o['projects'] ) ? (array) $o['projects'] : array() ),
		);
	}

	public static function counts() {
		global $wpdb;
		$t = self::tracked();
		$bugs = 0;
		if ( $t['projects'] ) {
			$bugs = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . BT_Database::table( 'bugs' ) . ' WHERE project_id IN (' . implode( ',', $t['projects'] ) . ')' ); // phpcs:ignore WordPress.DB.PreparedSQL
		}
		return array( 'users' => count( $t['users'] ), 'projects' => count( $t['projects'] ), 'bugs' => $bugs );
	}

	/**
	 * @return array{users:int,projects:int,bugs:int,comments:int}
	 */
	public static function generate( $users_n = 5, $projects_n = 3, $bugs_n = 40 ) {
		global $wpdb;
		$users_n    = max( 0, min( 20, (int) $users_n ) );
		$projects_n = max( 1, min( 8, (int) $projects_n ) );
		$bugs_n     = max( 1, min( 400, (int) $bugs_n ) );
		$cfg        = BT_Settings::get();
		$me         = get_current_user_id();
		$tracked    = self::tracked();

		/* ---- users ---- */
		$people = array( 'Maya Chen', 'Liam Okafor', 'Sofia Rossi', 'Noah Patel', 'Emma Larsen', 'Lucas Silva', 'Ava Kowalski', 'Ethan Brooks', 'Zoe Ivanova', 'Omar Haddad', 'Chloe Martin', 'Jack Tanaka', 'Isla Murphy', 'Leo Fischer', 'Nina Gupta', 'Owen Reyes', 'Ruby Nguyen', 'Sam Walker', 'Tara Singh', 'Victor Moreau' );
		shuffle( $people );
		$new_users = array();
		for ( $i = 0; $i < $users_n; $i++ ) {
			$name  = $people[ $i ];
			$login = 'bt_demo_' . strtolower( wp_generate_password( 6, false, false ) );
			$id    = wp_insert_user( array(
				'user_login'   => $login,
				'user_pass'    => wp_generate_password( 24 ),
				'user_email'   => $login . '@example.invalid',
				'display_name' => $name,
				'first_name'   => strtok( $name, ' ' ),
				'role'         => ( 0 === $i ) ? 'bug_tracker_manager' : 'bug_tracker_contributor',
			) );
			if ( ! is_wp_error( $id ) ) {
				$new_users[] = (int) $id;
			}
		}
		$team = array_values( array_unique( array_merge( array( $me ), $new_users ) ) );

		/* ---- projects ---- */
		$catalog = array(
			array( 'Website Redesign', 'WEB', '#6366f1', 'Marketing site rebuild and CMS migration.' ),
			array( 'Mobile App', 'APP', '#10b981', 'iOS and Android customer app.' ),
			array( 'Public API', 'API', '#f59e0b', 'REST/GraphQL API and developer portal.' ),
			array( 'Billing Service', 'BIL', '#ef4444', 'Invoices, subscriptions and payment providers.' ),
			array( 'Admin Dashboard', 'DSH', '#0ea5e9', 'Internal analytics and operations tooling.' ),
			array( 'Checkout Flow', 'CHK', '#a855f7', 'Cart, checkout and order confirmation.' ),
			array( 'Search & Discovery', 'SRC', '#14b8a6', 'Search relevance, filters and recommendations.' ),
			array( 'Infrastructure', 'INF', '#64748b', 'CI/CD, hosting and observability.' ),
		);
		shuffle( $catalog );
		$project_ids = array();
		$now         = time();
		foreach ( array_slice( $catalog, 0, $projects_n ) as $c ) {
			$lead = $team[ array_rand( $team ) ];
			$wpdb->insert( BT_Database::table( 'projects' ), array(
				'name' => $c[0], 'project_key' => $c[1], 'description' => $c[3], 'color' => $c[2], 'status' => 'active',
				'lead_id' => $lead, 'created_by' => $me, 'created_at' => gmdate( 'Y-m-d H:i:s', $now - 75 * DAY_IN_SECONDS ), 'updated_at' => gmdate( 'Y-m-d H:i:s', $now ),
			) );
			$pid = (int) $wpdb->insert_id;
			if ( ! $pid ) {
				continue;
			}
			$project_ids[] = $pid;
			foreach ( $team as $uid ) {
				$wpdb->insert( BT_Database::table( 'project_members' ), array( 'project_id' => $pid, 'user_id' => $uid, 'role' => $uid === $lead ? 'maintainer' : 'member', 'created_at' => gmdate( 'Y-m-d H:i:s', $now - 70 * DAY_IN_SECONDS ) ) );
			}
		}
		BT_Helpers::projects_map( true );

		/* ---- bugs ---- */
		$titles = array(
			'Login button unresponsive on Safari', 'Checkout total miscalculated with discount codes', 'Image upload fails above 5 MB', 'Dark mode flashes white on first load',
			'Search returns stale results after reindex', 'Password reset e-mail arrives twice', 'Layout breaks under 360px width', 'App crashes when rotating the device',
			'Typo on the pricing page', 'Dashboard query takes 12s on large accounts', 'Pagination skips the last page', 'CSV export contains duplicate rows',
			'Session expires while filling a long form', 'Tooltip overlaps the sticky header', 'Wrong currency symbol for EUR customers', 'Webhook retries never stop after 200 OK',
			'Notification badge count does not reset', 'Timezone off by one hour around DST change', 'Memory leak in the image gallery', 'Cannot attach files from Android Chrome',
			'Date picker rejects valid leap-day dates', 'Rate limiter blocks internal health checks', 'Broken link in the welcome e-mail', 'Select dropdown cut off inside modal',
			'Double charge when user clicks Pay twice', 'Avatar not updating after profile change', 'API returns 500 for empty filter array', 'Sidebar collapses unexpectedly on resize',
			'Cache not invalidated after product update', 'Sorting by date ignores time component', 'Form loses data on browser back navigation', 'Unicode names break PDF invoices',
			'Slow first paint on 3G connections', 'OAuth callback loops when cookies are blocked', 'Missing alt text on hero images', 'Duplicate orders created on network retry',
			'Search autocomplete flickers while typing', 'Scheduled report sent at wrong time', 'Two-factor code field rejects pasted codes', 'Footer links overlap on tablet portrait',
		);
		$components = array( 'Auth', 'Checkout', 'UI', 'API', 'Search', 'Billing', 'Mobile', 'Reports', 'Notifications', 'Infra' );
		$envs       = array( 'Production, macOS 14, Chrome 126', 'Staging, Windows 11, Edge 125', 'iOS 17.5, Safari', 'Android 14, Pixel 8, Chrome', 'Ubuntu 22.04, Firefox 127', 'Production, WordPress 6.7, PHP 8.3' );
		$comments   = array(
			'Reproduced on my side as well.', 'Looks related to the recent deploy — checking the release notes.', 'I can take this one.', 'Could you share a screenshot or HAR file?',
			'Fixed in the latest build, please verify.', 'Cannot reproduce on staging, only in production.', 'Added logging; we should know more after the next occurrence.',
			'This is blocking the release candidate.', 'Workaround: clear the cache and retry.', 'Root cause found: race condition between two requests.', 'Verified — works as expected now.',
		);
		$statuses = $cfg['statuses'];
		$prios    = wp_list_pluck( $cfg['priorities'], 'slug' );
		$sevs     = wp_list_pluck( $cfg['severities'], 'slug' );
		$weights  = array( 3, 3, 2, 3, 1 ); // status weighting by position (cycled).

		$bug_n = $comment_n = 0;
		for ( $i = 0; $i < $bugs_n && $project_ids; $i++ ) {
			$pid      = $project_ids[ array_rand( $project_ids ) ];
			$reporter = $team[ array_rand( $team ) ];
			$assignee = wp_rand( 1, 100 ) <= 80 ? $team[ array_rand( $team ) ] : 0;
			$age      = wp_rand( 0, 60 ) * DAY_IN_SECONDS + wp_rand( 0, 86000 );
			$created  = $now - $age;
			// weighted status
			$pool = array();
			foreach ( $statuses as $k => $s ) {
				for ( $w = 0; $w < $weights[ $k % count( $weights ) ]; $w++ ) {
					$pool[] = $s;
				}
			}
			$st       = $pool[ array_rand( $pool ) ];
			$done     = in_array( $st['category'], array( 'resolved', 'closed' ), true );
			$updated  = min( $now, $created + wp_rand( 0, max( 1, (int) ( $age * 0.8 ) ) ) );
			$resolved = $done ? min( $now, max( $created + 3600, $updated ) ) : null;
			$title    = $titles[ $i % count( $titles ) ] . ( $i >= count( $titles ) ? ' (#' . ( $i + 1 ) . ')' : '' );
			$prio     = $prios[ min( count( $prios ) - 1, (int) floor( pow( wp_rand( 0, 100 ) / 100, 1.6 ) * count( $prios ) ) ) ];
			$wpdb->insert( BT_Database::table( 'bugs' ), array(
				'project_id' => $pid, 'title' => $title,
				'description' => "Reported during testing: $title.\n\nThis happens intermittently and affects a subset of users.",
				'steps_to_reproduce' => "1. Open the affected page\n2. Perform the action described in the title\n3. Observe the incorrect behaviour",
				'expected_result' => 'The action completes normally.', 'actual_result' => 'An error or incorrect output is shown.',
				'status' => $st['slug'], 'priority' => $prio, 'severity' => $sevs[ array_rand( $sevs ) ],
				'component' => $components[ array_rand( $components ) ], 'version' => wp_rand( 1, 3 ) . '.' . wp_rand( 0, 9 ) . '.' . wp_rand( 0, 9 ),
				'assignee_id' => $assignee, 'reporter_id' => $reporter, 'environment' => $envs[ array_rand( $envs ) ], 'browser' => '',
				'due_date' => ( ! $done && wp_rand( 0, 2 ) ) ? gmdate( 'Y-m-d', $now + wp_rand( -5, 30 ) * DAY_IN_SECONDS ) : null,
				'created_at' => gmdate( 'Y-m-d H:i:s', $created ), 'updated_at' => gmdate( 'Y-m-d H:i:s', $updated ), 'resolved_at' => $resolved ? gmdate( 'Y-m-d H:i:s', $resolved ) : null,
			) );
			$bid = (int) $wpdb->insert_id;
			if ( ! $bid ) {
				continue;
			}
			$bug_n++;
			$act = BT_Database::table( 'activity' );
			$wpdb->insert( $act, array( 'bug_id' => $bid, 'project_id' => $pid, 'user_id' => $reporter, 'action' => 'created', 'field' => '', 'old_value' => null, 'new_value' => $title, 'created_at' => gmdate( 'Y-m-d H:i:s', $created ) ) );
			if ( $st['category'] !== 'open' ) {
				$wpdb->insert( $act, array( 'bug_id' => $bid, 'project_id' => $pid, 'user_id' => $assignee ? $assignee : $reporter, 'action' => 'updated', 'field' => 'status', 'old_value' => BT_Settings::default_status(), 'new_value' => $st['slug'], 'created_at' => gmdate( 'Y-m-d H:i:s', $updated ) ) );
			}
			$n = wp_rand( 0, 4 );
			for ( $c = 0; $c < $n; $c++ ) {
				$author = $team[ array_rand( $team ) ];
				$text   = $comments[ array_rand( $comments ) ];
				if ( 0 === wp_rand( 0, 3 ) && $reporter !== $author && get_userdata( $reporter ) ) {
					$text = '@' . get_userdata( $reporter )->user_login . ' ' . $text;
				}
				$at = gmdate( 'Y-m-d H:i:s', min( $now, $created + wp_rand( 600, max( 700, (int) ( $age * 0.9 ) ) ) ) );
				$wpdb->insert( BT_Database::table( 'comments' ), array( 'bug_id' => $bid, 'user_id' => $author, 'content' => $text, 'created_at' => $at ) );
				$wpdb->insert( $act, array( 'bug_id' => $bid, 'project_id' => $pid, 'user_id' => $author, 'action' => 'commented', 'field' => '', 'old_value' => null, 'new_value' => null, 'created_at' => $at ) );
				$comment_n++;
			}
		}

		update_option( self::OPTION, array(
			'users'    => array_values( array_unique( array_merge( $tracked['users'], $new_users ) ) ),
			'projects' => array_values( array_unique( array_merge( $tracked['projects'], $project_ids ) ) ),
		), false );

		return array( 'users' => count( $new_users ), 'projects' => count( $project_ids ), 'bugs' => $bug_n, 'comments' => $comment_n );
	}

	/** Removes only what generate() created. */
	public static function remove() {
		global $wpdb;
		$t     = self::tracked();
		$before = self::counts();
		if ( $t['projects'] ) {
			$in     = implode( ',', $t['projects'] );
			$bugids = $wpdb->get_col( 'SELECT id FROM ' . BT_Database::table( 'bugs' ) . " WHERE project_id IN ($in)" ); // phpcs:ignore WordPress.DB.PreparedSQL
			BT_Bugs_Controller::delete_bugs( $bugids );
			$wpdb->query( 'DELETE FROM ' . BT_Database::table( 'activity' ) . " WHERE project_id IN ($in)" ); // phpcs:ignore WordPress.DB.PreparedSQL
			$wpdb->query( 'DELETE FROM ' . BT_Database::table( 'project_members' ) . " WHERE project_id IN ($in)" ); // phpcs:ignore WordPress.DB.PreparedSQL
			$wpdb->query( 'DELETE FROM ' . BT_Database::table( 'projects' ) . " WHERE id IN ($in)" ); // phpcs:ignore WordPress.DB.PreparedSQL
		}
		if ( $t['users'] ) {
			$in = implode( ',', $t['users'] );
			$wpdb->query( 'UPDATE ' . BT_Database::table( 'bugs' ) . " SET assignee_id = 0 WHERE assignee_id IN ($in)" ); // phpcs:ignore WordPress.DB.PreparedSQL
			$wpdb->query( 'DELETE FROM ' . BT_Database::table( 'notifications' ) . " WHERE user_id IN ($in)" ); // phpcs:ignore WordPress.DB.PreparedSQL
			require_once ABSPATH . 'wp-admin/includes/user.php';
			foreach ( $t['users'] as $uid ) {
				if ( get_userdata( $uid ) && 0 === strpos( get_userdata( $uid )->user_login, 'bt_demo_' ) ) {
					wp_delete_user( $uid );
				}
			}
		}
		delete_option( self::OPTION );
		BT_Helpers::projects_map( true );
		return $before;
	}
}
