# Context: Bug Tracker WordPress plugin (v1.1.0)

## What it is
A standalone WordPress plugin. WordPress is only the backend: REST API, database, authentication. The whole UI is a React app served on its own front-end URL, `/bug-tracker/` (or `/?bug_tracker_app=1` with plain permalinks). The app is not inside wp-admin. It requires login, redirecting to wp-login and back.

Plugin folder: `bug-tracker/`. Compiled assets in `build/` are committed, so no Node is needed on the server. Installable zip: `../dist/bug-tracker.zip`.

## Stack
- **Frontend:** React 18, TypeScript, Vite (IIFE bundle `build/app.js` + `app.css`), React Router (HashRouter), Tailwind v3, shadcn-style components on Radix, Lucide, React Hook Form + Zod, TanStack Query, Recharts.
- **Backend:** PHP 7.4+, WordPress 5.9+, `$wpdb` with prepared statements, `dbDelta`, REST namespace `bug-tracker/v1`. Tested on WP 7.1.2, PHP 8.3, MariaDB 10.11.

## Layout
- **PHP:**
  - `bug-tracker.php` (bootstrap)
  - `includes/`: `class-database` (8 tables `{prefix}bug_tracker_*`: projects, project_members, bugs, comments, attachments, activity, notifications, users), `class-users` (plugin-owned user registry, Bug Tracker Admin, migration, audit), `class-permissions`, `class-license`, `class-settings`, `class-notifications`, `class-helpers`, `class-demo-data`, `class-app-page` (the `/bug-tracker/` shell), `class-rest-api` (routes)
  - `includes/rest/`: bugs, projects, misc and users controllers
  - `admin/`: wp-admin menu (just links to the app) and a "Settings & tools" screen
  - `uninstall.php`
- **React:** `src/` with `pages/`, `components/` (`ui/`, `layout/`, `users/`, `bugs/`), `api/`, `hooks/`, `store/`, `types/`, `utils/`.

## Architecture rules (do not break)
- **Access control is plugin-owned.** WordPress roles and capabilities are NOT used; WP only authenticates. The `bug_tracker_users` table holds a status (active, inactive or removed; removal is soft) and per-user flags `create_bug`, `edit_bug`, `delete_bug`, `manage_projects`.
- **One Bug Tracker Admin.** Stored in option `bug_tracker_admin_user_id` and assigned only by a site administrator on wp-admin → Bug Tracker → Settings & tools. This user alone can use the Users screen and `/tracker-users/*`, change settings, assign project access, and run the demo-data tools.
- **First run:** the activating site admin becomes the Bug Tracker Admin. Otherwise the app shows "setup required" until one is assigned.
- **Project access is strictly by explicit assignment** (`project_members`), enforced in every query via `BT_Permissions::bug_scope_sql` and `accessible_project_ids`. Hidden projects and bugs return 404. Being a project's lead, creator, or a bug's reporter or assignee grants nothing by itself.
- **Licence seam.** Only `BT_License` knows about user limits. Default plan Free = 10 active users, which is a placeholder. Filters: `bug_tracker_license_plans`, `bug_tracker_license_provider`, `bug_tracker_max_active_users`. Every code path that activates a user calls `BT_License::assert_can_activate()`. No payment code.
- **Other filter:** `bug_tracker_app_slug`.
- **Auth:** cookie auth plus `X-WP-Nonce`. The server returns a fresh nonce in an `X-BT-Nonce` header and the client picks it up.
- **Attachments** live in `wp-content/uploads/bug-tracker/`, are served only through an authenticated REST endpoint, are content-sniffed, and SVG/PHP are rejected.
- **Tailwind preflight is disabled** and all CSS is scoped under `#bug-tracker-root`. `postcss.config.js` re-scopes the `--tw-*` defaults. Radix portals must render inside the root (`src/components/ui/portal.ts`).
- **Opening a bug always refetches** the bug, its comments and its activity.
- **Migration from 1.0.0:** `BT_Users::maybe_migrate()` runs once, is idempotent and non-destructive. It converts old role/capability users into tracker users and preserves their effective access. Old WP roles are left in the DB, unused.
- **Data names:**
  - **Options:** `bug_tracker_settings`, `_db_version`, `_admin_user_id`, `_users_migrated`, `_license`, `_demo`
  - **User meta:** `bug_tracker_favorite_projects`

## Features
- **Bugs:** dense Linear/Jira-style list (keys like `WR-12`, status and priority glyphs, quick views, multi-select filter chips, group by status, bulk actions, CSV export). Bug page with an inline-editable properties panel and one comments + activity timeline. Attachments and @mentions.
- **Projects and people:** projects with members, per-user starred projects, an accordion Users screen (add existing or create new, edit, activate/deactivate, remove/restore, per-project access), and a read-only Team page for non-admins.
- **Insight and settings:** reports and dashboard (Recharts), in-app notifications, collapsible icon-only sidebar, shortcuts `C` (new bug) and `/` (search).
- **Settings:** statuses, priorities, severities, notifications, and Appearance (theme, density, accent, default view, columns). All of these are admin-only.
- **Tools:** demo-data generator and remover (tracked, license-aware).

## Dev commands
- `npm install && npm run build` inside this folder (typecheck + build). Rebuild and commit `build/` after any change in `src/`.
- `npm run package` creates `../dist/bug-tracker.zip`.
- Testing used a real WordPress + MariaDB + `php -S` with a router. Details, and the API and Playwright scripts, are in the hand-off package (`START-HERE.md`, `dev-tools/`).
- Last results: API suites 134 + 29 + 122 checks, all Playwright flows, no PHP notices, no horizontal scroll at 390px.

## Known gaps and ideas
- **Not built:** no payment or licence-key code, no multisite handling, React strings are English-only, the bundle is about 1 MB (Recharts), the new-bug form is a page rather than a drawer.
- **Untested:** emails (`wp_mail`) could not be exercised in the offline sandbox.
- **Next steps:** a paid licence add-on implementing `BT_License_Provider`, code-splitting, attachments outside the web root, CI running the tests, and comment editing and @mention autocomplete.
