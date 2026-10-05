import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { BugsApi, MiscApi, ProjectsApi } from '@/api/endpoints';
import type { BugFilters } from '@/types';

export const keys = {
  bugs: ['bugs'] as const,
  bug: (id: number) => ['bug', id] as const,
  projects: ['projects'] as const,
  users: ['users'] as const,
  notifications: ['notifications'] as const,
};

export const useBugs = (f: BugFilters) =>
  useQuery({ queryKey: [...keys.bugs, f], queryFn: () => BugsApi.list(f), placeholderData: keepPreviousData });
export const useBug = (id: number) => useQuery({ queryKey: keys.bug(id), queryFn: () => BugsApi.get(id), enabled: id > 0 });
export const useProjects = (p?: { status?: string; search?: string }) =>
  useQuery({ queryKey: [...keys.projects, p ?? {}], queryFn: () => ProjectsApi.list(p) });
export const useProject = (id: number) => useQuery({ queryKey: ['project', id], queryFn: () => ProjectsApi.get(id), enabled: id > 0 });
export const useUsers = (p?: { search?: string; page?: number; per_page?: number }) =>
  useQuery({ queryKey: [...keys.users, p ?? {}], queryFn: () => MiscApi.users({ per_page: 200, ...p }), staleTime: 60_000, placeholderData: keepPreviousData });
export const useUnreadCount = () =>
  useQuery({
    queryKey: [...keys.notifications, 'unread'],
    queryFn: () => MiscApi.notifications({ unread: 1, page: 1 }),
    refetchInterval: 60_000,
    select: (d) => d.unread_count,
  });

/** Invalidate everything derived from bugs after a mutation. */
export function useInvalidateBugs() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: keys.bugs });
    qc.invalidateQueries({ queryKey: ['bug'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['reports'] });
    qc.invalidateQueries({ queryKey: keys.projects });
    qc.invalidateQueries({ queryKey: ['project'] });
    qc.invalidateQueries({ queryKey: keys.users });
    qc.invalidateQueries({ queryKey: keys.notifications });
  };
}
export { useMutation };
