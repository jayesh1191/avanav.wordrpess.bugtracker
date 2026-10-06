import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import { EmptyState } from '@/components/ui/states';
import type { ChartPoint, TimePoint } from '@/types';
import { BarChart3 } from 'lucide-react';

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7', '#ec4899', '#14b8a6', '#84cc16', '#f97316'];
export const colorFor = (p: ChartPoint, i: number) => p.color ?? PALETTE[i % PALETTE.length];

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md text-popover-foreground">
      {label !== undefined && <div className="mb-1 font-medium">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
          <span>{p.name ?? p.payload?.label}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

const NoData = () => <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="No data yet" description="Charts appear once bugs are reported." className="py-8" />;

export function DonutChart({ data, height = 200 }: { data: ChartPoint[]; height?: number }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!total) return <NoData />;
  const visible = data.filter((d) => d.count > 0);
  return (
    <div style={{ height }} role="img" aria-label={'Breakdown: ' + data.map((d) => `${d.label} ${d.count}`).join(', ')}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={visible} dataKey="count" nameKey="label" innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="none">
            {visible.map((d, i) => <Cell key={d.key} fill={colorFor(d, i)} />)}
          </Pie>
          <Tooltip content={<Tip />} />
          <Legend iconType="circle" iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBars({ data, height = 200, horizontal = false }: { data: ChartPoint[]; height?: number; horizontal?: boolean }) {
  if (!data.some((d) => d.count > 0)) return <NoData />;
  const h = horizontal ? Math.max(height, data.length * 34 + 30) : height;
  return (
    <div style={{ height: h }} role="img" aria-label={'Counts: ' + data.map((d) => `${d.label} ${d.count}`).join(', ')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, left: horizontal ? 8 : -12, bottom: 0 }}>
          <CartesianGrid vertical={horizontal} horizontal={!horizontal} strokeDasharray="3 3" />
          {horizontal ? (
            <>
              <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={110} axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 15) + '…' : v)} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => (v.length > 10 ? v.slice(0, 9) + '…' : v)} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
            </>
          )}
          <Tooltip content={<Tip />} cursor={{ fill: 'hsl(var(--bt-muted))', opacity: 0.5 }} />
          <Bar dataKey="count" name="Bugs" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36}>
            {data.map((d, i) => <Cell key={d.key} fill={colorFor(d, i)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const fmtDate = (d: string, gran: 'day' | 'month') => (gran === 'month' ? format(parseISO(d + '-01'), 'MMM yyyy') : format(parseISO(d), 'MMM d'));

export function TimeChart({ data, series, granularity = 'day', height = 200, kind = 'area' }: {
  data: TimePoint[]; series: { key: 'created' | 'resolved'; label: string; color: string }[]; granularity?: 'day' | 'month'; height?: number; kind?: 'area' | 'line';
}) {
  if (!data.some((d) => series.some((s) => d[s.key] > 0))) return <NoData />;
  const common = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis dataKey="date" tickFormatter={(v: string) => fmtDate(v, granularity)} axisLine={false} tickLine={false} minTickGap={28} />
      <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={32} />
      <Tooltip content={<Tip />} labelFormatter={(v: string) => fmtDate(v, granularity)} />
      {series.length > 1 && <Legend iconType="circle" iconSize={8} />}
    </>
  );
  return (
    <div style={{ height }} role="img" aria-label={'Trend of ' + series.map((s) => s.label).join(' and ')}>
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'area' ? (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            {common}
            {series.map((s) => <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} fill={s.color} fillOpacity={0.15} strokeWidth={2} />)}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            {common}
            {series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} />)}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
