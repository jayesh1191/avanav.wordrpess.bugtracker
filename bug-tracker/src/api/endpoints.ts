import { api } from './client';
import type {
  ActivityEntry, Attachment, BugDetail, BugFilters, BugSummary, Comment, Dashboard, Notification, Paged,
  Project, Reports, Settings, WpUser,
} from '@/types';

export const BugsApi = {
  list: (f: BugFilters & { export?: number }) => api.get<Paged<BugSummary>>('bugs', f as Record<string, string>),
  get: (id: number) => api.get<BugDetail>(`bugs/${id}`),
  create: (data: Record<string, unknown>) => api.post<BugDetail>('bugs', data),
  update: (id: number, data: Record<string, unknown>) => api.put<BugDetail>(`bugs/${id}`, data),
  remove: (id: number) => api.del<{ deleted: boolean }>(`bugs/${id}`),
  bulk: (ids: number[], action: string, value?: string | number) =>
    api.post<{ updated: number[]; failed: { id: number; reason: string }[] }>('bugs/bulk', { ids, action, value }),
  comments: (id: number) => api.get<Comment[]>(`bugs/${id}/comments`),
  addComment: (id: number, content: string) => api.post<Comment>(`bugs/${id}/comments`, { content }),
  removeComment: (id: number) => api.del<unknown>(`comments/${id}`),
  activity: (id: number) => api.get<ActivityEntry[]>(`bugs/${id}/activity`),
  upload: (id: number, file: File) => api.upload<Attachment>(`bugs/${id}/attachments`, file),
  removeAttachment: (id: number) => api.del<unknown>(`attachments/${id}`),
};

export const ProjectsApi = {
  list: (p?: { status?: string; search?: string }) => api.get<Project[]>('projects', p),
  get: (id: number) => api.get<Project>(`projects/${id}`),
  create: (d: Record<string, unknown>) => api.post<Project>('projects', d),
  update: (id: number, d: Record<string, unknown>) => api.put<Project>(`projects/${id}`, d),
  remove: (id: number, force = false) => api.del<unknown>(`projects/${id}`, { force: force ? 1 : 0 }),
};

export const MiscApi = {
  dashboard: () => api.get<Dashboard>('dashboard'),
  reports: (days: number) => api.get<Reports>('reports', { days }),
  users: (p?: { search?: string; page?: number; per_page?: number }) => api.get<Paged<WpUser>>('users', p),
  notifications: (p?: { unread?: number; page?: number }) =>
    api.get<Paged<Notification> & { unread_count: number }>('notifications', p),
  markRead: (id: number) => api.put<unknown>(`notifications/${id}/read`),
  markAllRead: () => api.put<unknown>('notifications/read-all'),
  settings: () => api.get<Settings>('settings'),
  saveSettings: (s: unknown) => api.put<Settings>('settings', s),
};
