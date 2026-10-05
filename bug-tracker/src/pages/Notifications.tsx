import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { AtSign, Bell, CheckCheck, CheckCircle2, MessageSquare, RefreshCw, UserPlus, type LucideIcon } from 'lucide-react';
import { MiscApi } from '@/api/endpoints';
import type { Notification } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Pagination } from '@/components/Pagination';
import { useToast } from '@/components/ui/toast';
import { keys } from '@/hooks/useData';
import { cn } from '@/utils/cn';
import { timeAgo } from '@/utils/format';

const ICONS: Record<Notification['type'], LucideIcon> = { assignment: UserPlus, status: RefreshCw, comment: MessageSquare, mention: AtSign, resolution: CheckCircle2 };

export default function Notifications() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: [...keys.notifications, filter, page],
    queryFn: () => MiscApi.notifications({ unread: filter === 'unread' ? 1 : undefined, page }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: keys.notifications });
  const read = useMutation({ mutationFn: MiscApi.markRead, onSuccess: refresh, onError: (e: Error) => toast.error('Could not mark as read', e.message) });
  const readAll = useMutation({ mutationFn: MiscApi.markAllRead, onSuccess: () => { refresh(); toast.success('All notifications marked as read'); }, onError: (e: Error) => toast.error('Failed', e.message) });
  const items = q.data?.items ?? [];

  return (
    <>
      <PageHeader title="Notifications" crumbs={[{ label: 'Notifications' }]} description="Assignments, status changes, comments, mentions and resolutions."
        actions={<>
          <div className="w-36"><Select aria-label="Filter notifications" value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread only' }]} /></div>
          <Button variant="outline" onClick={() => readAll.mutate()} loading={readAll.isPending} disabled={!q.data?.unread_count}><CheckCheck className="h-4 w-4" />Mark all read</Button>
        </>} />
      <Card>
        {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
          : q.isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          : items.length === 0 ? <EmptyState icon={<Bell className="h-6 w-6" />} title={filter === 'unread' ? 'You’re all caught up' : 'No notifications yet'} description="You’ll be notified when bugs are assigned to you, change status, or someone mentions you." />
          : <ul className="divide-y divide-border">
            {items.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <button className={cn('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50', !n.is_read && 'bg-accent/30')}
                    onClick={() => { if (!n.is_read) read.mutate(n.id); if (n.bug_id) nav(`/bugs/${n.bug_id}`); }}>
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1"><span className={cn('block text-sm break-words', !n.is_read && 'font-medium')}>{n.message}</span><span className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</span></span>
                    {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>}
        {q.data && q.data.total > 0 && <Pagination page={q.data.page} totalPages={q.data.total_pages} total={q.data.total} label="notifications" onPage={setPage} />}
      </Card>
    </>
  );
}
