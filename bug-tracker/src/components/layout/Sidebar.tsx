import { Link, NavLink, useLocation } from 'react-router-dom';
import { BarChart3, Bell, Bug, CircleUser, FolderKanban, Inbox, LayoutDashboard, Settings, Users, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { config } from '@/api/client';
import { useApp } from '@/store/app';
import { useProjects, useUnreadCount } from '@/hooks/useData';

const item = 'group flex h-7 items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground';
const itemActive = 'bg-accent text-foreground font-medium';

function Nav({ to, icon: Icon, label, badge, active, onClick }: { to: string; icon: LucideIcon; label: string; badge?: number; active?: boolean; onClick: () => void }) {
  return (
    <Link to={to} onClick={onClick} className={cn(item, active && itemActive)} aria-current={active ? 'page' : undefined}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {!!badge && <span className="rounded bg-primary px-1 text-[10.5px] font-semibold leading-4 text-primary-foreground">{badge > 99 ? '99+' : badge}</span>}
    </Link>
  );
}

export function Sidebar() {
  const { can, sidebarOpen, setSidebarOpen } = useApp();
  const unread = useUnreadCount();
  const projects = useProjects({ status: 'active' });
  const loc = useLocation();
  const sp = new URLSearchParams(loc.search);
  const close = () => setSidebarOpen(false);
  const onBugs = loc.pathname === '/bugs';
  const mine = onBugs && sp.get('assignee_id') === 'me';
  const activeProject = onBugs ? sp.get('project_id') : null;
  const all = onBugs && !mine && !activeProject;

  return (
    <>
      {sidebarOpen && <div className="fixed inset-0 z-[99004] bg-black/40 lg:hidden" onClick={close} aria-hidden />}
      <aside
        aria-label="Bug Tracker navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-[99005] flex w-56 flex-col border-r border-border bg-sidebar transition-transform',
          'lg:sticky lg:top-0 lg:z-10 lg:h-screen lg:w-[208px] lg:shrink-0 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        )}
      >
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 px-3">
          <Link to="/" onClick={close} className="flex min-w-0 items-center gap-2 font-semibold">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><Bug className="h-3.5 w-3.5" /></span>
            <span className="truncate text-[13px]">{config().siteName || 'Bug Tracker'}</span>
          </Link>
          <button className="rounded p-1 text-muted-foreground hover:bg-accent lg:hidden" onClick={close} aria-label="Close menu"><X className="h-4 w-4" /></button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-3 pt-1">
          <div className="space-y-px">
            <NavLink to="/" end onClick={close} className={({ isActive }) => cn(item, isActive && itemActive)}><LayoutDashboard className="h-3.5 w-3.5" />Dashboard</NavLink>
            <Nav to="/bugs?assignee_id=me" icon={CircleUser} label="My bugs" active={mine} onClick={close} />
            <Nav to="/bugs" icon={Inbox} label="All bugs" active={all} onClick={close} />
            <NavLink to="/notifications" onClick={close} className={({ isActive }) => cn(item, isActive && itemActive)}>
              <Bell className="h-3.5 w-3.5" /><span className="flex-1">Inbox</span>
              {!!unread.data && <span className="rounded bg-primary px-1 text-[10.5px] font-semibold leading-4 text-primary-foreground">{unread.data > 99 ? '99+' : unread.data}</span>}
            </NavLink>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              <span>Projects</span>
              <Link to="/projects" onClick={close} className="font-medium normal-case tracking-normal hover:text-foreground">All</Link>
            </div>
            <div className="space-y-px">
              {projects.isLoading && <div className="mx-2 h-5 animate-pulse rounded bg-accent" />}
              {projects.data?.slice(0, 12).map((p) => (
                <Link key={p.id} to={`/bugs?project_id=${p.id}`} onClick={close}
                  className={cn(item, activeProject === String(p.id) && itemActive)}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground/70">{p.stats.open + p.stats.in_progress || ''}</span>
                </Link>
              ))}
              {projects.data?.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">No projects yet</p>}
            </div>
          </div>

          <div className="space-y-px">
            <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">Insights</div>
            <NavLink to="/projects" onClick={close} className={({ isActive }) => cn(item, isActive && itemActive)}><FolderKanban className="h-3.5 w-3.5" />Projects</NavLink>
            <NavLink to="/reports" onClick={close} className={({ isActive }) => cn(item, isActive && itemActive)}><BarChart3 className="h-3.5 w-3.5" />Reports</NavLink>
            <NavLink to="/users" onClick={close} className={({ isActive }) => cn(item, isActive && itemActive)}><Users className="h-3.5 w-3.5" />Team</NavLink>
          </div>
        </nav>

        {(can('manage_bug_tracker') || can('manage_bug_tracker_users')) && (
          <div className="border-t border-border p-2">
            <NavLink to="/settings" onClick={close} className={({ isActive }) => cn(item, isActive && itemActive)}><Settings className="h-3.5 w-3.5" />Settings</NavLink>
          </div>
        )}
      </aside>
    </>
  );
}
