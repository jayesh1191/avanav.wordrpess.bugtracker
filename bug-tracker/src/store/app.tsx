import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MiscApi } from '@/api/endpoints';
import { config } from '@/api/client';
import type { Settings } from '@/types';

type Theme = 'light' | 'dark';
interface AppState {
  theme: Theme;
  toggleTheme: () => void;
  settings: Settings | undefined;
  settingsError: Error | null;
  can: (cap: string) => boolean;
  user: ReturnType<typeof config>['user'];
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}
const Ctx = createContext<AppState | null>(null);

const readTheme = (): Theme => {
  try {
    const s = localStorage.getItem('bt-theme');
    if (s === 'dark' || s === 'light') return s;
  } catch { /* storage unavailable */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const cfg = config();
  const q = useQuery({ queryKey: ['settings'], queryFn: MiscApi.settings, staleTime: 5 * 60_000 });

  useEffect(() => {
    document.getElementById('bug-tracker-root')?.classList.toggle('bt-dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('bt-theme', next); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const can = useCallback((cap: string) => !!cfg.user.caps[cap], [cfg]);

  const value = useMemo<AppState>(
    () => ({ theme, toggleTheme, settings: q.data, settingsError: q.error as Error | null, can, user: cfg.user, sidebarOpen, setSidebarOpen }),
    [theme, toggleTheme, q.data, q.error, can, cfg, sidebarOpen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

/** Lookup helpers for the configurable vocabularies. */
export function useVocab() {
  const { settings } = useApp();
  return useMemo(() => {
    const find = <T extends { slug: string }>(list: T[] | undefined, slug: string) => list?.find((i) => i.slug === slug);
    return {
      status: (slug: string) => find(settings?.statuses, slug),
      priority: (slug: string) => find(settings?.priorities, slug),
      severity: (slug: string) => find(settings?.severities, slug),
    };
  }, [settings]);
}
