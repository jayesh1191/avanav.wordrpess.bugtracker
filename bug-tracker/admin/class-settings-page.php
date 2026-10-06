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
		add_action( 'admin_post_bug_tracker_generate_demo', array( $this, 'handle_generate' ) );
		add_action( 'admin_post_bug_tracker_remove_demo', array( $this, 'handle_remove' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( BUG_TRACKER_FILE ), array( $this, 'action_links' ) );
	}

	public function register() {
		add_submenu_page( BT_Admin_Page::SLUG, __( 'Bug Tracker', 'bug-tracker' ), __( 'Open app', 'bug-tracker' ), 'view_bug_tracker', BT_Admin_Page::SLUG );
		add_submenu_page( BT_Admin_Page::SLUG, __( 'Bug Tracker settings & tools', 'bug-tracker' ), __( 'Settings & tools', 'bug-tracker' ), 'manage_bug_tracker', self::SLUG, array( $this, 'render' ) );
	}

	public function action_links( $links ) {
		array_unshift(
			$links,
			'<a href="' . esc_url( BT_App_Page::url() ) . '">' . esc_html__( 'Open app', 'bug-tracker' ) . '</a>',
			'<a href="' . esc_url( admin_url( 'admin.php?page=' . self::SLUG ) ) . '">' . esc_html__( 'Settings', 'bug-tracker' ) . '</a>'
		);
		return $links;
	}

	private function guard() {
		if ( ! current_user_can( 'manage_bug_tracker' ) ) {
			wp_die( esc_html__( 'You do not have permission to do that.', 'bug-tracker' ), 403 );
		}
	}

	private function back( $args ) {
		wp_safe_redirect( add_query_arg( $args, admin_url( 'admin.php?page=' . self::SLUG ) ) );
		exit;
	}

	public function handle_generate() {
		$this->guard();
		check_admin_referer( 'bug_tracker_generate_demo' );
		$r = BT_Demo_Data::generate(
			isset( $_POST['users'] ) ? absint( $_POST['users'] ) : 5,
			isset( $_POST['projects'] ) ? absint( $_POST['projects'] ) : 3,
			isset( $_POST['bugs'] ) ? absint( $_POST['bugs'] ) : 40
		);
		$this->back( array( 'bt_done' => 'generated', 'u' => $r['users'], 'p' => $r['projects'], 'b' => $r['bugs'], 'c' => $r['comments'] ) );
	}

	public function handle_remove() {
		$this->guard();
		check_admin_referer( 'bug_tracker_remove_demo' );
		$r = BT_Demo_Data::remove();
		$this->back( array( 'bt_done' => 'removed', 'u' => $r['users'], 'p' => $r['projects'], 'b' => $r['bugs'] ) );
	}

	public function render() {
		$this->guard();
		$counts = BT_Demo_Data::counts();
		$done   = isset( $_GET['bt_done'] ) ? sanitize_key( wp_unslash( $_GET['bt_done'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$n      = function ( $k ) {
			return isset( $_GET[ $k ] ) ? absint( $_GET[ $k ] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification
		};
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Bug Tracker – settings & tools', 'bug-tracker' ); ?></h1>

			<?php if ( 'generated' === $done ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php echo esc_html( sprintf( __( 'Demo data created: %1$d projects, %2$d bugs, %3$d comments and %4$d users.', 'bug-tracker' ), $n( 'p' ), $n( 'b' ), $n( 'c' ), $n( 'u' ) ) ); ?></p></div>
			<?php elseif ( 'removed' === $done ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php echo esc_html( sprintf( __( 'Demo data removed: %1$d projects, %2$d bugs and %3$d users.', 'bug-tracker' ), $n( 'p' ), $n( 'b' ), $n( 'u' ) ) ); ?></p></div>
			<?php endif; ?>

			<p>
				<a class="button button-primary" href="<?php echo esc_url( BT_App_Page::url() ); ?>"><?php esc_html_e( 'Open Bug Tracker', 'bug-tracker' ); ?></a>
				<span class="description"><?php echo esc_html( BT_App_Page::url() ); ?></span>
			</p>
			<p class="description"><?php esc_html_e( 'Workflow, appearance, notification and permission settings are in the app itself (Settings in the sidebar).', 'bug-tracker' ); ?></p>

			<h2 class="title"><?php esc_html_e( 'Demo data', 'bug-tracker' ); ?></h2>
			<p><?php esc_html_e( 'Fill the tracker with realistic sample projects, bugs, comments, activity and (optionally) demo users so you can explore the interface. Everything generated is tracked, so it can be removed again without touching your real data.', 'bug-tracker' ); ?></p>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="bug_tracker_generate_demo">
				<?php wp_nonce_field( 'bug_tracker_generate_demo' ); ?>
				<table class="form-table" role="presentation">
					<tr><th scope="row"><label for="bt-users"><?php esc_html_e( 'Demo users', 'bug-tracker' ); ?></label></th>
						<td><input id="bt-users" name="users" type="number" min="0" max="20" value="5" class="small-text"> <span class="description"><?php esc_html_e( 'Created with the Bug Tracker roles; random passwords, @example.invalid e-mails.', 'bug-tracker' ); ?></span></td></tr>
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
		</div>
		<?php
	}
}
