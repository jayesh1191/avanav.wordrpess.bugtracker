import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MiscApi } from '@/api/endpoints';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { CategoryBars, DonutChart, TimeChart } from '@/components/charts';

const RANGES = [{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: '180', label: 'Last 6 months' }, { value: '365', label: 'Last 12 months' }];

export default function Reports() {
  const [days, setDays] = useState('30');
  const q = useQuery({ queryKey: ['reports', days], queryFn: () => MiscApi.reports(Number(days)) });
  const r = q.data;
  const chart = (title: string, desc: string | undefined, body: React.ReactNode, span = '') => (
    <Card className={span}><CardHeader><CardTitle>{title}</CardTitle>{desc && <CardDescription>{desc}</CardDescription>}</CardHeader><CardContent>{q.isLoading ? <Skeleton className="h-60" /> : body}</CardContent></Card>
  );
  return (
    <>
      <PageHeader title="Reports" crumbs={[{ label: 'Reports' }]} description="Interactive breakdowns of the bugs you can access."
        actions={<div className="w-44"><Select aria-label="Time range" value={days} onChange={setDays} options={RANGES} /></div>} />
      {q.isError ? <Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {chart('Bugs by status', 'All current bugs', r && <DonutChart data={r.by_status} />)}
          {chart('Bugs by priority', undefined, r && <CategoryBars data={r.by_priority} />)}
          {chart('Bugs by severity', undefined, r && <CategoryBars data={r.by_severity} />)}
          {chart('Bugs by project', undefined, r && <CategoryBars data={r.by_project} horizontal />)}
          {chart('Bugs by assignee', 'Top 25 assignees', r && <CategoryBars data={r.by_assignee} horizontal />, 'lg:col-span-2')}
          {chart('Bugs created over time', RANGES.find((x) => x.value === days)?.label, r && <TimeChart data={r.over_time} granularity={r.granularity} series={[{ key: 'created', label: 'Created', color: '#6366f1' }]} />)}
          {chart('Bugs resolved over time', RANGES.find((x) => x.value === days)?.label, r && <TimeChart data={r.over_time} granularity={r.granularity} series={[{ key: 'resolved', label: 'Resolved', color: '#10b981' }]} />)}
        </div>
      )}
    </>
  );
}
