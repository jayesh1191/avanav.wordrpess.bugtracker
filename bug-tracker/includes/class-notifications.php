<?php
defined( 'ABSPATH' ) || exit;

/**
 * In-app notifications (optionally mirrored to e-mail).
 */
class BT_Notifications {

	/**
	 * @param int[]  $user_ids Recipients (the acting user is skipped).
	 * @param string $type     assignment|status|comment|mention|resolution
	 */
	public static function send( $user_ids, $type, $bug, $message ) {
		global $wpdb;
		$settings = BT_Settings::get()['notifications'];
		if ( empty( $settings[ $type ] ) ) {
			return;
		}
		$actor = get_current_user_id();
		$ids   = array_unique( array_filter( array_map( 'intval', (array) $user_ids ) ) );

		foreach ( $ids as $uid ) {
			if ( $uid === $actor || ! get_userdata( $uid ) ) {
				continue;
			}
			// Only notify people who may actually open the bug.
			if ( ! self::user_can_see_bug( $uid, $bug ) ) {
				continue;
			}
			$wpdb->insert(
				BT_Database::table( 'notifications' ),
				array(
					'user_id'    => $uid,
					'bug_id'     => (int) $bug->id,
					'actor_id'   => $actor,
					'type'       => $type,
					'message'    => $message,
					'is_read'    => 0,
					'created_at' => BT_Helpers::now(),
				)
			);
			if ( ! empty( $settings['email'] ) ) {
				$u = get_userdata( $uid );
				wp_mail(
					$u->user_email,
					sprintf( '[%s] %s', wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ), wp_strip_all_tags( $message ) ),
					wp_strip_all_tags( $message ) . "\n\n" . admin_url( 'admin.php?page=bug-tracker#/bugs/' . (int) $bug->id )
				);
			}
		}
	}

	private static function user_can_see_bug( $uid, $bug ) {
		if ( ! user_can( $uid, 'view_bug_tracker' ) ) {
			return false;
		}
		$ids = BT_Permissions::accessible_project_ids( $uid );
		return null === $ids || in_array( (int) $bug->project_id, $ids, true )
			|| (int) $bug->reporter_id === $uid || (int) $bug->assignee_id === $uid;
	}

	/** Extract @login mentions that resolve to real users. */
	public static function mentioned_user_ids( $text ) {
		if ( ! preg_match_all( '/(?<![\w@])@([A-Za-z0-9_.\-]{2,60})/', $text, $m ) ) {
			return array();
		}
		$ids = array();
		foreach ( array_unique( $m[1] ) as $login ) {
			$login = rtrim( $login, '.-' );
			$u     = get_user_by( 'login', $login );
			if ( $u ) {
				$ids[] = (int) $u->ID;
			}
		}
		return $ids;
	}

	public static function delete_for_bugs( $bug_ids ) {
		global $wpdb;
		$bug_ids = array_map( 'intval', (array) $bug_ids );
		if ( $bug_ids ) {
			$wpdb->query( 'DELETE FROM ' . BT_Database::table( 'notifications' ) . ' WHERE bug_id IN (' . implode( ',', $bug_ids ) . ')' ); // phpcs:ignore WordPress.DB.PreparedSQL
		}
	}
}
