<?php
defined( 'ABSPATH' ) || exit;

/**
 * Plugin settings: configurable statuses, priorities, severities, etc.
 */
class BT_Settings {

	const OPTION = 'bug_tracker_settings';

	/** Status categories drive dashboard counters and resolved_at tracking. */
	const CATEGORIES = array( 'open', 'in_progress', 'resolved', 'closed' );

	public static function defaults() {
		return array(
			'statuses'      => array(
				array( 'slug' => 'open', 'label' => 'Open', 'color' => '#3b82f6', 'category' => 'open' ),
				array( 'slug' => 'in_progress', 'label' => 'In Progress', 'color' => '#f59e0b', 'category' => 'in_progress' ),
				array( 'slug' => 'resolved', 'label' => 'Resolved', 'color' => '#10b981', 'category' => 'resolved' ),
				array( 'slug' => 'closed', 'label' => 'Closed', 'color' => '#6b7280', 'category' => 'closed' ),
			),
			'priorities'    => array(
				array( 'slug' => 'low', 'label' => 'Low', 'color' => '#64748b' ),
				array( 'slug' => 'medium', 'label' => 'Medium', 'color' => '#3b82f6' ),
				array( 'slug' => 'high', 'label' => 'High', 'color' => '#f97316' ),
				array( 'slug' => 'critical', 'label' => 'Critical', 'color' => '#ef4444' ),
			),
			'severities'    => array(
				array( 'slug' => 'trivial', 'label' => 'Trivial', 'color' => '#94a3b8' ),
				array( 'slug' => 'minor', 'label' => 'Minor', 'color' => '#38bdf8' ),
				array( 'slug' => 'major', 'label' => 'Major', 'color' => '#fb923c' ),
				array( 'slug' => 'blocker', 'label' => 'Blocker', 'color' => '#dc2626' ),
			),
			'notifications' => array(
				'assignment' => true,
				'status'     => true,
				'comment'    => true,
				'mention'    => true,
				'resolution' => true,
				'email'      => false,
			),
			'project'       => array(
				'default_assignee'    => 'none', // none|project_lead
				'restrict_to_members' => true,
				'max_attachment_mb'   => 10,
				'per_page'            => 20,
			),
			'uninstall'     => array( 'delete_data' => false ),
		);
	}

	public static function get() {
		$saved = get_option( self::OPTION, array() );
		if ( ! is_array( $saved ) ) {
			$saved = array();
		}
		$d = self::defaults();
		foreach ( array( 'statuses', 'priorities', 'severities' ) as $k ) {
			if ( empty( $saved[ $k ] ) || ! is_array( $saved[ $k ] ) ) {
				$saved[ $k ] = $d[ $k ];
			}
		}
		foreach ( array( 'notifications', 'project', 'uninstall' ) as $k ) {
			$saved[ $k ] = array_merge( $d[ $k ], isset( $saved[ $k ] ) && is_array( $saved[ $k ] ) ? $saved[ $k ] : array() );
		}
		return $saved;
	}

	public static function slugs( $list ) {
		$s = self::get();
		return wp_list_pluck( $s[ $list ], 'slug' );
	}

	public static function status_category( $slug ) {
		foreach ( self::get()['statuses'] as $st ) {
			if ( $st['slug'] === $slug ) {
				return $st['category'];
			}
		}
		return 'open';
	}

	public static function is_done( $slug ) {
		return in_array( self::status_category( $slug ), array( 'resolved', 'closed' ), true );
	}

	public static function default_status() {
		foreach ( self::get()['statuses'] as $st ) {
			if ( 'open' === $st['category'] ) {
				return $st['slug'];
			}
		}
		return self::get()['statuses'][0]['slug'];
	}

	public static function label( $list, $slug ) {
		foreach ( self::get()[ $list ] as $i ) {
			if ( $i['slug'] === $slug ) {
				return $i['label'];
			}
		}
		return $slug;
	}

	/** Slug of the highest priority (last in the ordered list). */
	public static function top_priority() {
		$p = self::get()['priorities'];
		return end( $p )['slug'];
	}

