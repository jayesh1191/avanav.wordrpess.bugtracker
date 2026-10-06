import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { MiscApi } from '@/api/endpoints';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { CategoryBars, DonutChart, TimeChart } from '@/components/charts';
import { ActivityList } from '@/components/ActivityList';
import { PriorityBadge, StatusBadge, bugRef } from '@/components/badges';
import { StatusIcon } from '@/components/icons';
import { useApp } from '@/store/app';
import { timeAgoShort } from '@/utils/format';
import type { StatusCategory } from '@/types';

export default function Dashboard() {
  const { can, settings } = useApp();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: MiscApi.dashboard });
  const header = <PageHeader title="Dashboard" crumbs={[{ label: 'Dashboard' }]} actions={can('create_bug') && <Button size="sm" variant="outline" asChild><Link to="/bugs/new"><Plus className="h-3.5 w-3.5" />Report bug</Link></Button>} />;

  if (q.isError) return <>{header}<PageBody><Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card></PageBody></>;
  if (q.isLoading || !q.data) {
    return <>{header}<PageBody><Skeleton className="h-16" /><div className="mt-3 grid gap-3 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52" />)}</div></PageBody></>;
  }
  const d = q.data;
  const t = d.totals;
  const first = (cat: StatusCategory) => settings?.statuses.find((s) => s.category === cat);
  const topPriority = settings?.priorities[settings.priorities.length - 1]?.slug ?? 'critical';
  const kpis: { label: string; value: number; to: string; icon?: React.ReactNode; tone?: string }[] = [
    { label: 'Total', value: t.total, to: '/bugs?view=all' },
    { label: 'Open', value: t.open, to: `/bugs?status=${first('open')?.slug ?? ''}`, icon: <StatusIcon category="open" color={first('open')?.color ?? '#3b82f6'} /> },
    { label: 'In progress', value: t.in_progress, to: `/bugs?status=${first('in_progress')?.slug ?? ''}`, icon: <StatusIcon category="in_progress" color={first('in_progress')?.color ?? '#f59e0b'} /> },
    { label: 'Resolved', value: t.resolved, to: `/bugs?status=${first('resolved')?.slug ?? ''}`, icon: <StatusIcon category="resolved" color={first('resolved')?.color ?? '#10b981'} /> },
    { label: 'Closed', value: t.closed, to: `/bugs?status=${first('closed')?.slug ?? ''}`, icon: <StatusIcon category="closed" color={first('closed')?.color ?? '#6b7280'} /> },
    { label: 'Urgent', value: t.critical, to: `/bugs?priority=${topPriority}`, tone: t.critical ? 'text-destructive' : '' },
    { label: 'Assigned to me', value: t.assigned_to_me, to: '/bugs?assignee_id=me' },
  ];

  return (
    <>
      {header}
      <PageBody className="space-y-3">
        <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border bg-card sm:grid-cols-4 lg:grid-cols-7 [&>*]:border-b [&>*]:border-r [&>*]:border-border/70">
          {kpis.map((k) => (
            <Link key={k.label} to={k.to} className="group px-3.5 py-2.5 transition-colors hover:bg-muted/60">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{k.icon}{k.label}</div>
              <div className={`mt-0.5 text-xl font-semibold tabular-nums leading-7 ${k.tone ?? ''}`}>{k.value}</div>
            </Link>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-3 [&>*]:min-w-0">
          <Card><CardHeader><CardTitle>By status</CardTitle></CardHeader><CardContent><DonutChart data={d.status_chart} height={176} /></CardContent></Card>
          <Card><CardHeader><CardTitle>By priority</CardTitle></CardHeader><CardContent><CategoryBars data={d.priority_chart} height={176} /></CardContent></Card>
          <Card>
            <CardHeader><CardTitle>Created vs resolved</CardTitle><CardDescription>Last 30 days</CardDescription></CardHeader>
            <CardContent><TimeChart height={176} data={d.trend} series={[{ key: 'created', label: 'Created', color: '#6366f1' }, { key: 'resolved', label: 'Resolved', color: '#10b981' }]} kind="line" /></CardContent>
          </Card>
        </div>

        <div className="grid gap-3 lg:grid-cols-5 [&>*]:min-w-0">
          <Card className="lg:col-span-3">
            <CardHeader className="flex-row items-center justify-between pb-1"><CardTitle>Recent bugs</CardTitle><Link to="/bugs" className="text-xs text-primary hover:underline">View all</Link></CardHeader>
            <div className="pb-1">
              {d.recent_bugs.length === 0 ? (
                <EmptyState title="No bugs yet" description="Bugs you report will show up here." className="py-8" />
              ) : d.recent_bugs.map((b) => (
                <Link key={b.id} to={`/bugs/${b.id}`} className="flex h-8 items-center gap-2.5 border-t border-border/60 px-3.5 hover:bg-muted/60">
                  <PriorityBadge slug={b.priority} iconOnly />
                  <span className="w-[68px] shrink-0 text-xs tabular-nums text-muted-foreground">{bugRef(b)}</span>
                  <span className="min-w-0 flex-1 truncate">{b.title}</span>
                  <StatusBadge slug={b.status} className="hidden sm:inline-flex" />
                  {b.assignee ? <Avatar user={b.assignee} size={18} /> : <span className="h-[18px] w-[18px] rounded-full border border-dashed border-muted-foreground/50" />}
                  <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">{timeAgoShort(b.created_at)}</span>
                </Link>
              ))}
            </div>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
            <CardContent>{d.recent_activity.length === 0 ? <EmptyState title="No activity yet" className="py-6" /> : <ActivityList items={d.recent_activity.slice(0, 8)} showBug />}</CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
