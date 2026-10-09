# Bug Tracker for WordPress

A standalone WordPress plugin: **WordPress is the backend, React is the entire UI.**
PHP only provides the REST API, database access, authentication and permissions.
The app lives at its **own front-end URL — `https://your-site.com/bug-tracker/`** (or `/?bug_tracker_app=1` with plain permalinks) — not inside wp-admin. PHP prints a bare HTML shell with a single `<div id="bug-tracker-root">` and the React app does the rest. Visitors who are not logged in are sent to the WordPress login and returned to the app; users without `view_bug_tracker` get a 403. The *Bug Tracker* item in the wp-admin menu simply opens that URL. The slug can be changed with the `bug_tracker_app_slug` filter.

```
bug-tracker/                  <- the plugin (zip/copy this folder into wp-content/plugins)
├── bug-tracker.php           plugin header + bootstrap
├── uninstall.php             optional data removal (opt-in in Settings)
├── includes/
│   ├── class-plugin.php      activation, wiring
│   ├── class-database.php    custom tables via dbDelta()
│   ├── class-permissions.php capabilities, roles, per-record access checks
│   ├── class-rest-api.php    route registration (/wp-json/bug-tracker/v1/…)
│   ├── class-settings.php    statuses / priorities / severities / options
│   ├── class-notifications.php
│   └── rest/                 bugs, projects, dashboard/reports/users/settings controllers
├── includes/class-app-page.php  the standalone /bug-tracker/ URL (rewrite rule + HTML shell)
├── includes/class-users.php     plugin-owned user registry, Bug Tracker Admin, migration, audit
├── includes/class-license.php   licence provider seam (user limits)
├── includes/rest/class-users-controller.php  /tracker-users/* (admin only)
├── includes/class-demo-data.php generate / remove sample data
├── admin/class-admin-page.php   wp-admin menu link that opens the app
├── admin/class-settings-page.php wp-admin 'Settings & tools' screen (demo data)
├── src/                      React + TypeScript source (components, pages, hooks, api, types, utils, store)
├── build/                    compiled app.js / app.css (committed so the plugin is installable as-is)
├── package.json, vite.config.ts, tailwind.config.js
```

## User management & licensing
* **Bug Tracker Admin:** one user, assigned by a *site administrator* in **wp-admin → Bug Tracker → Settings & tools**. Only the Bug Tracker Admin can open the *Users* screen or call `/tracker-users/*` (add existing WordPress users, create new ones, edit, activate/deactivate, remove, assign projects). Everyone else gets 403, including WordPress administrators.
* **Initial setup:** activating the plugin as a site administrator makes that person the first Bug Tracker Admin. If nobody is assigned (WP-CLI activation, or an upgraded site), the app shows a *setup required* screen and a wp-admin notice until a site administrator assigns one. Existing users are migrated into the tracker automatically (permissions derived from their old capabilities, effective project access preserved) – the admin choice is never guessed.
* **Statuses:** *active*, *inactive* (account kept, access suspended) and *removed* (soft delete: bugs, comments and audit history are preserved, project access revoked; can be restored). The WordPress account is never deleted.
* **Licensing seam:** `BT_License` is the only place that knows about user limits (`includes/class-license.php`). Plans live in a filterable table (`bug_tracker_license_plans`), the whole provider can be replaced (`bug_tracker_license_provider`) and the final number can be overridden (`bug_tracker_max_active_users`). Every code path that activates a user calls `BT_License::assert_can_activate()`; inactive/removed users do not use a seat. No payment code is included.
* **Audit:** user-management actions are written to the existing activity table (`user_added`, `user_activated`, `user_deactivated`, `user_removed`, `user_updated`, `access_granted`, `access_revoked`, `admin_assigned`).