	/**
	 * Validate + sanitize incoming settings. Returns array|WP_Error.
	 */
	public static function sanitize( $in ) {
		global $wpdb;
		$cur = self::get();
		$out = $cur;

		$lists = array(
			'statuses'   => array( 'bugs' => 'status', 'cat' => true ),
			'priorities' => array( 'bugs' => 'priority', 'cat' => false ),
			'severities' => array( 'bugs' => 'severity', 'cat' => false ),
		);

		foreach ( $lists as $key => $meta ) {
			if ( ! isset( $in[ $key ] ) ) {
				continue;
			}
			if ( ! is_array( $in[ $key ] ) || count( $in[ $key ] ) < 1 || count( $in[ $key ] ) > 20 ) {
				return new WP_Error( 'bt_invalid_settings', sprintf( 'Provide between 1 and 20 entries for %s.', $key ), array( 'status' => 400 ) );
			}
			$clean = array();
			$seen  = array();
			foreach ( $in[ $key ] as $item ) {
				$label = isset( $item['label'] ) ? sanitize_text_field( $item['label'] ) : '';
				$slug  = isset( $item['slug'] ) ? sanitize_key( $item['slug'] ) : '';
				if ( '' === $label ) {
					return new WP_Error( 'bt_invalid_settings', 'Every entry needs a label.', array( 'status' => 400 ) );
				}
				if ( '' === $slug ) {
					$slug = sanitize_key( str_replace( ' ', '_', strtolower( $label ) ) );
				}
				if ( '' === $slug || strlen( $slug ) > 50 || isset( $seen[ $slug ] ) ) {
					return new WP_Error( 'bt_invalid_settings', "Duplicate or invalid identifier \"$slug\".", array( 'status' => 400 ) );
				}
				$seen[ $slug ] = true;
				$color         = isset( $item['color'] ) ? sanitize_hex_color( $item['color'] ) : '';
				$row           = array( 'slug' => $slug, 'label' => mb_substr( $label, 0, 40 ), 'color' => $color ? $color : '#64748b' );
				if ( $meta['cat'] ) {
					$cat = isset( $item['category'] ) ? $item['category'] : 'open';
					if ( ! in_array( $cat, self::CATEGORIES, true ) ) {
						return new WP_Error( 'bt_invalid_settings', 'Invalid status category.', array( 'status' => 400 ) );
					}
					$row['category'] = $cat;
				}
				$clean[] = $row;
			}
			if ( $meta['cat'] ) {
				$cats = wp_list_pluck( $clean, 'category' );
				foreach ( array( 'open', 'resolved', 'closed' ) as $need ) {
					if ( ! in_array( $need, $cats, true ) ) {
						return new WP_Error( 'bt_invalid_settings', "At least one status must use the \"$need\" category.", array( 'status' => 400 ) );
					}
				}
			}
			// A value still used by bugs cannot be removed.
			$col  = $meta['bugs'];
			$used = $wpdb->get_col( 'SELECT DISTINCT ' . $col . ' FROM ' . BT_Database::table( 'bugs' ) ); // phpcs:ignore WordPress.DB.PreparedSQL
			$gone = array_diff( $used, wp_list_pluck( $clean, 'slug' ) );
			if ( $gone ) {
				return new WP_Error( 'bt_invalid_settings', sprintf( 'Cannot remove "%s" because existing bugs still use it.', implode( ', ', $gone ) ), array( 'status' => 409 ) );
			}
			$out[ $key ] = $clean;
		}

		if ( isset( $in['notifications'] ) && is_array( $in['notifications'] ) ) {
			foreach ( array_keys( $cur['notifications'] ) as $k ) {
				if ( isset( $in['notifications'][ $k ] ) ) {
					$out['notifications'][ $k ] = (bool) rest_sanitize_boolean( $in['notifications'][ $k ] );
				}
			}
		}

		if ( isset( $in['project'] ) && is_array( $in['project'] ) ) {
			$p = $in['project'];
			if ( isset( $p['default_assignee'] ) ) {
				$out['project']['default_assignee'] = in_array( $p['default_assignee'], array( 'none', 'project_lead' ), true ) ? $p['default_assignee'] : 'none';
			}
			if ( isset( $p['restrict_to_members'] ) ) {
				$out['project']['restrict_to_members'] = (bool) rest_sanitize_boolean( $p['restrict_to_members'] );
			}
			if ( isset( $p['max_attachment_mb'] ) ) {
				$out['project']['max_attachment_mb'] = max( 1, min( 100, (int) $p['max_attachment_mb'] ) );
			}
			if ( isset( $p['per_page'] ) ) {
				$out['project']['per_page'] = max( 5, min( 100, (int) $p['per_page'] ) );
			}
		}

		if ( isset( $in['uninstall']['delete_data'] ) ) {
			$out['uninstall']['delete_data'] = (bool) rest_sanitize_boolean( $in['uninstall']['delete_data'] );
		}

		return $out;
	}

	public static function save( $settings ) {
		update_option( self::OPTION, $settings, false );
	}
}
