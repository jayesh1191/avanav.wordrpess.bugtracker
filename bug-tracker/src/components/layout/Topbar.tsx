import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ExternalLink, LogOut, Menu, Moon, Plus, Search, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useApp } from '@/store/app';
import { config } from '@/api/client';
import { useUnreadCount } from '@/hooks/useData';
import { useHeaderSlots } from './HeaderSlots';

export function Topbar({ searchRef }: { searchRef: React.RefObject<HTMLInputElement> }) {
  const { theme, toggleTheme, setSidebarOpen, user, can } = useApp();
  const { setLeft, setRight } = useHeaderSlots();
  const nav = useNavigate();
  const unread = useUnreadCount();
  const [q, setQ] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    nav(`/bugs${q.trim() ? `?search=${encodeURIComponent(q.trim())}` : ''}`);
    searchRef.current?.blur();
  };
  const cfg = config();
  return (
    <header className="sticky top-0 z-20 flex h-11 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur">
      <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu className="h-4 w-4" /></Button>
      <div ref={setLeft} className="min-w-0 flex-1" />
      <div ref={setRight} className="flex shrink-0 items-center" />
      <form ref={form} onSubmit={submit} className="relative hidden md:block" role="search">
        <Search className="pointer-events-none absolute left-2 top-[7px] h-3.5 w-3.5 text-muted-foreground" />
        <input
          ref={searchRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          aria-label="Quick search"
          className="h-7 w-36 rounded-md border border-input bg-muted/50 pl-7 pr-6 text-[13px] placeholder:text-muted-foreground transition-[width] hover:border-muted-foreground/40 focus:w-56 focus:border-ring focus:bg-background focus:ring-2 focus:ring-ring/25"
        />
        <kbd className="pointer-events-none absolute right-1.5 top-[5px] rounded border border-border bg-background px-1 text-[10px] leading-4 text-muted-foreground">/</kbd>
      </form>
      {can('create_bug') && (
        <Button size="sm" onClick={() => nav('/bugs/new')} title="New bug (C)"><Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">New bug</span></Button>
      )}
      <Button variant="ghost" size="icon-sm" className="relative" onClick={() => nav('/notifications')} aria-label={`Inbox${unread.data ? `, ${unread.data} unread` : ''}`}>
        <Bell className="h-4 w-4" />
        {!!unread.data && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-destructive" />}
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Toggle dark mode">{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full" aria-label="Account menu"><Avatar user={user} size={24} /></DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><Link to="/bugs?assignee_id=me">My bugs</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><a href={`${cfg.adminUrl}profile.php`}><span className="flex-1">WordPress profile</span><ExternalLink className="h-3 w-3" /></a></DropdownMenuItem>
          <DropdownMenuItem asChild><a href={cfg.adminUrl}><span className="flex-1">WordPress admin</span><ExternalLink className="h-3 w-3" /></a></DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><a href={cfg.logoutUrl}><span className="flex-1">Log out</span><LogOut className="h-3 w-3" /></a></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
