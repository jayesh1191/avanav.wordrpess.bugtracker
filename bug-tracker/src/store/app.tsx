import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MiscApi } from '@/api/endpoints';
import { config } from '@/api/client';
import { hexToHsl } from '@/utils/color';
import type { Settings, UiSettings } from '@/types';

type Theme = 'light' | 'dark';
interface AppState {
  theme: Theme;
  toggleTheme: () => void;
  settings: Settings | undefined;
  settingsError: Error | null;
  ui: UiSettings;
  can: (cap: string) => boolean;
  user: ReturnType<typeof config>['user'];
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  collapsed: boolean;
  toggleCollapsed: () => void;
}
const Ctx = createContext<AppState | null>(null);

export const DEFAULT_UI: UiSettings = {
  app_name: '', theme: 'system', density: 'compact', accent: '#4f46e5', sidebar_collapsed: false, default_view: 'all', group_by_status: false,
  columns: { severity: true, project: true, assignee: true, reporter: true, created: true, updated: true },
};

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
const systemDark = () => !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function AppProvider({ children }: { children: ReactNode }) {
  // Per-user choices (localStorage) override the admin-configured defaults.
  const [userTheme, setUserTheme] = useState<Theme | null>(() => { const s = read('bt-theme'); return s === 'dark' || s === 'light' ? s : null; });
  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(() => { const s = read('bt-sidebar'); return s === '1' ? true : s === '0' ? false : null; });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const cfg = config();
  const q = useQuery({ queryKey: ['settings'], queryFn: MiscApi.settings, staleTime: 5 * 60_000 });
  const ui: UiSettings = useMemo(() => ({ ...DEFAULT_UI, ...(q.data?.ui ?? {}), columns: { ...DEFAULT_UI.columns, ...(q.data?.ui?.columns ?? {}) } }), [q.data]);

  const theme: Theme = userTheme ?? (ui.theme === 'system' ? (systemDark() ? 'dark' : 'light') : ui.theme);
  const collapsed = userCollapsed ?? ui.sidebar_collapsed;

  useEffect(() => {
    const root = document.getElementById('bug-tracker-root');
    if (!root) return;
    root.classList.toggle('bt-dark', theme === 'dark');
    const [h, s, l] = hexToHsl(ui.accent);
    const light = theme === 'dark' ? Math.min(78, Math.max(l, 62) + 8) : Math.min(l, 52);
    root.style.setProperty('--bt-primary', `${h} ${s}% ${light}%`);
    root.style.setProperty('--bt-ring', `${h} ${s}% ${light}%`);
    root.style.setProperty('--bt-primary-foreground', theme === 'dark' ? '240 30% 8%' : '0 0% 100%');
    root.style.setProperty('--bt-row-h', ui.density === 'comfortable' ? '42px' : '34px');
  }, [theme, ui.accent, ui.density]);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setUserTheme(next);
    write('bt-theme', next);
  }, [theme]);
  const toggleCollapsed = useCallback(() => {
    const next = !collapsed;
    setUserCollapsed(next);
    write('bt-sidebar', next ? '1' : '0');
  }, [collapsed]);
  const can = useCallback((cap: string) => !!cfg.user.caps[cap], [cfg]);

  const value = useMemo<AppState>(
    () => ({ theme, toggleTheme, settings: q.data, settingsError: q.error as Error | null, ui, can, user: cfg.user, sidebarOpen, setSidebarOpen, collapsed, toggleCollapsed }),
    [theme, toggleTheme, q.data, q.error, ui, can, cfg, sidebarOpen, collapsed, toggleCollapsed],
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