## Settings, favourites and demo data
* **Collapsible sidebar:** the burger button in the top bar collapses the sidebar to icons (remembered per user).
* **Starred projects:** click the star on a project (list, detail page) to favourite it – per user. Starred projects also get a *Starred* shortcut section in the sidebar (hidden when empty) and sort first on the Projects page; they always stay in the normal project list too.
* **Appearance settings** (in-app *Settings → Appearance*): app name, default theme, density (34/42px rows), accent colour, default bugs view, grouping, sidebar default and visible list columns.
* **Demo data:** *wp-admin → Bug Tracker → Settings & tools* generates realistic sample users, projects, bugs, comments and activity, and can remove exactly what it created.
* Opening a bug always refetches it (and its comments/activity) so you never see stale data.

## Install
* **From source:** copy `bug-tracker/` to `wp-content/plugins/`, activate it under *Plugins*.
* **As a zip:** `cd bug-tracker && npm install && npm run package` creates `dist/bug-tracker.zip` (a ready-to-install copy is committed in `dist/`).

The compiled assets in `bug-tracker/build/` are committed, so no Node toolchain is needed on the server.

## Develop
```bash
cd bug-tracker
npm install
npm run dev     # vite build --watch → build/app.js + app.css
npm run build   # typecheck + production build
```
The UI is a hash-routed SPA (`/bug-tracker/#/bugs/12`). Tailwind preflight is disabled and every rule is scoped under `#bug-tracker-root`. The UI is a compact, keyboard-friendly issue tracker: dense list with grouping and one-row filters, properties side panel with inline editing, a merged comments+activity timeline, and shortcuts (`C` new bug, `/` search).

## Stack
React 18, TypeScript, Vite, React Router, Tailwind CSS, shadcn/ui-style components on Radix primitives, Lucide, React Hook Form + Zod, TanStack Query, Recharts. Backend: WordPress Plugin API, REST API, `$wpdb` (prepared statements only).

## Data model
Tables (all `{$wpdb->prefix}bug_tracker_*`): `projects`, `project_members`, `bugs`, `comments`, `attachments`, `activity`, `notifications`.
Attachments are stored in `wp-content/uploads/bug-tracker/` (direct web access denied) and are only served through the authenticated `GET /attachments/{id}/download` endpoint.

## Security model
* Cookie authentication + `X-WP-Nonce`; requests without a valid nonce are treated as anonymous and rejected (the server also hands back a fresh nonce in `X-BT-Nonce` so long-lived tabs keep working).
* **Plugin-owned access control – WordPress roles/capabilities are not used.** WordPress only authenticates (who is logged in). Who may use the tracker, and what they may do, lives in the plugin's own `bug_tracker_users` table.
* Permissions: every active tracker user can view the projects they are assigned to; each user additionally has toggleable flags `create_bug`, `edit_bug`, `delete_bug`, `manage_projects`. Settings, user management, project access and demo data are reserved for the single **Bug Tracker Admin**.
* Project access is strictly by explicit assignment (`project_members`). Being a project's lead, creator, or a bug's reporter/assignee no longer grants access by itself. Hidden projects/bugs return 404, not 403.
* All input is validated/sanitised server-side; SQL uses `$wpdb->prepare` and whitelists for ordering; uploads are type-checked by content (no SVG/PHP), size-limited and renamed; e-mails are only exposed to users with `manage_bug_tracker_users`.

## REST API (`/wp-json/bug-tracker/v1/`)
`GET /dashboard` · `GET /reports` · `GET /users` ·
`GET|POST /bugs` · `GET|PUT|DELETE /bugs/{id}` · `POST /bugs/bulk` ·
`GET|POST /bugs/{id}/comments` · `DELETE /comments/{id}` · `GET /bugs/{id}/activity` ·
`POST /bugs/{id}/attachments` · `DELETE /attachments/{id}` · `GET /attachments/{id}/download` ·
`GET|POST /projects` · `GET|PUT|DELETE /projects/{id}` · `PUT /projects/{id}/favorite` ·
`GET /notifications` · `PUT /notifications/{id}/read` · `PUT /notifications/read-all` ·
`GET|PUT /settings` ·
`GET|POST /tracker-users` · `PUT|DELETE /tracker-users/{id}` · `PUT /tracker-users/{id}/projects/{project_id}` · `GET /tracker-users/candidates|license` (Bug Tracker Admin only)
