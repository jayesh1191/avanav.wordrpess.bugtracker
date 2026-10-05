# Bug Tracker for WordPress

A standalone WordPress plugin: **WordPress is the backend, React is the entire UI.**
PHP only provides the REST API, database access, authentication and permissions.
The admin page renders a single `<div id="bug-tracker-root">` and the React app does the rest.

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
├── admin/class-admin-page.php   menu + enqueue of the compiled assets
├── src/                      React + TypeScript source (components, pages, hooks, api, types, utils, store)
├── build/                    compiled app.js / app.css (committed so the plugin is installable as-is)
├── package.json, vite.config.ts, tailwind.config.js
```

## Install
* **From source:** copy `bug-tracker/` to `wp-content/plugins/`, activate it under *Plugins*.
* **As a zip:** `cd bug-tracker && npm install && npm run package` creates `bug-tracker.zip` in the repo root.

The compiled assets in `bug-tracker/build/` are committed, so no Node toolchain is needed on the server.

## Develop
```bash
cd bug-tracker
npm install
npm run dev     # vite build --watch → build/app.js + app.css
npm run build   # typecheck + production build
```
The UI is a hash-routed SPA (`admin.php?page=bug-tracker#/bugs/12`). Tailwind has preflight disabled and every utility is scoped under `#bug-tracker-root`, so it cannot restyle the WordPress admin (and WordPress admin CSS is reset inside the root).

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
`GET|POST /projects` · `GET|PUT|DELETE /projects/{id}` ·
`GET /notifications` · `PUT /notifications/{id}/read` · `PUT /notifications/read-all` ·
`GET|PUT /settings`
