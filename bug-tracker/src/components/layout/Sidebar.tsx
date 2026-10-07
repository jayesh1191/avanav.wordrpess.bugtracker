import { Link, NavLink, useLocation } from 'react-router-dom';
import { BarChart3, Bell, Bug, CircleUser, FolderKanban, Inbox, LayoutDashboard, Settings, Star, Users, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { config } from '@/api/client';
import { useApp } from '@/store/app';
import { useProjects, useUnreadCount } from '@/hooks/useData';
import type { Project } from '@/types';

const base = 'group flex h-7 items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground';
const activeCls = 'bg-accent text-foreground font-medium';

export function Sidebar() {
  const { can, sidebarOpen, setSidebarOpen, collapsed, ui } = useApp();
  const unread = useUnreadCount();
  const projects = useProjects({ status: 'active' });
  const loc = useLocation();
  const sp = new URLSearchParams(loc.search);
  const close = () => setSidebarOpen(false);
  const onBugs = loc.pathname === '/bugs';
  const mine = onBugs && sp.get('assignee_id') === 'me';
  const activeProject = onBugs ? sp.get('project_id') : null;
  const all = onBugs && !mine && !activeProject;
  // `lc:` helpers – only collapse on desktop; the mobile drawer is always full width.
  const lc = (cls: string) => (collapsed ? cls : '');

  const Item = ({ to, icon: Icon, label, badge, active, end }: { to: string; icon: LucideIcon; label: string; badge?: number; active?: boolean; end?: boolean }) => (
    <NavLink to={to} end={end} onClick={close} title={collapsed ? label : undefined} aria-label={label}
      className={({ isActive }) => cn(base, (active ?? isActive) && activeCls, lc('lg:justify-center lg:px-0'), 'relative')}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className={cn('flex-1 truncate', lc('lg:hidden'))}>{label}</span>
      {!!badge && <span className={cn('rounded bg-primary px-1 text-[10.5px] font-semibold leading-4 text-primary-foreground', lc('lg:absolute lg:right-0.5 lg:top-0 lg:px-[3px] lg:text-[9px] lg:leading-[14px]'))}>{badge > 99 ? '99+' : badge}</span>}
    </NavLink>
  );

  const ProjectLink = ({ p, star }: { p: Project; star?: boolean }) => (
    <Link to={`/bugs?project_id=${p.id}`} onClick={close} title={collapsed ? p.name : undefined} aria-label={p.name}
      className={cn(base, activeProject === String(p.id) && activeCls, lc('lg:justify-center lg:px-0'))}>
      <span className="relative flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px]" style={{ background: p.color }}>
        {star && collapsed && <Star className="absolute -right-1 -top-1 hidden h-2.5 w-2.5 fill-amber-400 text-amber-400 lg:block" />}
      </span>
      <span className={cn('flex-1 truncate', lc('lg:hidden'))}>{p.name}</span>
      {p.is_favorite && !star && <Star className={cn('h-3 w-3 shrink-0 fill-amber-400 text-amber-400', lc('lg:hidden'))} aria-label="Starred" />}
      <span className={cn('text-[11px] tabular-nums text-muted-foreground/70', lc('lg:hidden'))}>{p.stats.open + p.stats.in_progress || ''}</span>
    </Link>
  );

  const Label = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
    <>
      <div className={cn('mb-1 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80', lc('lg:hidden'))}>{children}{action}</div>
      {collapsed && <div className="mx-2 mb-1 hidden border-t border-border lg:block" />}
    </>
  );

  const favs = projects.data?.filter((p) => p.is_favorite) ?? [];
  const all_projects = projects.data ?? [];

  return (
    <>
      {sidebarOpen && <div className="fixed inset-0 z-[99004] bg-black/40 lg:hidden" onClick={close} aria-hidden />}
      <aside
        aria-label="Bug Tracker navigation"
        data-collapsed={collapsed}
        className={cn(
          'fixed inset-y-0 left-0 z-[99005] flex w-56 flex-col border-r border-border bg-sidebar transition-[transform,width] duration-200',
          'lg:sticky lg:top-0 lg:z-10 lg:h-screen lg:shrink-0 lg:translate-x-0',
          collapsed ? 'lg:w-[52px]' : 'lg:w-[208px]',
          sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        )}
      >
        <div className={cn('flex h-11 shrink-0 items-center justify-between gap-2 px-3', lc('lg:justify-center lg:px-0'))}>
          <Link to="/" onClick={close} className="flex min-w-0 items-center gap-2 font-semibold" title={ui.app_name || config().siteName || 'Bug Tracker'}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><Bug className="h-3.5 w-3.5" /></span>
            <span className={cn('truncate text-[13px]', lc('lg:hidden'))}>{ui.app_name || config().siteName || 'Bug Tracker'}</span>
          </Link>
          <button className="rounded p-1 text-muted-foreground hover:bg-accent lg:hidden" onClick={close} aria-label="Close menu"><X className="h-4 w-4" /></button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-2 pb-3 pt-1">
          <div className="space-y-px">
            <Item to="/" end icon={LayoutDashboard} label="Dashboard" />
            <Item to="/bugs?assignee_id=me" icon={CircleUser} label="My bugs" active={mine} />
            <Item to="/bugs?view=all" icon={Inbox} label="All bugs" active={all} />
            <Item to="/notifications" icon={Bell} label="Inbox" badge={unread.data} />
          </div>

          {favs.length > 0 && (
            <div>
              <Label><span className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />Starred</span></Label>
              <div className="space-y-px">{favs.map((p) => <ProjectLink key={p.id} p={p} star />)}</div>
            </div>
          )}

          <div>
            <Label action={<Link to="/projects" onClick={close} className="font-medium normal-case tracking-normal hover:text-foreground">All</Link>}>Projects</Label>
            <div className="space-y-px">
              {projects.isLoading && <div className="mx-2 h-5 animate-pulse rounded bg-accent" />}
              {all_projects.slice(0, 12).map((p) => <ProjectLink key={p.id} p={p} />)}
              {projects.data?.length === 0 && <p className={cn('px-2 py-1 text-xs text-muted-foreground', lc('lg:hidden'))}>No projects yet</p>}
            </div>
          </div>

          <div className="space-y-px">
            <Label>Insights</Label>
            <Item to="/projects" icon={FolderKanban} label="Projects" />
            <Item to="/reports" icon={BarChart3} label="Reports" />
            <Item to="/users" icon={Users} label="Team" />
          </div>
        </nav>

        {(can('manage_bug_tracker') || can('manage_bug_tracker_users')) && (
          <div className="border-t border-border p-2"><Item to="/settings" icon={Settings} label="Settings" /></div>
        )}
      </aside>
    </>
  );
}
