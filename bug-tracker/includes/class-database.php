<?php
defined( 'ABSPATH' ) || exit;

/**
 * Custom table definitions. All tables use the site's $wpdb->prefix.
 */
class BT_Database {

	const DB_VERSION_OPTION = 'bug_tracker_db_version';
	const DB_VERSION        = '1.1.0';

	/** Full table name for a short name such as "bugs". */
	public static function table( $name ) {
		global $wpdb;
		return $wpdb->prefix . 'bug_tracker_' . $name;
	}

	public static function table_names() {
		return array( 'projects', 'project_members', 'bugs', 'comments', 'attachments', 'activity', 'notifications', 'users' );
	}

	public static function create_tables() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();
		$t       = array();
		foreach ( self::table_names() as $n ) {
			$t[ $n ] = self::table( $n );
		}

		// NOTE: dbDelta is picky: two spaces after PRIMARY KEY, one column per line.
		$sql = array();

		$sql[] = "CREATE TABLE {$t['projects']} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  name varchar(190) NOT NULL,
  project_key varchar(10) NOT NULL DEFAULT '',
  description text NULL,
  color varchar(9) NOT NULL DEFAULT '#6366f1',
  status varchar(20) NOT NULL DEFAULT 'active',
  lead_id bigint(20) unsigned NOT NULL DEFAULT 0,
  created_by bigint(20) unsigned NOT NULL DEFAULT 0,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY status (status),
  KEY lead_id (lead_id)
) $charset;";

		$sql[] = "CREATE TABLE {$t['project_members']} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  project_id bigint(20) unsigned NOT NULL,
  user_id bigint(20) unsigned NOT NULL,
  role varchar(30) NOT NULL DEFAULT 'member',
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY project_user (project_id,user_id),
  KEY user_id (user_id)
) $charset;";

		$sql[] = "CREATE TABLE {$t['bugs']} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  project_id bigint(20) unsigned NOT NULL DEFAULT 0,
  title varchar(255) NOT NULL,
  description longtext NULL,
  steps_to_reproduce longtext NULL,
  expected_result longtext NULL,
  actual_result longtext NULL,
  status varchar(60) NOT NULL DEFAULT 'open',
  priority varchar(60) NOT NULL DEFAULT 'medium',
  severity varchar(60) NOT NULL DEFAULT 'minor',
  component varchar(190) NOT NULL DEFAULT '',
  version varchar(100) NOT NULL DEFAULT '',
  assignee_id bigint(20) unsigned NOT NULL DEFAULT 0,
  reporter_id bigint(20) unsigned NOT NULL DEFAULT 0,
  environment text NULL,
  browser varchar(255) NOT NULL DEFAULT '',
  due_date date NULL,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  resolved_at datetime NULL,
  PRIMARY KEY  (id),
  KEY project_id (project_id),
  KEY status (status),
  KEY priority (priority),
  KEY assignee_id (assignee_id),
  KEY reporter_id (reporter_id),
  KEY created_at (created_at)
) $charset;";

		$sql[] = "CREATE TABLE {$t['comments']} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  bug_id bigint(20) unsigned NOT NULL,
  user_id bigint(20) unsigned NOT NULL,
  content longtext NOT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY bug_id (bug_id)
) $charset;";

		$sql[] = "CREATE TABLE {$t['attachments']} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  bug_id bigint(20) unsigned NOT NULL,
  user_id bigint(20) unsigned NOT NULL,
  file_name varchar(255) NOT NULL,
  stored_name varchar(255) NOT NULL,
  mime_type varchar(100) NOT NULL DEFAULT '',
  file_size bigint(20) unsigned NOT NULL DEFAULT 0,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY bug_id (bug_id)
) $charset;";

		$sql[] = "CREATE TABLE {$t['activity']} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  bug_id bigint(20) unsigned NOT NULL DEFAULT 0,
  project_id bigint(20) unsigned NOT NULL DEFAULT 0,
  user_id bigint(20) unsigned NOT NULL DEFAULT 0,
  action varchar(40) NOT NULL,
  field varchar(60) NOT NULL DEFAULT '',
  old_value text NULL,
  new_value text NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY bug_id (bug_id),
  KEY project_id (project_id),
  KEY created_at (created_at)
) $charset;";

		$sql[] = "CREATE TABLE {$t['notifications']} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  user_id bigint(20) unsigned NOT NULL,
  bug_id bigint(20) unsigned NOT NULL DEFAULT 0,
  actor_id bigint(20) unsigned NOT NULL DEFAULT 0,
  type varchar(30) NOT NULL,
  message text NOT NULL,
  is_read tinyint(1) NOT NULL DEFAULT 0,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY user_read (user_id,is_read),
  KEY bug_id (bug_id)
) $charset;";

		// v1.1.0: plugin-owned users (independent of WordPress roles/capabilities).
		$sql[] = "CREATE TABLE {$t['users']} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  user_id bigint(20) unsigned NOT NULL,
  status varchar(10) NOT NULL DEFAULT 'active',
  permissions text NULL,
  created_by bigint(20) unsigned NOT NULL DEFAULT 0,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  status_changed_at datetime NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY user_id (user_id),
  KEY status (status)
) $charset;";

		foreach ( $sql as $statement ) {
			dbDelta( $statement );
		}

		update_option( self::DB_VERSION_OPTION, self::DB_VERSION );
	}

	public static function maybe_upgrade() {
		if ( get_option( self::DB_VERSION_OPTION ) !== self::DB_VERSION ) {
			self::create_tables(); // additive only (dbDelta never drops anything).
		}
		BT_Users::maybe_migrate();
	}

	public static function drop_tables() {
		global $wpdb;
		foreach ( self::table_names() as $n ) {
			$wpdb->query( 'DROP TABLE IF EXISTS ' . self::table( $n ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		}
		delete_option( self::DB_VERSION_OPTION );
	}
}
