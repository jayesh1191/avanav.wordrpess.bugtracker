import { useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { HeaderSlotsProvider } from './HeaderSlots';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useApp } from '@/store/app';

export function Layout() {
  const nav = useNavigate();
  const { can } = useApp();
  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts: "c" = new bug, "/" = search (ignored while typing).
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest('input,textarea,select,[contenteditable],[role=dialog],[role=menu],[role=listbox]')) return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === 'c' && can('create_bug')) { e.preventDefault(); nav('/bugs/new'); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [nav, can]);

  return (
    <HeaderSlotsProvider>
      <div className="flex items-start">
        <Sidebar />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-background">
          <Topbar searchRef={searchRef} />
          <main className="min-w-0 flex-1"><ErrorBoundary><Outlet /></ErrorBoundary></main>
        </div>
      </div>
    </HeaderSlotsProvider>
  );
}
