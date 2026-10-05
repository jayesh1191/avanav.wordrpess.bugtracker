import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ArrowUpDown, Bug, Download, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { BugsApi } from '@/api/endpoints';
import type { BugFilters, BugSummary } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm';
import { Pagination } from '@/components/Pagination';
import { PriorityBadge, ProjectChip, SeverityBadge, StatusBadge, UserChip } from '@/components/badges';
import { useApp } from '@/store/app';
import { useBugs, useInvalidateBugs, useProjects, useUsers } from '@/hooks/useData';
import { useDebounce } from '@/hooks/useDebounce';
import { downloadCsv, formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';

const COLUMNS: { key: string; label: string; sort?: string; className?: string }[] = [
  { key: 'id', label: 'ID', sort: 'id', className: 'w-16' },
  { key: 'title', label: 'Title', sort: 'title', className: 'min-w-[16rem]' },
  { key: 'status', label: 'Status', sort: 'status' },
  { key: 'priority', label: 'Priority', sort: 'priority' },
  { key: 'severity', label: 'Severity', sort: 'severity' },
  { key: 'project', label: 'Project', sort: 'project' },
  { key: 'assignee', label: 'Assignee', sort: 'assignee' },
  { key: 'reporter', label: 'Reporter', sort: 'reporter' },
  { key: 'created_at', label: 'Created', sort: 'created_at' },
  { key: 'updated_at', label: 'Updated', sort: 'updated_at' },
];

export default function Bugs() {
  const { can, settings } = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const invalidate = useInvalidateBugs();
  const [sp, setSp] = useSearchParams();
  const projects = useProjects();
  const users = useUsers();

  const filters: BugFilters = {
    search: sp.get('search') ?? '',
    status: sp.get('status') ?? '',
    priority: sp.get('priority') ?? '',
    severity: sp.get('severity') ?? '',
    project_id: sp.get('project_id') ?? '',
    assignee_id: sp.get('assignee_id') ?? '',
    orderby: sp.get('orderby') ?? 'created_at',
    order: sp.get('order') === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Number(sp.get('page')) || 1),
    per_page: Number(sp.get('per_page')) || undefined,
  };
  const patch = (p: Record<string, string | number | undefined>, keepPage = false) =>
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(p)) (v === undefined || v === '' ? next.delete(k) : next.set(k, String(v)));
      if (!keepPage) next.delete('page');
      return next;
    }, { replace: true });

  const [searchText, setSearchText] = useState(filters.search ?? '');
  const debounced = useDebounce(searchText);
  useEffect(() => { setSearchText(sp.get('search') ?? ''); }, [sp.get('search')]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (debounced !== (sp.get('search') ?? '')) patch({ search: debounced }); }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = useBugs(filters);
  const items = q.data?.items ?? [];
  const [selected, setSelected] = useState<Set<number>>(new Set());
  useEffect(() => { setSelected(new Set()); }, [q.data?.page, sp.toString()]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasFilters = !!(filters.search || filters.status || filters.priority || filters.severity || filters.project_id || filters.assignee_id);
  const allSelected = items.length > 0 && items.every((b) => selected.has(b.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((b) => b.id)));
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const sortBy = (col: string) =>
    patch({ orderby: col, order: filters.orderby === col && filters.order === 'asc' ? 'desc' : 'asc' }, true);

  const bulk = useMutation({
    mutationFn: ({ ids, action, value }: { ids: number[]; action: string; value?: string | number }) => BugsApi.bulk(ids, action, value),
    onSuccess: (r) => {
      invalidate();
      setSelected(new Set());
      if (r.failed.length) toast.error(`${r.updated.length} updated, ${r.failed.length} failed`, 'You may not have permission for some of the selected bugs.');
      else toast.success(`${r.updated.length} bug${r.updated.length === 1 ? '' : 's'} updated`);
    },
    onError: (e: Error) => toast.error('Bulk action failed', e.message),
  });

  const runBulk = async (ids: number[], action: string, value?: string | number) => {
    if (action === 'delete') {
      const ok = await confirm({ title: `Delete ${ids.length} bug${ids.length === 1 ? '' : 's'}?`, description: 'This permanently removes the bugs together with their comments and attachments.', confirmLabel: 'Delete', destructive: true });
      if (!ok) return;
    }
    bulk.mutate({ ids, action, value });
  };

  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await BugsApi.list({ ...filters, page: 1, export: 1, per_page: 5000 });
      const label = (list: { slug: string; label: string }[] | undefined, s: string) => list?.find((i) => i.slug === s)?.label ?? s;
      downloadCsv(`bugs-${new Date().toISOString().slice(0, 10)}.csv`, [
        ['ID', 'Title', 'Status', 'Priority', 'Severity', 'Project', 'Component', 'Version', 'Assignee', 'Reporter', 'Due date', 'Created', 'Updated'],
        ...all.items.map((b) => [b.id, b.title, label(settings?.statuses, b.status), label(settings?.priorities, b.priority), label(settings?.severities, b.severity), b.project?.name ?? '', b.component, b.version, b.assignee?.name ?? '', b.reporter?.name ?? '', b.due_date ?? '', b.created_at, b.updated_at]),
      ]);
      toast.success(`Exported ${all.items.length} bugs`);
    } catch (e) {
      toast.error('Export failed', (e as Error).message);
    } finally { setExporting(false); }
  };

  const remove = async (b: BugSummary) => {
    if (!(await confirm({ title: `Delete bug #${b.id}?`, description: `“${b.title}” and its comments and attachments will be permanently deleted.`, confirmLabel: 'Delete', destructive: true }))) return;
    bulk.mutate({ ids: [b.id], action: 'delete' });
  };

  const statusOpts = useMemo(() => (settings?.statuses ?? []).map((s) => ({ value: s.slug, label: s.label })), [settings]);
  const prioOpts = useMemo(() => (settings?.priorities ?? []).map((s) => ({ value: s.slug, label: s.label })), [settings]);
  const sevOpts = useMemo(() => (settings?.severities ?? []).map((s) => ({ value: s.slug, label: s.label })), [settings]);
  const projectOpts = (projects.data ?? []).map((p) => ({ value: String(p.id), label: p.name }));
  const assigneeOpts = [{ value: 'me', label: 'Assigned to me' }, { value: 'unassigned', label: 'Unassigned' }, ...(users.data?.items ?? []).map((u) => ({ value: String(u.id), label: u.name }))];
  const canEdit = can('edit_bug');

  return (
    <>
      <PageHeader
        title="Bugs"
        crumbs={[{ label: 'Bugs' }]}
        description="Search, filter and triage every reported bug."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} loading={exporting}><Download className="h-4 w-4" />Export CSV</Button>
            {can('create_bug') && <Button onClick={() => nav('/bugs/new')}><Plus className="h-4 w-4" />New bug</Button>}
          </>
        }
      />

      <Card>
        <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search title, description or #id" aria-label="Search bugs" />
          </div>
          <Select aria-label="Filter by status" value={filters.status ?? ''} onChange={(v) => patch({ status: v })} options={statusOpts} emptyLabel="All statuses" placeholder="All statuses" />
          <Select aria-label="Filter by priority" value={filters.priority ?? ''} onChange={(v) => patch({ priority: v })} options={prioOpts} emptyLabel="All priorities" placeholder="All priorities" />
          <Select aria-label="Filter by severity" value={filters.severity ?? ''} onChange={(v) => patch({ severity: v })} options={sevOpts} emptyLabel="All severities" placeholder="All severities" />
          <Select aria-label="Filter by project" value={filters.project_id ?? ''} onChange={(v) => patch({ project_id: v })} options={projectOpts} emptyLabel="All projects" placeholder="All projects" />
          <Select aria-label="Filter by assignee" className="lg:col-span-2" value={filters.assignee_id ?? ''} onChange={(v) => patch({ assignee_id: v })} options={assigneeOpts} emptyLabel="Any assignee" placeholder="Any assignee" />
          {hasFilters && (
            <Button variant="ghost" onClick={() => { setSearchText(''); setSp({}, { replace: true }); }}><X className="h-4 w-4" />Clear filters</Button>
          )}
        </div>

        {selected.size > 0 && canEdit && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-accent/50 px-3 py-2 text-sm">
            <span className="font-medium">{selected.size} selected</span>
            <div className="w-36"><Select aria-label="Bulk set status" value="" onChange={(v) => v && runBulk([...selected], 'status', v)} options={statusOpts} placeholder="Set status…" disabled={bulk.isPending} /></div>
            <div className="w-36"><Select aria-label="Bulk set priority" value="" onChange={(v) => v && runBulk([...selected], 'priority', v)} options={prioOpts} placeholder="Set priority…" disabled={bulk.isPending} /></div>
            <div className="w-44"><Select aria-label="Bulk assign" value="" onChange={(v) => v && runBulk([...selected], 'assign', Number(v))} options={[{ value: '0', label: 'Unassign' }, ...(users.data?.items ?? []).map((u) => ({ value: String(u.id), label: u.name }))]} placeholder="Assign to…" disabled={bulk.isPending} /></div>
            {can('delete_bug') && <Button variant="destructive" size="sm" onClick={() => runBulk([...selected], 'delete')} disabled={bulk.isPending}><Trash2 className="h-3.5 w-3.5" />Delete</Button>}
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}

        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <th className="w-10 px-3 py-2.5"><Checkbox checked={allSelected ? true : selected.size > 0 ? 'indeterminate' : false} onCheckedChange={toggleAll} aria-label="Select all" disabled={!items.length} /></th>
                  {COLUMNS.map((c) => {
                    const active = filters.orderby === c.sort;
                    const Icon = !active ? ArrowUpDown : filters.order === 'asc' ? ArrowUp : ArrowDown;
                    return (
                      <th key={c.key} className={cn('px-3 py-2.5 font-medium', c.className)} aria-sort={active ? (filters.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground')} onClick={() => c.sort && sortBy(c.sort)}>
                          {c.label}<Icon className={cn('h-3 w-3', !active && 'opacity-40')} />
                        </button>
                      </th>
                    );
                  })}
                  <th className="w-10 px-3 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {q.isLoading && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border"><td colSpan={COLUMNS.length + 2} className="px-3 py-3"><Skeleton className="h-6 w-full" /></td></tr>
                ))}
                {items.map((b) => (
                  <tr key={b.id} className={cn('border-b border-border last:border-0 hover:bg-muted/40', selected.has(b.id) && 'bg-accent/40', q.isPlaceholderData && 'opacity-60')}>
                    <td className="px-3 py-2.5"><Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggle(b.id)} aria-label={`Select bug ${b.id}`} /></td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">#{b.id}</td>
                    <td className="px-3 py-2.5 max-w-[26rem]"><Link to={`/bugs/${b.id}`} className="font-medium hover:text-primary hover:underline line-clamp-2">{b.title}</Link></td>
                    <td className="px-3 py-2.5"><StatusBadge slug={b.status} /></td>
                    <td className="px-3 py-2.5"><PriorityBadge slug={b.priority} /></td>
                    <td className="px-3 py-2.5"><SeverityBadge slug={b.severity} /></td>
                    <td className="px-3 py-2.5 max-w-[10rem]"><ProjectChip project={b.project} /></td>
                    <td className="px-3 py-2.5 max-w-[10rem]"><UserChip user={b.assignee} /></td>
                    <td className="px-3 py-2.5 max-w-[10rem]"><UserChip user={b.reporter} empty="—" /></td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(b.created_at)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(b.updated_at)}</td>
                    <td className="px-3 py-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label={`Actions for bug ${b.id}`}><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => nav(`/bugs/${b.id}`)}><Bug className="h-4 w-4" />View</DropdownMenuItem>
                          {canEdit && <DropdownMenuItem onSelect={() => nav(`/bugs/${b.id}/edit`)}><Pencil className="h-4 w-4" />Edit</DropdownMenuItem>}
                          {canEdit && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuSub><DropdownMenuSubTrigger>Change status</DropdownMenuSubTrigger><DropdownMenuSubContent>
                                {statusOpts.map((o) => <DropdownMenuItem key={o.value} disabled={o.value === b.status} onSelect={() => runBulk([b.id], 'status', o.value)}>{o.label}</DropdownMenuItem>)}
                              </DropdownMenuSubContent></DropdownMenuSub>
                              <DropdownMenuSub><DropdownMenuSubTrigger>Change priority</DropdownMenuSubTrigger><DropdownMenuSubContent>
                                {prioOpts.map((o) => <DropdownMenuItem key={o.value} disabled={o.value === b.priority} onSelect={() => runBulk([b.id], 'priority', o.value)}>{o.label}</DropdownMenuItem>)}
                              </DropdownMenuSubContent></DropdownMenuSub>
                              <DropdownMenuSub><DropdownMenuSubTrigger>Assign to</DropdownMenuSubTrigger><DropdownMenuSubContent>
                                <DropdownMenuItem onSelect={() => runBulk([b.id], 'assign', 0)}>Unassigned</DropdownMenuItem>
                                {(users.data?.items ?? []).map((u) => <DropdownMenuItem key={u.id} disabled={u.id === b.assignee?.id} onSelect={() => runBulk([b.id], 'assign', u.id)}>{u.name}</DropdownMenuItem>)}
                              </DropdownMenuSubContent></DropdownMenuSub>
                            </>
                          )}
                          {can('delete_bug') && (<><DropdownMenuSeparator /><DropdownMenuItem destructive onSelect={() => remove(b)}><Trash2 className="h-4 w-4" />Delete</DropdownMenuItem></>)}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!q.isLoading && items.length === 0 && (
              <EmptyState
                title={hasFilters ? 'No bugs match your filters' : 'No bugs yet'}
                description={hasFilters ? 'Try adjusting or clearing the filters.' : 'Report the first bug to get started.'}
                action={!hasFilters && can('create_bug') ? <Button onClick={() => nav('/bugs/new')}><Plus className="h-4 w-4" />New bug</Button> : undefined}
              />
            )}
          </div>
        )}
        {q.data && q.data.total > 0 && <Pagination page={q.data.page} totalPages={q.data.total_pages} total={q.data.total} label="bugs" onPage={(p) => patch({ page: p }, true)} />}
      </Card>
    </>
  );
}
