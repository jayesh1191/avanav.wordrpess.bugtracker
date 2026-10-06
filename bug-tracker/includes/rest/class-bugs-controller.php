<?php
defined( 'ABSPATH' ) || exit;

/**
 * Bugs, comments, activity and attachments.
 */
class BT_Bugs_Controller {

	const TEXT_FIELDS = array( 'description', 'steps_to_reproduce', 'expected_result', 'actual_result', 'environment' );
	const LINE_FIELDS = array( 'title' => 255, 'component' => 190, 'version' => 100, 'browser' => 255 );

	/* ================================================================ */
	/* Data access                                                      */
	/* ================================================================ */

	public static function get_bug( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . BT_Database::table( 'bugs' ) . ' WHERE id = %d', (int) $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/** Bug the current user may see, or a 404 (never leak existence of hidden bugs). */
	private function visible_bug( $id ) {
		$bug = self::get_bug( $id );
		if ( ! $bug || ! BT_Permissions::can_access_bug( $bug ) ) {
			return BT_Helpers::error( 'bt_not_found', __( 'Bug not found.', 'bug-tracker' ), 404 );
		}
		return $bug;
	}

	public function format_bug( $b, $detail = false ) {
		$out = array(
			'id'            => (int) $b->id,
			'title'         => $b->title,
			'status'        => $b->status,
			'priority'      => $b->priority,
			'severity'      => $b->severity,
			'project'       => BT_Helpers::project_summary( $b->project_id ),
			'component'     => $b->component,
			'version'       => $b->version,
			'assignee'      => BT_Helpers::user( $b->assignee_id ),
			'reporter'      => BT_Helpers::user( $b->reporter_id ),
			'due_date'      => $b->due_date,
			'created_at'    => BT_Helpers::iso( $b->created_at ),
			'updated_at'    => BT_Helpers::iso( $b->updated_at ),
			'resolved_at'   => BT_Helpers::iso( $b->resolved_at ),
			'comment_count' => isset( $b->comment_count ) ? (int) $b->comment_count : 0,
			'attachment_count' => isset( $b->attachment_count ) ? (int) $b->attachment_count : 0,
		);
		if ( $detail ) {
			global $wpdb;
			$out['comment_count']    = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . BT_Database::table( 'comments' ) . ' WHERE bug_id = %d', $b->id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
			$out['attachment_count'] = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . BT_Database::table( 'attachments' ) . ' WHERE bug_id = %d', $b->id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
			foreach ( self::TEXT_FIELDS as $f ) {
				$out[ $f ] = $b->$f;
			}
			$out['browser']     = $b->browser;
			$out['attachments'] = $this->attachments_for( $b->id );
			$out['can_edit']    = BT_Permissions::can_edit_bug( $b );
			$out['can_delete']  = BT_Permissions::can_delete_bug( $b );
		}
		return $out;
	}

	private function attachments_for( $bug_id ) {
		global $wpdb;
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . BT_Database::table( 'attachments' ) . ' WHERE bug_id = %d ORDER BY id ASC', (int) $bug_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		return array_map( array( $this, 'format_attachment' ), $rows );
	}

	private function format_attachment( $a ) {
		$url = add_query_arg( '_wpnonce', wp_create_nonce( 'wp_rest' ), rest_url( BUG_TRACKER_NAMESPACE . '/attachments/' . (int) $a->id . '/download' ) );
		return array(
			'id'         => (int) $a->id,
			'bug_id'     => (int) $a->bug_id,
			'file_name'  => $a->file_name,
			'mime_type'  => $a->mime_type,
			'size'       => (int) $a->file_size,
			'is_image'   => 0 === strpos( $a->mime_type, 'image/' ),
			'url'        => $url,
			'user'       => BT_Helpers::user( $a->user_id ),
			'created_at' => BT_Helpers::iso( $a->created_at ),
		);
	}

	/* ================================================================ */
	/* Validation                                                       */
	/* ================================================================ */

	/**
	 * Validate user input. Returns array of column => value (only provided keys when $partial) or WP_Error.
	 */
	private function read_fields( WP_REST_Request $r, $partial ) {
		$out    = array();
		$errors = array();
		$has    = function ( $k ) use ( $r ) {
			return null !== $r->get_param( $k );
		};

		foreach ( self::LINE_FIELDS as $k => $max ) {
			if ( ! $has( $k ) ) {
				continue;
			}
			$v = trim( sanitize_text_field( (string) $r->get_param( $k ) ) );
			if ( 'title' === $k && '' === $v ) {
				$errors['title'] = __( 'Title is required.', 'bug-tracker' );
			} elseif ( mb_strlen( $v ) > $max ) {
				$errors[ $k ] = sprintf( __( 'Must be %d characters or fewer.', 'bug-tracker' ), $max );
			} else {
				$out[ $k ] = $v;
			}
		}
		if ( ! $partial && ! isset( $out['title'] ) && ! isset( $errors['title'] ) ) {
			$errors['title'] = __( 'Title is required.', 'bug-tracker' );
		}

		foreach ( self::TEXT_FIELDS as $k ) {
			if ( $has( $k ) ) {
				$v = sanitize_textarea_field( (string) $r->get_param( $k ) );
				if ( mb_strlen( $v ) > 50000 ) {
					$errors[ $k ] = __( 'Text is too long.', 'bug-tracker' );
				} else {
					$out[ $k ] = $v;
				}
			}
		}

		foreach ( array( 'status' => 'statuses', 'priority' => 'priorities', 'severity' => 'severities' ) as $k => $list ) {
			if ( $has( $k ) ) {
				$v = sanitize_key( $r->get_param( $k ) );
				if ( ! in_array( $v, BT_Settings::slugs( $list ), true ) ) {
					$errors[ $k ] = sprintf( __( 'Invalid %s.', 'bug-tracker' ), $k );
				} else {
					$out[ $k ] = $v;
				}
			}
		}

		if ( $has( 'due_date' ) ) {
			$v = trim( (string) $r->get_param( 'due_date' ) );
			if ( '' === $v ) {
				$out['due_date'] = null;
			} else {
				$d = DateTime::createFromFormat( 'Y-m-d', $v );
				if ( ! $d || $d->format( 'Y-m-d' ) !== $v ) {
					$errors['due_date'] = __( 'Use the format YYYY-MM-DD.', 'bug-tracker' );
				} else {
					$out['due_date'] = $v;
				}
			}
		}

		if ( $has( 'project_id' ) ) {
			$pid = (int) $r->get_param( 'project_id' );
			if ( ! isset( BT_Helpers::projects_map()[ $pid ] ) ) {
				$errors['project_id'] = __( 'Select a valid project.', 'bug-tracker' );
			} elseif ( ! BT_Permissions::can_access_project( $pid ) ) {
				$errors['project_id'] = __( 'You do not have access to that project.', 'bug-tracker' );
			} else {
				$out['project_id'] = $pid;
			}
		} elseif ( ! $partial ) {
			$errors['project_id'] = __( 'Select a project.', 'bug-tracker' );
		}

		if ( $has( 'assignee_id' ) ) {
			$out['assignee_id'] = (int) $r->get_param( 'assignee_id' );
			if ( $out['assignee_id'] < 0 ) {
				$out['assignee_id'] = 0;
			}
		}

		if ( $errors ) {
			return BT_Helpers::error( 'bt_validation', __( 'Please fix the highlighted fields.', 'bug-tracker' ), 400, array( 'fields' => $errors ) );
		}
		return $out;
	}

	/** Assignee must be a bug-tracker user who can open the project. */
	private function validate_assignee( $assignee_id, $project_id ) {
		if ( ! $assignee_id ) {
			return true;
		}
		$u = get_userdata( $assignee_id );
		if ( ! $u || ! user_can( $u, 'view_bug_tracker' ) ) {
			return BT_Helpers::error( 'bt_validation', __( 'That user cannot be assigned bugs.', 'bug-tracker' ), 400, array( 'fields' => array( 'assignee_id' => __( 'That user cannot be assigned bugs.', 'bug-tracker' ) ) ) );
		}
		$ids = BT_Permissions::accessible_project_ids( $assignee_id );
		if ( null !== $ids && ! in_array( (int) $project_id, $ids, true ) ) {
			return BT_Helpers::error( 'bt_validation', __( 'That user is not a member of the bug\'s project.', 'bug-tracker' ), 400, array( 'fields' => array( 'assignee_id' => __( 'That user is not a member of this project.', 'bug-tracker' ) ) ) );
		}
		return true;
	}

	/* ================================================================ */
	/* GET /bugs                                                        */
	/* ================================================================ */

	public function index( WP_REST_Request $r ) {
		global $wpdb;
		$bugs   = BT_Database::table( 'bugs' );
		$export = (bool) $r->get_param( 'export' );
		$page   = max( 1, (int) $r->get_param( 'page' ) );
		$max    = $export ? 5000 : 100;
		$per    = (int) $r->get_param( 'per_page' );
		$per    = $per > 0 ? min( $per, $max ) : (int) BT_Settings::get()['project']['per_page'];

		$where = array( BT_Permissions::bug_scope_sql( 'b' ) );

		foreach ( array( 'status', 'priority', 'severity' ) as $k ) {
			$raw = (string) $r->get_param( $k );
			if ( '' === $raw ) {
				continue;
			}
			$vals = array_filter( array_map( 'sanitize_key', explode( ',', $raw ) ) );
			if ( $vals ) {
				$where[] = $wpdb->prepare( "b.$k IN (" . implode( ',', array_fill( 0, count( $vals ), '%s' ) ) . ')', $vals ); // phpcs:ignore WordPress.DB.PreparedSQL
			}
		}
		$pids = array_filter( array_map( 'intval', explode( ',', (string) $r->get_param( 'project_id' ) ) ) );
		if ( $pids ) {
			$where[] = 'b.project_id IN (' . implode( ',', $pids ) . ')';
		}
		$assignee = (string) $r->get_param( 'assignee_id' );
		if ( 'me' === $assignee ) {
			$where[] = $wpdb->prepare( 'b.assignee_id = %d', get_current_user_id() );
		} elseif ( 'unassigned' === $assignee ) {
			$where[] = 'b.assignee_id = 0';
		} elseif ( ctype_digit( $assignee ) && (int) $assignee > 0 ) {
			$where[] = $wpdb->prepare( 'b.assignee_id = %d', (int) $assignee );
		}
		$reporter = (string) $r->get_param( 'reporter_id' );
		if ( 'me' === $reporter ) {
			$where[] = $wpdb->prepare( 'b.reporter_id = %d', get_current_user_id() );
		} elseif ( ctype_digit( $reporter ) && (int) $reporter > 0 ) {
			$where[] = $wpdb->prepare( 'b.reporter_id = %d', (int) $reporter );
		}
		$search = trim( sanitize_text_field( (string) $r->get_param( 'search' ) ) );
		if ( '' !== $search ) {
			$like = '%' . $wpdb->esc_like( $search ) . '%';
			$id   = ltrim( $search, '#' );
			if ( ctype_digit( $id ) ) {
				$where[] = $wpdb->prepare( '(b.id = %d OR b.title LIKE %s OR b.description LIKE %s)', (int) $id, $like, $like );
			} else {
				$where[] = $wpdb->prepare( '(b.title LIKE %s OR b.description LIKE %s OR b.component LIKE %s)', $like, $like, $like );
			}
		}
		$where_sql = implode( ' AND ', $where );

		// Sorting (whitelisted).
		$dir     = 'asc' === strtolower( (string) $r->get_param( 'order' ) ) ? 'ASC' : 'DESC';
		$field_in = function ( $col, $list ) {
			$slugs = array_map( 'esc_sql', BT_Settings::slugs( $list ) );
			return "FIELD($col,'" . implode( "','", $slugs ) . "')";
		};
		$orders = array(
			'id'         => 'b.id',
			'title'      => 'b.title',
			'status'     => $field_in( 'b.status', 'statuses' ),
			'priority'   => $field_in( 'b.priority', 'priorities' ),
			'severity'   => $field_in( 'b.severity', 'severities' ),
			'project'    => 'p.name',
			'assignee'   => 'au.display_name',
			'reporter'   => 'ru.display_name',
			'created_at' => 'b.created_at',
			'updated_at' => 'b.updated_at',
			'due_date'   => 'b.due_date',
		);
		$ob       = (string) $r->get_param( 'orderby' );
		$order_sql = ( isset( $orders[ $ob ] ) ? $orders[ $ob ] : 'b.created_at' ) . " $dir, b.id $dir";

		$projects = BT_Database::table( 'projects' );
		$from     = "FROM $bugs b LEFT JOIN $projects p ON p.id = b.project_id LEFT JOIN {$wpdb->users} au ON au.ID = b.assignee_id LEFT JOIN {$wpdb->users} ru ON ru.ID = b.reporter_id";

		$total = (int) $wpdb->get_var( "SELECT COUNT(*) $from WHERE $where_sql" ); // phpcs:ignore WordPress.DB.PreparedSQL
		$cm    = BT_Database::table( 'comments' );
		$at    = BT_Database::table( 'attachments' );
		$rows  = $wpdb->get_results( $wpdb->prepare(
			"SELECT b.*, (SELECT COUNT(*) FROM $cm c WHERE c.bug_id = b.id) AS comment_count, (SELECT COUNT(*) FROM $at a WHERE a.bug_id = b.id) AS attachment_count $from WHERE $where_sql ORDER BY $order_sql LIMIT %d OFFSET %d", // phpcs:ignore WordPress.DB.PreparedSQL
			$per,
			( $page - 1 ) * $per
		) );

		return rest_ensure_response( array(
			'items'       => array_map( array( $this, 'format_bug' ), $rows ),
			'total'       => $total,
			'page'        => $page,
			'per_page'    => $per,
			'total_pages' => (int) max( 1, ceil( $total / $per ) ),
		) );
	}

	/* ================================================================ */
	/* CRUD                                                             */
	/* ================================================================ */

	public function show( WP_REST_Request $r ) {
		$bug = $this->visible_bug( $r['id'] );
		if ( is_wp_error( $bug ) ) {
			return $bug;
		}
		return rest_ensure_response( $this->format_bug( $bug, true ) );
	}

	public function create( WP_REST_Request $r ) {
		global $wpdb;
		$f = $this->read_fields( $r, false );
		if ( is_wp_error( $f ) ) {
			return $f;
		}
		if ( empty( $f['status'] ) ) {
			$f['status'] = BT_Settings::default_status();
		}
		$cfg = BT_Settings::get();
		if ( empty( $f['priority'] ) ) {
			$f['priority'] = $cfg['priorities'][ min( 1, count( $cfg['priorities'] ) - 1 ) ]['slug'];
		}
		if ( empty( $f['severity'] ) ) {
			$f['severity'] = $cfg['severities'][ min( 1, count( $cfg['severities'] ) - 1 ) ]['slug'];
		}
		if ( empty( $f['assignee_id'] ) && 'project_lead' === $cfg['project']['default_assignee'] ) {
			$lead = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT lead_id FROM ' . BT_Database::table( 'projects' ) . ' WHERE id = %d', $f['project_id'] ) ); // phpcs:ignore WordPress.DB.PreparedSQL
			if ( $lead ) {
				$f['assignee_id'] = $lead;
			}
		}
		$f['assignee_id'] = isset( $f['assignee_id'] ) ? $f['assignee_id'] : 0;
		$ok               = $this->validate_assignee( $f['assignee_id'], $f['project_id'] );
		if ( is_wp_error( $ok ) ) {
			return $ok;
		}

		$now                = BT_Helpers::now();
		$f['reporter_id']   = get_current_user_id();
		$f['created_at']    = $now;
		$f['updated_at']    = $now;
		$f['resolved_at']   = BT_Settings::is_done( $f['status'] ) ? $now : null;

		if ( false === $wpdb->insert( BT_Database::table( 'bugs' ), $f ) ) {
			return BT_Helpers::error( 'bt_db_error', __( 'Could not save the bug.', 'bug-tracker' ), 500 );
		}
		$bug = self::get_bug( $wpdb->insert_id );
		BT_Helpers::log_activity( $bug->id, $bug->project_id, 'created', '', null, $bug->title );

		if ( $bug->assignee_id ) {
			BT_Notifications::send( array( $bug->assignee_id ), 'assignment', $bug, sprintf( __( 'You were assigned bug #%1$d: %2$s', 'bug-tracker' ), $bug->id, $bug->title ) );
		}
		$resp = rest_ensure_response( $this->format_bug( $bug, true ) );
		$resp->set_status( 201 );
		return $resp;
	}

	public function update( WP_REST_Request $r ) {
		global $wpdb;
		$bug = $this->visible_bug( $r['id'] );
		if ( is_wp_error( $bug ) ) {
			return $bug;
		}
		if ( ! BT_Permissions::can_edit_bug( $bug ) ) {
			return BT_Helpers::error( 'bt_forbidden', __( 'You cannot edit this bug.', 'bug-tracker' ), 403 );
		}
		$f = $this->read_fields( $r, true );
		if ( is_wp_error( $f ) ) {
			return $f;
		}
		$result = $this->apply_update( $bug, $f );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return rest_ensure_response( $this->format_bug( self::get_bug( $bug->id ), true ) );
	}

	/**
	 * Persist changes, record activity and send notifications.
	 *
	 * @param object $bug Existing row.
	 * @param array  $f   Validated column => value.
	 */
	private function apply_update( $bug, array $f ) {
		global $wpdb;
		$project_id = isset( $f['project_id'] ) ? $f['project_id'] : (int) $bug->project_id;
		if ( array_key_exists( 'assignee_id', $f ) || isset( $f['project_id'] ) ) {
			$assignee = array_key_exists( 'assignee_id', $f ) ? $f['assignee_id'] : (int) $bug->assignee_id;
			// Only validate when something relevant actually changes.
			if ( $assignee !== (int) $bug->assignee_id || $project_id !== (int) $bug->project_id ) {
				$ok = $this->validate_assignee( $assignee, $project_id );
				if ( is_wp_error( $ok ) ) {
					return $ok;
				}
			}
		}

		$changes = array();
		foreach ( $f as $k => $v ) {
			if ( (string) $bug->$k !== (string) $v ) {
				$changes[ $k ] = $v;
			}
		}
		if ( ! $changes ) {
			return true;
		}

		$now = BT_Helpers::now();
		if ( isset( $changes['status'] ) ) {
			$was_done = BT_Settings::is_done( $bug->status );
			$is_done  = BT_Settings::is_done( $changes['status'] );
			if ( $is_done && ! $was_done ) {
				$changes['resolved_at'] = $now;
			} elseif ( ! $is_done ) {
				$changes['resolved_at'] = null;
			}
		}
		$changes['updated_at'] = $now;

		$wpdb->update( BT_Database::table( 'bugs' ), $changes, array( 'id' => (int) $bug->id ) );

		$long = array_merge( self::TEXT_FIELDS );
		foreach ( $changes as $k => $v ) {
			if ( in_array( $k, array( 'updated_at', 'resolved_at' ), true ) ) {
				continue;
			}
			$old = $bug->$k;
			$new = $v;
			if ( 'assignee_id' === $k ) {
				$old = $old ? BT_Helpers::user( $old )['name'] : '';
				$new = $new ? BT_Helpers::user( $new )['name'] : '';
				$k   = 'assignee';
			} elseif ( 'project_id' === $k ) {
				$old = BT_Helpers::project_summary( $old )['name'] ?? '';
				$new = BT_Helpers::project_summary( $new )['name'] ?? '';
				$k   = 'project';
			} elseif ( in_array( $k, $long, true ) ) {
				$old = '';
				$new = '';
			}
			BT_Helpers::log_activity( $bug->id, $project_id, 'updated', $k, $old, $new );
		}

		$fresh = self::get_bug( $bug->id );
		$label = sprintf( '#%d %s', $fresh->id, $fresh->title );
		if ( isset( $changes['assignee_id'] ) && $changes['assignee_id'] ) {
			BT_Notifications::send( array( $changes['assignee_id'] ), 'assignment', $fresh, sprintf( __( 'You were assigned bug %s', 'bug-tracker' ), $label ) );
		}
		if ( isset( $changes['status'] ) ) {
			$to = array( $fresh->reporter_id, $fresh->assignee_id );
			if ( BT_Settings::is_done( $fresh->status ) ) {
				BT_Notifications::send( $to, 'resolution', $fresh, sprintf( __( 'Bug %1$s was marked %2$s', 'bug-tracker' ), $label, BT_Settings::label( 'statuses', $fresh->status ) ) );
			} else {
				BT_Notifications::send( $to, 'status', $fresh, sprintf( __( 'Bug %1$s changed status to %2$s', 'bug-tracker' ), $label, BT_Settings::label( 'statuses', $fresh->status ) ) );
			}
		}
		return true;
	}

	public function destroy( WP_REST_Request $r ) {
		$bug = $this->visible_bug( $r['id'] );
		if ( is_wp_error( $bug ) ) {
			return $bug;
		}
		if ( ! BT_Permissions::can_delete_bug( $bug ) ) {
			return BT_Helpers::error( 'bt_forbidden', __( 'You cannot delete this bug.', 'bug-tracker' ), 403 );
		}
		self::delete_bugs( array( $bug->id ) );
		return rest_ensure_response( array( 'deleted' => true, 'id' => (int) $bug->id ) );
	}

	/** Delete bugs and everything attached to them (also used when deleting a project). */
	public static function delete_bugs( array $ids ) {
		global $wpdb;
		$ids = array_values( array_filter( array_map( 'intval', $ids ) ) );
		if ( ! $ids ) {
			return;
		}
		$in = implode( ',', $ids );
		$bt = BT_Database::table( 'bugs' );

		$titles = $wpdb->get_results( "SELECT id, project_id, title FROM $bt WHERE id IN ($in)" ); // phpcs:ignore WordPress.DB.PreparedSQL
		$files  = $wpdb->get_col( 'SELECT stored_name FROM ' . BT_Database::table( 'attachments' ) . " WHERE bug_id IN ($in)" ); // phpcs:ignore WordPress.DB.PreparedSQL
		$dir    = BT_Helpers::upload_dir();
		foreach ( $files as $stored ) {
			$path = $dir . '/' . basename( $stored );
			if ( is_file( $path ) ) {
				wp_delete_file( $path );
			}
		}
		foreach ( array( 'attachments', 'comments', 'activity' ) as $t ) {
			$wpdb->query( 'DELETE FROM ' . BT_Database::table( $t ) . " WHERE bug_id IN ($in)" ); // phpcs:ignore WordPress.DB.PreparedSQL
		}
		BT_Notifications::delete_for_bugs( $ids );
		$wpdb->query( "DELETE FROM $bt WHERE id IN ($in)" ); // phpcs:ignore WordPress.DB.PreparedSQL

		foreach ( $titles as $t ) {
			BT_Helpers::log_activity( 0, $t->project_id, 'deleted', '', null, '#' . $t->id . ' ' . $t->title );
		}
	}

	/* ================================================================ */
	/* Bulk                                                             */
	/* ================================================================ */

	public function bulk( WP_REST_Request $r ) {
		$ids    = array_slice( array_unique( array_filter( array_map( 'intval', (array) $r->get_param( 'ids' ) ) ) ), 0, 200 );
		$action = (string) $r->get_param( 'action' );
		$value  = $r->get_param( 'value' );
		if ( ! $ids || ! in_array( $action, array( 'status', 'priority', 'severity', 'assign', 'delete' ), true ) ) {
			return BT_Helpers::error( 'bt_validation', __( 'Choose bugs and a valid bulk action.', 'bug-tracker' ) );
		}

		$fake = new WP_REST_Request( 'PUT' );
		if ( 'assign' === $action ) {
			$fake->set_param( 'assignee_id', (int) $value );
		} elseif ( 'delete' !== $action ) {
			$fake->set_param( $action, $value );
		}
		$fields = array();
		if ( 'delete' !== $action ) {
			if ( ! current_user_can( 'edit_bug' ) ) {
				return BT_Helpers::error( 'bt_forbidden', __( 'You cannot edit bugs.', 'bug-tracker' ), 403 );
			}
			$fields = $this->read_fields( $fake, true );
			if ( is_wp_error( $fields ) ) {
				return $fields;
			}
		}

		$done   = array();
		$failed = array();
		$delete = array();
		foreach ( $ids as $id ) {
			$bug = self::get_bug( $id );
			if ( ! $bug || ! BT_Permissions::can_access_bug( $bug ) ) {
				$failed[] = array( 'id' => $id, 'reason' => 'not_found' );
				continue;
			}
			if ( 'delete' === $action ) {
				if ( BT_Permissions::can_delete_bug( $bug ) ) {
					$delete[] = $id;
				} else {
					$failed[] = array( 'id' => $id, 'reason' => 'forbidden' );
				}
				continue;
			}
			if ( ! BT_Permissions::can_edit_bug( $bug ) ) {
				$failed[] = array( 'id' => $id, 'reason' => 'forbidden' );
				continue;
			}
			$res = $this->apply_update( $bug, $fields );
			if ( is_wp_error( $res ) ) {
				$failed[] = array( 'id' => $id, 'reason' => $res->get_error_message() );
			} else {
				$done[] = $id;
			}
		}
		if ( $delete ) {
			self::delete_bugs( $delete );
			$done = array_merge( $done, $delete );
		}
		return rest_ensure_response( array( 'updated' => $done, 'failed' => $failed ) );
	}

	/* ================================================================ */
	/* Comments                                                         */
	/* ================================================================ */

	private function format_comment( $c, $bug = null ) {
		$can_delete = false;
		if ( current_user_can( 'delete_bug' ) || (int) $c->user_id === get_current_user_id() ) {
			$can_delete = current_user_can( 'create_bug' );
		}
		return array(
			'id'         => (int) $c->id,
			'bug_id'     => (int) $c->bug_id,
			'content'    => $c->content,
			'user'       => BT_Helpers::user( $c->user_id ),
			'created_at' => BT_Helpers::iso( $c->created_at ),
			'can_delete' => $can_delete,
		);
	}

	public function comments_index( WP_REST_Request $r ) {
		global $wpdb;
		$bug = $this->visible_bug( $r['id'] );
		if ( is_wp_error( $bug ) ) {
			return $bug;
		}
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . BT_Database::table( 'comments' ) . ' WHERE bug_id = %d ORDER BY id ASC', $bug->id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		return rest_ensure_response( array_map( array( $this, 'format_comment' ), $rows ) );
	}

	public function comments_create( WP_REST_Request $r ) {
		global $wpdb;
		$bug = $this->visible_bug( $r['id'] );
		if ( is_wp_error( $bug ) ) {
			return $bug;
		}
		$content = trim( sanitize_textarea_field( (string) $r->get_param( 'content' ) ) );
		if ( '' === $content ) {
			return BT_Helpers::error( 'bt_validation', __( 'Comment cannot be empty.', 'bug-tracker' ), 400, array( 'fields' => array( 'content' => __( 'Comment cannot be empty.', 'bug-tracker' ) ) ) );
		}
		if ( mb_strlen( $content ) > 20000 ) {
			return BT_Helpers::error( 'bt_validation', __( 'Comment is too long.', 'bug-tracker' ) );
		}
		$wpdb->insert( BT_Database::table( 'comments' ), array(
			'bug_id'     => $bug->id,
			'user_id'    => get_current_user_id(),
			'content'    => $content,
			'created_at' => BT_Helpers::now(),
		) );
		$id = $wpdb->insert_id;
		$wpdb->update( BT_Database::table( 'bugs' ), array( 'updated_at' => BT_Helpers::now() ), array( 'id' => $bug->id ) );
		BT_Helpers::log_activity( $bug->id, $bug->project_id, 'commented' );

		$label     = sprintf( '#%d %s', $bug->id, $bug->title );
		$mentioned = BT_Notifications::mentioned_user_ids( $content );
		BT_Notifications::send( $mentioned, 'mention', $bug, sprintf( __( '%1$s mentioned you on bug %2$s', 'bug-tracker' ), wp_get_current_user()->display_name, $label ) );
		$others = array_diff( array( $bug->reporter_id, $bug->assignee_id ), $mentioned );
		BT_Notifications::send( $others, 'comment', $bug, sprintf( __( '%1$s commented on bug %2$s', 'bug-tracker' ), wp_get_current_user()->display_name, $label ) );

		$row  = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . BT_Database::table( 'comments' ) . ' WHERE id = %d', $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		$resp = rest_ensure_response( $this->format_comment( $row ) );
		$resp->set_status( 201 );
		return $resp;
	}

	public function comments_destroy( WP_REST_Request $r ) {
		global $wpdb;
		$t = BT_Database::table( 'comments' );
		$c = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $t WHERE id = %d", (int) $r['id'] ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		$bug = $c ? $this->visible_bug( $c->bug_id ) : null;
		if ( ! $c || is_wp_error( $bug ) ) {
			return BT_Helpers::error( 'bt_not_found', __( 'Comment not found.', 'bug-tracker' ), 404 );
		}
		if ( ! ( current_user_can( 'delete_bug' ) || (int) $c->user_id === get_current_user_id() ) ) {
			return BT_Helpers::error( 'bt_forbidden', __( 'You cannot delete this comment.', 'bug-tracker' ), 403 );
		}
		$wpdb->delete( $t, array( 'id' => $c->id ) );
		return rest_ensure_response( array( 'deleted' => true ) );
	}

	/* ================================================================ */
	/* Activity                                                         */
	/* ================================================================ */

	public static function format_activity( $a ) {
		return array(
			'id'         => (int) $a->id,
			'bug_id'     => (int) $a->bug_id,
			'bug_title'  => isset( $a->bug_title ) ? $a->bug_title : null,
			'project_id' => (int) $a->project_id,
			'action'     => $a->action,
			'field'      => $a->field,
			'old_value'  => $a->old_value,
			'new_value'  => $a->new_value,
			'user'       => BT_Helpers::user( $a->user_id ),
			'created_at' => BT_Helpers::iso( $a->created_at ),
		);
	}

	public function activity_index( WP_REST_Request $r ) {
		global $wpdb;
		$bug = $this->visible_bug( $r['id'] );
		if ( is_wp_error( $bug ) ) {
			return $bug;
		}
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . BT_Database::table( 'activity' ) . ' WHERE bug_id = %d ORDER BY id DESC LIMIT 200', $bug->id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		return rest_ensure_response( array_map( array( __CLASS__, 'format_activity' ), $rows ) );
	}

	/* ================================================================ */
	/* Attachments                                                      */
	/* ================================================================ */

	public function attachments_create( WP_REST_Request $r ) {
		global $wpdb;
		$bug = $this->visible_bug( $r['id'] );
		if ( is_wp_error( $bug ) ) {
			return $bug;
		}
		$files = $r->get_file_params();
		if ( empty( $files['file'] ) || ! is_array( $files['file'] ) ) {
			return BT_Helpers::error( 'bt_validation', __( 'No file was uploaded.', 'bug-tracker' ) );
		}
		$file = $files['file'];
		if ( UPLOAD_ERR_OK !== (int) $file['error'] ) {
			return BT_Helpers::error( 'bt_upload_failed', __( 'The upload failed. The file may exceed the server upload limit.', 'bug-tracker' ) );
		}
		$limit = min( (int) BT_Settings::get()['project']['max_attachment_mb'] * MB_IN_BYTES, wp_max_upload_size() );
		if ( (int) $file['size'] > $limit ) {
			return BT_Helpers::error( 'bt_file_too_large', sprintf( __( 'File is larger than %s.', 'bug-tracker' ), size_format( $limit ) ), 413 );
		}
		if ( ! is_uploaded_file( $file['tmp_name'] ) ) {
			return BT_Helpers::error( 'bt_upload_failed', __( 'Invalid upload.', 'bug-tracker' ) );
		}
		$name  = sanitize_file_name( wp_unslash( $file['name'] ) );
		$check = wp_check_filetype_and_ext( $file['tmp_name'], $name, BT_Helpers::allowed_mimes() );
		if ( empty( $check['ext'] ) || empty( $check['type'] ) ) {
			return BT_Helpers::error( 'bt_bad_type', __( 'This file type is not allowed.', 'bug-tracker' ), 415 );
		}
		$stored = wp_generate_password( 24, false, false ) . '.' . $check['ext'];
		$dest   = BT_Helpers::upload_dir() . '/' . $stored;
		if ( ! move_uploaded_file( $file['tmp_name'], $dest ) ) {
			return BT_Helpers::error( 'bt_upload_failed', __( 'Could not store the file.', 'bug-tracker' ), 500 );
		}
		chmod( $dest, 0644 );

		$wpdb->insert( BT_Database::table( 'attachments' ), array(
			'bug_id'      => $bug->id,
			'user_id'     => get_current_user_id(),
			'file_name'   => $name,
			'stored_name' => $stored,
			'mime_type'   => $check['type'],
			'file_size'   => (int) $file['size'],
			'created_at'  => BT_Helpers::now(),
		) );
		$id = $wpdb->insert_id;
		$wpdb->update( BT_Database::table( 'bugs' ), array( 'updated_at' => BT_Helpers::now() ), array( 'id' => $bug->id ) );
		BT_Helpers::log_activity( $bug->id, $bug->project_id, 'attachment_added', 'attachment', null, $name );

		$row  = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . BT_Database::table( 'attachments' ) . ' WHERE id = %d', $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		$resp = rest_ensure_response( $this->format_attachment( $row ) );
		$resp->set_status( 201 );
		return $resp;
	}

	private function find_attachment( $id ) {
		global $wpdb;
		$a = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . BT_Database::table( 'attachments' ) . ' WHERE id = %d', (int) $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		if ( ! $a ) {
			return BT_Helpers::error( 'bt_not_found', __( 'Attachment not found.', 'bug-tracker' ), 404 );
		}
		$bug = $this->visible_bug( $a->bug_id );
		if ( is_wp_error( $bug ) ) {
			return $bug;
		}
		return array( $a, $bug );
	}

	public function attachments_destroy( WP_REST_Request $r ) {
		global $wpdb;
		$found = $this->find_attachment( $r['id'] );
		if ( is_wp_error( $found ) ) {
			return $found;
		}
		list( $a, $bug ) = $found;
		if ( ! ( BT_Permissions::can_edit_bug( $bug ) || ( (int) $a->user_id === get_current_user_id() && current_user_can( 'create_bug' ) ) ) ) {
			return BT_Helpers::error( 'bt_forbidden', __( 'You cannot remove this attachment.', 'bug-tracker' ), 403 );
		}
		$path = BT_Helpers::upload_dir() . '/' . basename( $a->stored_name );
		if ( is_file( $path ) ) {
			wp_delete_file( $path );
		}
		$wpdb->delete( BT_Database::table( 'attachments' ), array( 'id' => $a->id ) );
		BT_Helpers::log_activity( $bug->id, $bug->project_id, 'attachment_removed', 'attachment', $a->file_name, null );
		return rest_ensure_response( array( 'deleted' => true ) );
	}

	/** Streams the file after the normal REST authentication + access checks. */
	public function attachments_download( WP_REST_Request $r ) {
		$found = $this->find_attachment( $r['id'] );
		if ( is_wp_error( $found ) ) {
			return $found;
		}
		list( $a ) = $found;
		$path      = BT_Helpers::upload_dir() . '/' . basename( $a->stored_name );
		if ( ! is_file( $path ) ) {
			return BT_Helpers::error( 'bt_not_found', __( 'File is missing on disk.', 'bug-tracker' ), 404 );
		}
		while ( ob_get_level() ) {
			ob_end_clean();
		}
		$inline = in_array( $a->mime_type, array( 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf' ), true );
		nocache_headers();
		header( 'Content-Type: ' . $a->mime_type );
		header( 'Content-Length: ' . filesize( $path ) );
		header( 'X-Content-Type-Options: nosniff' );
		if ( 'application/pdf' !== $a->mime_type ) {
			header( "Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox" );
		}
		header( 'Content-Disposition: ' . ( $inline ? 'inline' : 'attachment' ) . '; filename="' . str_replace( array( '"', "\r", "\n" ), '', $a->file_name ) . '"' );
		readfile( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		exit;
	}
}
