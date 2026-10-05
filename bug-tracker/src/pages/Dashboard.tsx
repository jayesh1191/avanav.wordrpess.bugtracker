import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertOctagon, Bug, CheckCircle2, CircleDot, Lock, Loader, UserCheck, type LucideIcon } from 'lucide-react';
import { MiscApi } from '@/api/endpoints';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { CategoryBars, DonutChart, TimeChart } from '@/components/charts';
import { ActivityList } from '@/components/ActivityList';
import { PriorityBadge, StatusBadge } from '@/components/badges';
import { useApp } from '@/store/app';
import { timeAgo } from '@/utils/format';

function Stat({ label, value, icon: Icon, tone, to }: { label: string; value: number; icon: LucideIcon; tone: string; to: string }) {
  return (
    <Link to={to} className="block rounded-lg focus-visible:outline-2">
      <Card className="p-4 transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-md" style={{ background: `${tone}22`, color: tone }}><Icon className="h-4 w-4" /></span>
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const { can, settings } = useApp();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: MiscApi.dashboard });

  if (q.isError) return <><PageHeader title="Dashboard" /><Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card></>;
  if (q.isLoading || !q.data) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[92px]" />)}</div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72" />)}</div>
      </>
    );
  }
  const d = q.data;
  const firstOf = (cat: string) => settings?.statuses.find((s) => s.category === cat)?.slug ?? '';
  const t = d.totals;
  const topPriority = settings?.priorities[settings.priorities.length - 1]?.slug ?? 'critical';

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="An overview of bugs across the projects you can access."
        actions={can('create_bug') && <Button asChild><Link to="/bugs/new">Report a bug</Link></Button>}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Stat label="Total bugs" value={t.total} icon={Bug} tone="#6366f1" to="/bugs" />
        <Stat label="Open" value={t.open} icon={CircleDot} tone="#3b82f6" to={`/bugs?status=${firstOf('open')}`} />
        <Stat label="In progress" value={t.in_progress} icon={Loader} tone="#f59e0b" to={`/bugs?status=${firstOf('in_progress')}`} />
        <Stat label="Resolved" value={t.resolved} icon={CheckCircle2} tone="#10b981" to={`/bugs?status=${firstOf('resolved')}`} />
        <Stat label="Closed" value={t.closed} icon={Lock} tone="#6b7280" to={`/bugs?status=${firstOf('closed')}`} />
        <Stat label="Critical" value={t.critical} icon={AlertOctagon} tone="#ef4444" to={`/bugs?priority=${topPriority}`} />
        <Stat label="Assigned to me" value={t.assigned_to_me} icon={UserCheck} tone="#8b5cf6" to="/bugs?assignee_id=me" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card><CardHeader><CardTitle>Bugs by status</CardTitle></CardHeader><CardContent><DonutChart data={d.status_chart} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Bugs by priority</CardTitle></CardHeader><CardContent><CategoryBars data={d.priority_chart} /></CardContent></Card>
        <Card>
          <CardHeader><CardTitle>Bug trend</CardTitle><CardDescription>Last 30 days</CardDescription></CardHeader>
          <CardContent>
            <TimeChart data={d.trend} series={[{ key: 'created', label: 'Created', color: '#6366f1' }, { key: 'resolved', label: 'Resolved', color: '#10b981' }]} kind="line" />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Recent bugs</CardTitle><Button asChild variant="link" size="sm"><Link to="/bugs">View all</Link></Button></CardHeader>
          <CardContent className="p-0 sm:p-0">
            {d.recent_bugs.length === 0 ? (
              <EmptyState title="No bugs yet" description="Bugs you report will show up here." action={can('create_bug') ? <Button asChild size="sm"><Link to="/bugs/new">Report a bug</Link></Button> : undefined} />
            ) : (
              <ul className="divide-y divide-border">
                {d.recent_bugs.map((b) => (
                  <li key={b.id}>
                    <Link to={`/bugs/${b.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted/60 sm:px-5">
                      <span className="text-xs tabular-nums text-muted-foreground">#{b.id}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{b.title}</span>
                      <PriorityBadge slug={b.priority} />
                      <StatusBadge slug={b.status} />
                      <span className="w-full text-xs text-muted-foreground sm:w-auto">{b.project?.name} · {timeAgo(b.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
          <CardContent>
            {d.recent_activity.length === 0 ? <EmptyState title="No activity yet" className="py-8" /> : <ActivityList items={d.recent_activity} showBug />}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
