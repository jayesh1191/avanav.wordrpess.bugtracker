<?php
defined( 'ABSPATH' ) || exit;

/**
 * Small wp-admin screen (Bug Tracker → Settings & tools). The bug-tracking UI itself
 * lives in the React app; this page only hosts plugin-level tools such as demo data.
 */
class BT_Settings_Page {

	const SLUG = 'bug-tracker-settings';

	public function init() {
		add_action( 'admin_menu', array( $this, 'register' ), 20 );
		add_action( 'admin_notices', array( $this, 'setup_notice' ) );
		add_action( 'admin_post_bug_tracker_set_admin', array( $this, 'handle_set_admin' ) );
		add_action( 'admin_post_bug_tracker_generate_demo', array( $this, 'handle_generate' ) );
		add_action( 'admin_post_bug_tracker_remove_demo', array( $this, 'handle_remove' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( BUG_TRACKER_FILE ), array( $this, 'action_links' ) );
	}

	public function register() {
		global $admin_page_hooks;
		if ( empty( $admin_page_hooks[ BT_Admin_Page::SLUG ] ) ) {
			return; // the menu was not registered for this user
		}
		// 'read' is only the WordPress baseline needed to render the entry; real access control is in render()/handlers.
		add_submenu_page( BT_Admin_Page::SLUG, __( 'Bug Tracker', 'bug-tracker' ), __( 'Open app', 'bug-tracker' ), 'read', BT_Admin_Page::SLUG );
		add_submenu_page( BT_Admin_Page::SLUG, __( 'Bug Tracker settings & tools', 'bug-tracker' ), __( 'Settings & tools', 'bug-tracker' ), 'read', self::SLUG, array( $this, 'render' ) );
	}

	public function action_links( $links ) {
		array_unshift(
			$links,
			'<a href="' . esc_url( BT_App_Page::url() ) . '">' . esc_html__( 'Open app', 'bug-tracker' ) . '</a>',
			'<a href="' . esc_url( admin_url( 'admin.php?page=' . self::SLUG ) ) . '">' . esc_html__( 'Settings', 'bug-tracker' ) . '</a>'
		);
		return $links;
	}

	/** Site administrators only (used for the one-time / re-assignment of the Bug Tracker Admin). */
	private function guard_site_admin() {
		if ( ! is_user_logged_in() || ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Only a site administrator can do that.', 'bug-tracker' ), 403 );
		}
	}

	/** The assigned Bug Tracker Admin only (demo data and other plugin tools). */
	private function guard_bt_admin() {
		if ( ! BT_Permissions::can( 'manage_bug_tracker' ) ) {
			wp_die( esc_html__( 'Only the Bug Tracker Admin can do that.', 'bug-tracker' ), 403 );
		}
	}

	public function setup_notice() {
		if ( BT_Users::admin_id() || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		echo '<div class="notice notice-warning"><p><strong>' . esc_html__( 'Bug Tracker setup required.', 'bug-tracker' ) . '</strong> '
			. esc_html__( 'No Bug Tracker Admin has been assigned, so nobody can use the tracker yet.', 'bug-tracker' ) . ' '
			. '<a href="' . esc_url( admin_url( 'admin.php?page=' . self::SLUG ) ) . '">' . esc_html__( 'Assign one now', 'bug-tracker' ) . '</a></p></div>';
	}

	public function handle_set_admin() {
		$this->guard_site_admin();
		check_admin_referer( 'bug_tracker_set_admin' );
		$who  = isset( $_POST['admin_user'] ) ? sanitize_text_field( wp_unslash( $_POST['admin_user'] ) ) : '';
		$user = false;
		if ( '' !== $who ) {
			$user = is_email( $who ) ? get_user_by( 'email', $who ) : get_user_by( 'login', $who );
		}
		if ( ! $user ) {
			$this->back( array( 'bt_done' => 'admin_invalid' ) );
		}
		$res = BT_Users::set_admin( $user->ID );
		$this->back( array( 'bt_done' => is_wp_error( $res ) ? 'admin_invalid' : 'admin_set' ) );
	}

	private function back( $args ) {
		wp_safe_redirect( add_query_arg( $args, admin_url( 'admin.php?page=' . self::SLUG ) ) );
		exit;
	}

	public function handle_generate() {
		$this->guard_bt_admin();
		check_admin_referer( 'bug_tracker_generate_demo' );
		$r = BT_Demo_Data::generate(
			isset( $_POST['users'] ) ? absint( $_POST['users'] ) : 5,
			isset( $_POST['projects'] ) ? absint( $_POST['projects'] ) : 3,
			isset( $_POST['bugs'] ) ? absint( $_POST['bugs'] ) : 40
		);
		$this->back( array( 'bt_done' => 'generated', 'u' => $r['users'], 'p' => $r['projects'], 'b' => $r['bugs'], 'c' => $r['comments'] ) );
	}

	public function handle_remove() {
		$this->guard_bt_admin();
		check_admin_referer( 'bug_tracker_remove_demo' );
		$r = BT_Demo_Data::remove();
		$this->back( array( 'bt_done' => 'removed', 'u' => $r['users'], 'p' => $r['projects'], 'b' => $r['bugs'] ) );
	}

	public function render() {
		$is_site_admin = current_user_can( 'manage_options' );
		$is_bt_admin   = BT_Permissions::can( 'manage_bug_tracker' );
		if ( ! $is_site_admin && ! $is_bt_admin ) {
			wp_die( esc_html__( 'You do not have permission to view this page.', 'bug-tracker' ), 403 );
		}
		$counts  = BT_Demo_Data::counts();
		$admin   = BT_Users::admin_id() ? get_userdata( BT_Users::admin_id() ) : null;
		$license = BT_License::status();
		$done    = isset( $_GET['bt_done'] ) ? sanitize_key( wp_unslash( $_GET['bt_done'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$n       = function ( $k ) {
			return isset( $_GET[ $k ] ) ? absint( $_GET[ $k ] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification
		};
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Bug Tracker – settings & tools', 'bug-tracker' ); ?></h1>

			<?php if ( 'admin_set' === $done ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php esc_html_e( 'Bug Tracker Admin saved.', 'bug-tracker' ); ?></p></div>
			<?php elseif ( 'admin_invalid' === $done ) : ?>
				<div class="notice notice-error is-dismissible"><p><?php esc_html_e( 'No WordPress user matches that username or e-mail address.', 'bug-tracker' ); ?></p></div>
			<?php elseif ( 'generated' === $done ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php echo esc_html( sprintf( __( 'Demo data created: %1$d projects, %2$d bugs, %3$d comments and %4$d users.', 'bug-tracker' ), $n( 'p' ), $n( 'b' ), $n( 'c' ), $n( 'u' ) ) ); ?></p></div>
			<?php elseif ( 'removed' === $done ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php echo esc_html( sprintf( __( 'Demo data removed: %1$d projects, %2$d bugs and %3$d users.', 'bug-tracker' ), $n( 'p' ), $n( 'b' ), $n( 'u' ) ) ); ?></p></div>
			<?php endif; ?>

			<?php if ( BT_Permissions::can( 'view_bug_tracker' ) ) : ?>
			<p>
				<a class="button button-primary" href="<?php echo esc_url( BT_App_Page::url() ); ?>"><?php esc_html_e( 'Open Bug Tracker', 'bug-tracker' ); ?></a>
				<span class="description"><?php echo esc_html( BT_App_Page::url() ); ?></span>
			</p>
			<?php endif; ?>

			<h2 class="title"><?php esc_html_e( 'Bug Tracker Admin', 'bug-tracker' ); ?></h2>
			<p><?php esc_html_e( 'The Bug Tracker Admin is the only person who can add, edit, activate, deactivate and remove Bug Tracker users and assign them to projects. Bug Tracker access is managed by the plugin itself – WordPress roles are not used.', 'bug-tracker' ); ?></p>
			<table class="form-table" role="presentation">
				<tr><th scope="row"><?php esc_html_e( 'Current admin', 'bug-tracker' ); ?></th>
					<td><?php echo $admin ? '<strong>' . esc_html( $admin->display_name ) . '</strong> (' . esc_html( $admin->user_login ) . ', ' . esc_html( $admin->user_email ) . ')' : '<em>' . esc_html__( 'Not assigned – nobody can use the tracker yet.', 'bug-tracker' ) . '</em>'; ?></td></tr>
			</table>
			<?php if ( $is_site_admin ) : ?>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
					<input type="hidden" name="action" value="bug_tracker_set_admin">
					<?php wp_nonce_field( 'bug_tracker_set_admin' ); ?>
					<table class="form-table" role="presentation">
						<tr><th scope="row"><label for="bt-admin-user"><?php esc_html_e( 'Assign admin', 'bug-tracker' ); ?></label></th>
							<td><input id="bt-admin-user" name="admin_user" type="text" class="regular-text" autocomplete="off" placeholder="<?php esc_attr_e( 'username or e-mail', 'bug-tracker' ); ?>" required>
								<p class="description"><?php esc_html_e( 'Only site administrators can assign or change the Bug Tracker Admin. The previous admin stays a regular tracker user.', 'bug-tracker' ); ?></p></td></tr>
					</table>
					<?php submit_button( $admin ? __( 'Change Bug Tracker Admin', 'bug-tracker' ) : __( 'Assign Bug Tracker Admin', 'bug-tracker' ), 'primary', 'submit', false ); ?>
				</form>
			<?php else : ?>
				<p class="description"><?php esc_html_e( 'Only a site administrator can change the Bug Tracker Admin.', 'bug-tracker' ); ?></p>
			<?php endif; ?>

			<h2 class="title"><?php esc_html_e( 'Plan & user limit', 'bug-tracker' ); ?></h2>
			<p><?php echo esc_html( sprintf( __( 'Plan: %1$s · Active users: %2$d of %3$s', 'bug-tracker' ), $license['plan_label'], $license['active'], $license['limit'] ? $license['limit'] : __( 'unlimited', 'bug-tracker' ) ) ); ?></p>

			<?php if ( $is_bt_admin ) : ?>
			<p class="description"><?php esc_html_e( 'Workflow, appearance, notification and user settings are in the app itself (Settings and Users in the sidebar).', 'bug-tracker' ); ?></p>

			<h2 class="title"><?php esc_html_e( 'Demo data', 'bug-tracker' ); ?></h2>
			<p><?php esc_html_e( 'Fill the tracker with realistic sample projects, bugs, comments, activity and (optionally) demo users so you can explore the interface. Everything generated is tracked, so it can be removed again without touching your real data. Demo users count towards your active-user limit.', 'bug-tracker' ); ?></p>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="bug_tracker_generate_demo">
				<?php wp_nonce_field( 'bug_tracker_generate_demo' ); ?>
				<table class="form-table" role="presentation">
					<tr><th scope="row"><label for="bt-users"><?php esc_html_e( 'Demo users', 'bug-tracker' ); ?></label></th>
						<td><input id="bt-users" name="users" type="number" min="0" max="20" value="5" class="small-text"> <span class="description"><?php esc_html_e( 'Plain WordPress accounts (no role) with random passwords and @example.invalid e-mails.', 'bug-tracker' ); ?></span></td></tr>
					<tr><th scope="row"><label for="bt-projects"><?php esc_html_e( 'Projects', 'bug-tracker' ); ?></label></th>
						<td><input id="bt-projects" name="projects" type="number" min="1" max="8" value="3" class="small-text"></td></tr>
					<tr><th scope="row"><label for="bt-bugs"><?php esc_html_e( 'Bugs', 'bug-tracker' ); ?></label></th>
						<td><input id="bt-bugs" name="bugs" type="number" min="1" max="400" value="40" class="small-text"> <span class="description"><?php esc_html_e( 'Spread over the last 60 days with comments, statuses and assignees.', 'bug-tracker' ); ?></span></td></tr>
				</table>
				<?php submit_button( __( 'Generate demo data', 'bug-tracker' ), 'primary', 'submit', false ); ?>
			</form>

			<h3><?php esc_html_e( 'Remove demo data', 'bug-tracker' ); ?></h3>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" onsubmit="return confirm('<?php echo esc_js( __( 'Delete all generated demo projects, bugs and users?', 'bug-tracker' ) ); ?>');">
				<input type="hidden" name="action" value="bug_tracker_remove_demo">
				<?php wp_nonce_field( 'bug_tracker_remove_demo' ); ?>
				<p><?php echo esc_html( sprintf( __( 'Currently tracked demo data: %1$d projects, %2$d bugs, %3$d users.', 'bug-tracker' ), $counts['projects'], $counts['bugs'], $counts['users'] ) ); ?></p>
				<?php submit_button( __( 'Remove demo data', 'bug-tracker' ), 'delete', 'submit', false, $counts['projects'] || $counts['users'] ? array() : array( 'disabled' => 'disabled' ) ); ?>
			</form>
			<?php endif; ?>
		</div>
		<?php
	}
}
