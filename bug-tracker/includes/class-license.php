<?php
defined( 'ABSPATH' ) || exit;

/**
 * License seam. User management only ever asks BT_License "may another user be
 * activated?" – it never knows about plans, keys or payment. A future paid add-on
 * swaps the provider via the `bug_tracker_license_provider` filter, or adjusts
 * limits via `bug_tracker_license_plans`, without touching user management code.
 */
interface BT_License_Provider {
	/** Slug of the active plan, e.g. "free". */
	public function plan();
	/** Human-readable plan name. */
	public function plan_label();
	/** Maximum number of active tracker users; 0 means unlimited. */
	public function max_active_users();
	/** Extra status info for UIs (expiry, key state…). */
	public function status();
}

/** Default provider: reads the plan from an option and limits from a filterable table. */
class BT_License_Local_Provider implements BT_License_Provider {

	const OPTION = 'bug_tracker_license';

	/** plan => [label, max_active_users (0 = unlimited)] – configurable through a filter. */
	public static function plans() {
		return apply_filters( 'bug_tracker_license_plans', array(
			'free'      => array( 'label' => 'Free', 'max_active_users' => 10 ),
			'pro'       => array( 'label' => 'Pro', 'max_active_users' => 50 ),
			'unlimited' => array( 'label' => 'Unlimited', 'max_active_users' => 0 ),
		) );
	}

	public function plan() {
		$o    = get_option( self::OPTION, array() );
		$plan = isset( $o['plan'] ) ? sanitize_key( $o['plan'] ) : 'free';
		return isset( self::plans()[ $plan ] ) ? $plan : 'free';
	}

	public function plan_label() {
		return self::plans()[ $this->plan() ]['label'];
	}

	public function max_active_users() {
		return max( 0, (int) self::plans()[ $this->plan() ]['max_active_users'] );
	}

	public function status() {
		return array( 'valid' => true );
	}
}

class BT_License {

	private static function provider() {
		$p = apply_filters( 'bug_tracker_license_provider', new BT_License_Local_Provider() );
		return $p instanceof BT_License_Provider ? $p : new BT_License_Local_Provider();
	}

	/** 0 = unlimited. */
	public static function limit() {
		return (int) apply_filters( 'bug_tracker_max_active_users', self::provider()->max_active_users() );
	}

	public static function active_count() {
		return BT_Users::count_active();
	}

	/** Remaining activations, or null when unlimited. */
	public static function remaining() {
		$limit = self::limit();
		return 0 === $limit ? null : max( 0, $limit - self::active_count() );
	}

	public static function can_activate( $extra = 1 ) {
		$r = self::remaining();
		return null === $r || $r >= $extra;
	}

	/** true | WP_Error – used by every code path that makes a user active. */
	public static function assert_can_activate() {
		if ( self::can_activate() ) {
			return true;
		}
		return new WP_Error(
			'bt_license_limit',
			sprintf(
				/* translators: 1: user limit, 2: plan label */
				__( 'Your %2$s plan allows %1$d active users. Deactivate or remove a user, or upgrade your plan, to add more.', 'bug-tracker' ),
				self::limit(),
				self::provider()->plan_label()
			),
			array( 'status' => 403, 'license' => self::status() )
		);
	}

	public static function status() {
		$p     = self::provider();
		$limit = self::limit();
		$act   = self::active_count();
		return array(
			'plan'       => $p->plan(),
			'plan_label' => $p->plan_label(),
			'limit'      => $limit,
			'active'     => $act,
			'remaining'  => 0 === $limit ? null : max( 0, $limit - $act ),
			'can_add'    => 0 === $limit || $act < $limit,
			'over_limit' => 0 !== $limit && $act > $limit,
			'details'    => $p->status(),
		);
	}
}
