import { NavLink } from 'react-router-dom';
import { Bell, Bug, FolderKanban, LayoutDashboard, BarChart3, Settings, Users, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useApp } from '@/store/app';
import { useUnreadCount } from '@/hooks/useData';

export function Sidebar() {
  const { can, sidebarOpen, setSidebarOpen } = useApp();
  const unread = useUnreadCount();
  const items = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/bugs', label: 'Bugs', icon: Bug },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    { to: '/users', label: 'Users', icon: Users },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
    { to: '/notifications', label: 'Notifications', icon: Bell, badge: unread.data },
    ...(can('manage_bug_tracker') || can('manage_bug_tracker_users') ? [{ to: '/settings', label: 'Settings', icon: Settings }] : []),
  ];
  return (
    <>
      {sidebarOpen && <div className="fixed inset-0 z-[99004] bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />}
      <aside
        aria-label="Bug Tracker navigation"
        className={cn(
          'fixed left-0 top-0 bottom-0 z-[99005] w-64 flex flex-col border-r border-border bg-card transition-transform',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:z-10 lg:shrink-0 lg:w-60',
          sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2 px-4 border-b border-border">
          <div className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Bug className="h-4 w-4" /></span>
            Bug Tracker
          </div>
          <button className="lg:hidden rounded-md p-1 text-muted-foreground hover:bg-accent" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {items.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {!!badge && <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground">{badge > 99 ? '99+' : badge}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
