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
├── includes/class-demo-data.php generate / remove sample data
├── admin/class-admin-page.php   wp-admin menu link that opens the app
├── admin/class-settings-page.php wp-admin 'Settings & tools' screen (demo data)
├── src/                      React + TypeScript source (components, pages, hooks, api, types, utils, store)
├── build/                    compiled app.js / app.css (committed so the plugin is installable as-is)
├── package.json, vite.config.ts, tailwind.config.js
```

## Settings, favourites and demo data
* **Collapsible sidebar:** the burger button in the top bar collapses the sidebar to icons (remembered per user).
* **Starred projects:** click the star on a project (list, detail page) to favourite it – per user. Starred projects get their own *Starred* section in the sidebar (hidden when empty) and sort first on the Projects page.
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
* Capabilities: `view_bug_tracker`, `create_bug`, `edit_bug`, `delete_bug`, `manage_projects`, `manage_bug_tracker`, `manage_bug_tracker_users`. Administrators get all; the plugin adds **Bug Tracker Project Manager** and **Bug Tracker Contributor** roles. Role → capability mapping is editable in *Settings → User permissions*.
* Record-level access: unless "limit visibility to project members" is turned off, non-managers only see projects they belong to (plus bugs they reported or are assigned). Hidden bugs return 404, not 403.
* All input is validated/sanitised server-side; SQL uses `$wpdb->prepare` and whitelists for ordering; uploads are type-checked by content (no SVG/PHP), size-limited and renamed; e-mails are only exposed to users with `manage_bug_tracker_users`.

## REST API (`/wp-json/bug-tracker/v1/`)
`GET /dashboard` · `GET /reports` · `GET /users` ·
`GET|POST /bugs` · `GET|PUT|DELETE /bugs/{id}` · `POST /bugs/bulk` ·
`GET|POST /bugs/{id}/comments` · `DELETE /comments/{id}` · `GET /bugs/{id}/activity` ·
`POST /bugs/{id}/attachments` · `DELETE /attachments/{id}` · `GET /attachments/{id}/download` ·
`GET|POST /projects` · `GET|PUT|DELETE /projects/{id}` · `PUT /projects/{id}/favorite` ·
`GET /notifications` · `PUT /notifications/{id}/read` · `PUT /notifications/read-all` ·
`GET|PUT /settings`
