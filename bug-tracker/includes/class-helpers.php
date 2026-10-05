<?php
defined( 'ABSPATH' ) || exit;

/**
 * Small shared helpers used by the REST controllers.
 */
class BT_Helpers {

	/** Current UTC time in MySQL format. */
	public static function now() {
		return gmdate( 'Y-m-d H:i:s' );
	}

	/** MySQL (UTC) datetime -> ISO-8601 string. */
	public static function iso( $mysql ) {
		if ( empty( $mysql ) || '0000-00-00 00:00:00' === $mysql ) {
			return null;
		}
		return str_replace( ' ', 'T', $mysql ) . 'Z';
	}

	/** Site UTC offset in seconds, used for grouping by local day. */
	public static function tz_offset() {
		return (int) wp_timezone()->getOffset( new DateTimeImmutable( 'now' ) );
	}

	public static function error( $code, $message, $status = 400, $extra = array() ) {
		return new WP_Error( $code, $message, array_merge( array( 'status' => $status ), $extra ) );
	}

	/**
	 * Public representation of a WordPress user. E-mail only for those allowed to see it.
	 */
	public static function user( $id ) {
		static $cache = array();
		$id = (int) $id;
		if ( $id <= 0 ) {
			return null;
		}
		if ( ! array_key_exists( $id, $cache ) ) {
			$u = get_userdata( $id );
			if ( ! $u ) {
				$cache[ $id ] = array( 'id' => $id, 'name' => __( 'Deleted user', 'bug-tracker' ), 'avatar' => get_avatar_url( 0, array( 'size' => 64 ) ), 'login' => '' );
			} else {
				$cache[ $id ] = array(
					'id'     => $id,
					'name'   => $u->display_name,
					'login'  => $u->user_login,
					'avatar' => get_avatar_url( $id, array( 'size' => 64 ) ),
				);
			}
		}
		return $cache[ $id ];
	}

	/** Id => row map of projects (request-cached). */
	public static function projects_map( $refresh = false ) {
		global $wpdb;
		static $map = null;
		if ( null === $map || $refresh ) {
			$map = array();
			foreach ( $wpdb->get_results( 'SELECT id, name, project_key, color, status FROM ' . BT_Database::table( 'projects' ) ) as $p ) { // phpcs:ignore WordPress.DB.PreparedSQL
				$map[ (int) $p->id ] = $p;
			}
		}
		return $map;
	}

	public static function project_summary( $id ) {
		$map = self::projects_map();
		$id  = (int) $id;
		if ( ! isset( $map[ $id ] ) ) {
			return null;
		}
		$p = $map[ $id ];
		return array( 'id' => $id, 'name' => $p->name, 'key' => $p->project_key, 'color' => $p->color );
	}

	public static function log_activity( $bug_id, $project_id, $action, $field = '', $old = null, $new = null ) {
		global $wpdb;
		$wpdb->insert(
			BT_Database::table( 'activity' ),
			array(
				'bug_id'     => (int) $bug_id,
				'project_id' => (int) $project_id,
				'user_id'    => get_current_user_id(),
				'action'     => $action,
				'field'      => $field,
				'old_value'  => null === $old ? null : (string) $old,
				'new_value'  => null === $new ? null : (string) $new,
				'created_at' => self::now(),
			)
		);
	}

	/** Absolute directory for attachment storage (created + protected on demand). */
	public static function upload_dir() {
		$u   = wp_upload_dir();
		$dir = trailingslashit( $u['basedir'] ) . 'bug-tracker';
		if ( ! is_dir( $dir ) ) {
			wp_mkdir_p( $dir );
			// Files are only ever served through the authenticated REST endpoint.
			file_put_contents( $dir . '/.htaccess', "Options -Indexes\n<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n" );
			file_put_contents( $dir . '/index.php', "<?php\n// Silence is golden.\n" );
		}
		return $dir;
	}

	public static function allowed_mimes() {
		return array(
			'jpg|jpeg|jpe' => 'image/jpeg',
			'png'          => 'image/png',
			'gif'          => 'image/gif',
			'webp'         => 'image/webp',
			'pdf'          => 'application/pdf',
			'txt|log'      => 'text/plain',
			'csv'          => 'text/csv',
			'json'         => 'application/json',
			'zip'          => 'application/zip',
			'doc'          => 'application/msword',
			'docx'         => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'xls'          => 'application/vnd.ms-excel',
			'xlsx'         => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'mp4'          => 'video/mp4',
			'webm'         => 'video/webm',
		);
	}
}
