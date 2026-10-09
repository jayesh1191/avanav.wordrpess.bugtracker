export interface UserRef { id: number; name: string; login: string; avatar: string }
export interface ProjectRef { id: number; name: string; key: string; color: string }

export interface BugSummary {
  id: number; title: string; status: string; priority: string; severity: string;
  project: ProjectRef | null; component: string; version: string;
  assignee: UserRef | null; reporter: UserRef | null; due_date: string | null;
  created_at: string; updated_at: string; resolved_at: string | null;
  comment_count: number; attachment_count: number;
}
export interface Attachment {
  id: number; bug_id: number; file_name: string; mime_type: string; size: number;
  is_image: boolean; url: string; user: UserRef | null; created_at: string;
}
export interface BugDetail extends BugSummary {
  description: string; steps_to_reproduce: string; expected_result: string; actual_result: string;
  environment: string; browser: string; attachments: Attachment[]; can_edit: boolean; can_delete: boolean;
}
export interface Comment { id: number; bug_id: number; content: string; user: UserRef | null; created_at: string; can_delete: boolean }
export interface ActivityEntry {
  id: number; bug_id: number; bug_title: string | null; project_id: number; action: string; field: string;
  old_value: string | null; new_value: string | null; user: UserRef | null; created_at: string;
}
export interface Paged<T> { items: T[]; total: number; page: number; total_pages: number; per_page?: number }

export interface ProjectStats { total: number; open: number; in_progress: number; resolved: number; closed: number }
export interface ProjectMember { user: UserRef; role: 'member' | 'maintainer' }
export interface Project {
  id: number; name: string; key: string; description: string; color: string; status: 'active' | 'archived'; is_favorite: boolean;
  lead: UserRef | null; members: ProjectMember[]; stats: ProjectStats; created_at: string; updated_at: string;
}

export interface WpUser extends UserRef {
  email?: string; roles: string[]; assigned: { total: number; open: number };
  last_active: string | null; status: 'active' | 'inactive'; sees_all_projects: boolean;
}

export interface Notification {
  id: number; type: 'assignment' | 'status' | 'comment' | 'mention' | 'resolution'; message: string;
  bug_id: number; actor: UserRef | null; is_read: boolean; created_at: string;
}

export type StatusCategory = 'open' | 'in_progress' | 'resolved' | 'closed';
export interface StatusDef { slug: string; label: string; color: string; category: StatusCategory }
export interface OptionDef { slug: string; label: string; color: string }
export interface UiSettings {
  app_name: string; theme: 'system' | 'light' | 'dark'; density: 'compact' | 'comfortable'; accent: string;
  sidebar_collapsed: boolean; default_view: 'all' | 'active' | 'mine'; group_by_status: boolean;
  columns: { severity: boolean; project: boolean; assignee: boolean; reporter: boolean; created: boolean; updated: boolean };
}
export interface LicenseStatus {
  plan: string; plan_label: string; limit: number; active: number; remaining: number | null; can_add: boolean; over_limit: boolean;
}
export type TrackerStatus = 'active' | 'inactive' | 'removed';
export interface TrackerUser {
  id: number; user_id: number; name: string; login: string; email: string; avatar: string; status: TrackerStatus; is_admin: boolean;
  permissions: string[]; projects: { project_id: number; role: 'member' | 'maintainer' }[]; project_count: number;
  added_at: string | null; status_changed_at: string | null; profile_editable: boolean;
}
export interface TrackerUserList extends Paged<TrackerUser> {
  counts: Record<TrackerStatus, number>; license: LicenseStatus; permission_keys: Record<string, string>;
}
export interface Candidate { id: number; name: string; login: string; email: string; avatar: string }
export interface Settings {
  statuses: StatusDef[]; priorities: OptionDef[]; severities: OptionDef[];
  notifications: { assignment: boolean; status: boolean; comment: boolean; mention: boolean; resolution: boolean; email: boolean };
  project: { default_assignee: 'none' | 'project_lead'; max_attachment_mb: number; per_page: number };
  uninstall?: { delete_data: boolean };
  ui: UiSettings;
  limits: { server_max_upload_mb: number };
}

export interface ChartPoint { key: string; label: string; color?: string; avatar?: string | null; count: number }
export interface TimePoint { date: string; created: number; resolved: number }
export interface Dashboard {
  totals: { total: number; open: number; in_progress: number; resolved: number; closed: number; critical: number; assigned_to_me: number };
  status_chart: ChartPoint[]; priority_chart: ChartPoint[]; trend: TimePoint[];
  recent_bugs: BugSummary[]; recent_activity: ActivityEntry[];
}
export interface Reports {
  days: number; granularity: 'day' | 'month';
  by_status: ChartPoint[]; by_priority: ChartPoint[]; by_severity: ChartPoint[];
  by_project: ChartPoint[]; by_assignee: ChartPoint[]; over_time: TimePoint[];
}

export interface BugFilters {
  search?: string; status?: string; priority?: string; severity?: string; project_id?: string;
  assignee_id?: string; reporter_id?: string; orderby?: string; order?: 'asc' | 'desc'; page?: number; per_page?: number;
}

export interface BugTrackerConfig {
  restUrl: string; nonce: string; siteName: string; adminUrl: string; homeUrl: string; logoutUrl: string;
  user: { id: number; name: string; avatar: string; caps: Record<string, boolean> };
}
declare global { interface Window { BugTrackerConfig: BugTrackerConfig } }
