=== Bug Tracker ===
Requires at least: 5.9
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later

A complete bug-tracking system for WordPress. The whole interface is a React app that talks to a custom REST API.

== Description ==
* Dashboard, bugs table (search, filter, sort, paginate, bulk actions, CSV export), bug form and detail page
* Projects with members, comments with @mentions, attachments, activity history
* Reports with interactive charts, in-app notifications, configurable statuses/priorities/severities
* Uses WordPress users, roles and capabilities; every REST endpoint is permission-checked

== Installation ==
1. Upload the `bug-tracker` folder (or the zip) to `/wp-content/plugins/` and activate it.
2. Open **Bug Tracker** in the admin menu. Administrators can use everything immediately.
3. Create a project and add members, then start reporting bugs.

== Changelog ==
= 1.1.0 =
* Custom user management: Bug Tracker access, per-user permissions and project assignments are managed by the plugin (WordPress roles/capabilities are no longer used).
* New Bug Tracker Admin setting (assigned by a site administrator); only that user can manage tracker users.
* Accordion user screen with search, filters, activate/deactivate, remove (history preserved) and per-project access.
* Licence seam (`BT_License`) for a future paid active-user limit.
* Existing installs are migrated automatically and non-destructively.

= 1.0.0 =
* Initial release.
