import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ExternalLink, LogOut, Menu, Moon, Plus, Search, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useApp } from '@/store/app';
import { config } from '@/api/client';
import { useUnreadCount } from '@/hooks/useData';

export function Topbar() {
  const { theme, toggleTheme, setSidebarOpen, user, can } = useApp();
  const nav = useNavigate();
  const unread = useUnreadCount();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    nav(`/bugs${q.trim() ? `?search=${encodeURIComponent(q.trim())}` : ''}`);
  };
  const admin = config().adminUrl;
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card/90 px-3 sm:px-5 backdrop-blur">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
      <form onSubmit={submit} className="relative hidden sm:block w-full max-w-sm" role="search">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bugs…" className="pl-8" aria-label="Quick search" />
      </form>
      <div className="ml-auto flex items-center gap-1.5">
        {can('create_bug') && (
          <Button size="sm" onClick={() => nav('/bugs/new')}><Plus className="h-4 w-4" /><span className="hidden sm:inline">New bug</span></Button>
        )}
        <Button variant="ghost" size="icon" className="relative" onClick={() => nav('/notifications')} aria-label={`Notifications${unread.data ? `, ${unread.data} unread` : ''}`}>
          <Bell className="h-4 w-4" />
          {!!unread.data && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle dark mode">{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full focus-visible:outline-2" aria-label="Account menu"><Avatar user={user} size={32} /></DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link to="/bugs?assignee_id=me"><span className="flex-1">My assigned bugs</span></Link></DropdownMenuItem>
            <DropdownMenuItem asChild><a href={`${admin}profile.php`}><span className="flex-1">WordPress profile</span><ExternalLink className="h-3.5 w-3.5" /></a></DropdownMenuItem>
            <DropdownMenuItem asChild><a href={admin}><span className="flex-1">WordPress dashboard</span><ExternalLink className="h-3.5 w-3.5" /></a></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><a href={config().logoutUrl}><span className="flex-1">Log out</span><LogOut className="h-3.5 w-3.5" /></a></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
