import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Bug, ChevronDown, ChevronRight, Download, Layers, MessageSquare, MoreHorizontal, Paperclip, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { BugsApi } from '@/api/endpoints';
import type { BugFilters, BugSummary } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState, ErrorState } from '@/components/ui/states';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm';
import { FilterMenu } from '@/components/FilterMenu';
import { LabelChip, PriorityBadge, SeverityBadge, StatusBadge, bugRef } from '@/components/badges';
import { StatusIcon } from '@/components/icons';
import { useApp } from '@/store/app';
import { useBugs, useInvalidateBugs, useProjects, useUsers } from '@/hooks/useData';
import { useDebounce } from '@/hooks/useDebounce';
import { downloadCsv, formatDate, isOverdue, timeAgoShort } from '@/utils/format';
import { cn } from '@/utils/cn';

/** Column widths shared by header and rows so they stay aligned. */
const W = {
  pri: 'w-4 xl:w-[78px]',
  id: 'w-[76px]',
  status: 'w-[112px] hidden md:flex',
  sev: 'w-[74px] hidden lg:flex',
  proj: 'w-[118px] hidden lg:flex',
  asg: 'w-5 xl:w-[128px] hidden md:flex',
  rep: 'w-5 hidden xl:flex',
  created: 'w-[78px] hidden xl:block text-right',
  upd: 'w-[78px] hidden md:block text-right',
};

const SORTS = [
  { value: 'created_at', label: 'Created' }, { value: 'updated_at', label: 'Updated' }, { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' }, { value: 'severity', label: 'Severity' }, { value: 'title', label: 'Title' }, { value: 'id', label: 'ID' },
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

  const list = (k: string) => (sp.get(k) ?? '').split(',').filter(Boolean);
  const filters: BugFilters = {
    search: sp.get('search') ?? '',
    status: sp.get('status') ?? '',
    priority: sp.get('priority') ?? '',
    severity: sp.get('severity') ?? '',
    project_id: sp.get('project_id') ?? '',
    assignee_id: sp.get('assignee_id') ?? '',
    orderby: sp.get('orderby') ?? 'updated_at',
    order: sp.get('order') === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Number(sp.get('page')) || 1),
    per_page: Number(sp.get('per_page')) || undefined,
  };
  const groupByStatus = sp.get('group') === 'status';
  const patch = (p: Record<string, string | number | undefined>, keepPage = false) =>
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(p)) (v === undefined || v === '' ? next.delete(k) : next.set(k, String(v)));
      if (!keepPage) next.delete('page');
      return next;
    }, { replace: true });

  const [searchText, setSearchText] = useState(filters.search ?? '');
  const debounced = useDebounce(searchText, 300);
  useEffect(() => { setSearchText(sp.get('search') ?? ''); }, [sp.get('search')]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (debounced !== (sp.get('search') ?? '')) patch({ search: debounced }); }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = useBugs(filters);
  const items = q.data?.items ?? [];
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  useEffect(() => { setSelected(new Set()); }, [q.data?.page, sp.toString()]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusOpts = useMemo(() => (settings?.statuses ?? []).map((s) => ({ value: s.slug, text: s.label, label: <><StatusIcon category={s.category} color={s.color} />{s.label}</> })), [settings]);
  const prioOpts = useMemo(() => (settings?.priorities ?? []).map((s) => ({ value: s.slug, text: s.label, label: <PriorityBadge slug={s.slug} /> })), [settings]);
  const sevOpts = useMemo(() => (settings?.severities ?? []).map((s) => ({ value: s.slug, text: s.label, label: s.label })), [settings]);
  const projectOpts = (projects.data ?? []).map((p) => ({ value: String(p.id), text: p.name, label: <><span className="h-2 w-2 rounded-[3px]" style={{ background: p.color }} />{p.name}</> }));
  const assigneeOpts = [{ value: 'me', text: 'Me', label: 'Assigned to me' }, { value: 'unassigned', text: 'Unassigned', label: 'Unassigned' }, ...(users.data?.items ?? []).map((u) => ({ value: String(u.id), text: u.name, label: <><Avatar user={u} size={16} />{u.name}</> }))];

  // Quick views
  const slugsOf = (cats: string[]) => (settings?.statuses ?? []).filter((s) => cats.includes(s.category)).map((s) => s.slug).join(',');
  const topPriority = settings?.priorities[settings.priorities.length - 1]?.slug ?? '';
  const views = [
    { key: 'all', label: 'All', p: { status: '', priority: '', assignee_id: '' } },
    { key: 'open', label: 'Active', p: { status: slugsOf(['open', 'in_progress']), priority: '', assignee_id: '' } },
    { key: 'mine', label: 'Mine', p: { status: '', priority: '', assignee_id: 'me' } },
    { key: 'critical', label: 'Urgent', p: { status: slugsOf(['open', 'in_progress']), priority: topPriority, assignee_id: '' } },
    { key: 'unassigned', label: 'Unassigned', p: { status: '', priority: '', assignee_id: 'unassigned' } },
    { key: 'done', label: 'Done', p: { status: slugsOf(['resolved', 'closed']), priority: '', assignee_id: '' } },
  ];
  const activeView = views.find((v) => (v.p.status || '') === (filters.status || '') && (v.p.priority || '') === (filters.priority || '') && (v.p.assignee_id || '') === (filters.assignee_id || ''))?.key;

  const hasFilters = !!(filters.search || filters.status || filters.priority || filters.severity || filters.project_id || filters.assignee_id);
  const allSelected = items.length > 0 && items.every((b) => selected.has(b.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((b) => b.id)));
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sortBy = (col: string) => patch({ orderby: col, order: filters.orderby === col && filters.order === 'asc' ? 'desc' : 'asc' }, true);

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
    if (action === 'delete' && !(await confirm({ title: `Delete ${ids.length} bug${ids.length === 1 ? '' : 's'}?`, description: 'This permanently removes the bugs together with their comments and attachments.', confirmLabel: 'Delete', destructive: true }))) return;
    bulk.mutate({ ids, action, value });
  };

  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await BugsApi.list({ ...filters, page: 1, export: 1, per_page: 5000 });
      const label = (l: { slug: string; label: string }[] | undefined, s: string) => l?.find((i) => i.slug === s)?.label ?? s;
      downloadCsv(`bugs-${new Date().toISOString().slice(0, 10)}.csv`, [
        ['ID', 'Title', 'Status', 'Priority', 'Severity', 'Project', 'Component', 'Version', 'Assignee', 'Reporter', 'Due date', 'Created', 'Updated'],
        ...all.items.map((b) => [bugRef(b), b.title, label(settings?.statuses, b.status), label(settings?.priorities, b.priority), label(settings?.severities, b.severity), b.project?.name ?? '', b.component, b.version, b.assignee?.name ?? '', b.reporter?.name ?? '', b.due_date ?? '', b.created_at, b.updated_at]),
      ]);
      toast.success(`Exported ${all.items.length} bugs`);
    } catch (e) { toast.error('Export failed', (e as Error).message); } finally { setExporting(false); }
  };

  const remove = async (b: BugSummary) => {
    if (!(await confirm({ title: `Delete ${bugRef(b)}?`, description: `“${b.title}” and its comments and attachments will be permanently deleted.`, confirmLabel: 'Delete', destructive: true }))) return;
    bulk.mutate({ ids: [b.id], action: 'delete' });
  };

  const canEdit = can('edit_bug');
  const sortIcon = (col: string) => filters.orderby === col ? (filters.order === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null;
  const Th = ({ col, label, className }: { col: string; label: string; className: string }) => (
    <button className={cn('items-center gap-1 text-left hover:text-foreground', filters.orderby === col && 'text-foreground', className)} onClick={() => sortBy(col)} aria-sort={filters.orderby === col ? (filters.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      {label}{sortIcon(col)}
    </button>
  );

  const Row = ({ b }: { b: BugSummary }) => {
    const done = settings?.statuses.find((s) => s.slug === b.status)?.category;
    const finished = done === 'resolved' || done === 'closed';
    const overdue = !finished && isOverdue(b.due_date);
    return (
      <div
        role="row"
        onClick={(e) => { if (!(e.target as HTMLElement).closest('button,a,[role=checkbox],[role=menuitem]')) nav(`/bugs/${b.id}`); }}
        className={cn('group flex cursor-pointer flex-wrap items-center gap-x-2.5 border-b border-border/70 px-3 py-1.5 hover:bg-muted/60 md:h-[34px] md:flex-nowrap md:py-0', selected.has(b.id) && 'bg-primary/[0.06] hover:bg-primary/[0.08]', q.isPlaceholderData && 'opacity-60')}
      >
        <div className="flex w-4 shrink-0"><Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggle(b.id)} aria-label={`Select ${bugRef(b)}`} /></div>
        <div className={cn('flex shrink-0 items-center', W.pri)}><PriorityBadge slug={b.priority} collapse /></div>
        <div className={cn('shrink-0 tabular-nums text-xs text-muted-foreground', W.id)}>{bugRef(b)}</div>
        <div className={cn('shrink-0 items-center', W.status)}><StatusBadge slug={b.status} /></div>
        <div className="flex min-w-0 flex-1 basis-0 items-center gap-2 max-md:basis-[calc(100%-120px)]">
          <Link to={`/bugs/${b.id}`} className={cn('truncate text-[13px] hover:text-primary', finished && 'text-muted-foreground')}>{b.title}</Link>
          <span className="hidden shrink-0 items-center gap-1.5 lg:flex">
            {b.component && <LabelChip>{b.component}</LabelChip>}
            {b.version && <LabelChip>v{b.version}</LabelChip>}
            {overdue && <span className="text-[11px] font-medium text-destructive" title={`Due ${b.due_date}`}>Overdue</span>}
          </span>
          {(b.comment_count > 0 || b.attachment_count > 0) && (
            <span className="hidden shrink-0 items-center gap-2 text-[11px] text-muted-foreground sm:flex">
              {b.comment_count > 0 && <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{b.comment_count}</span>}
              {b.attachment_count > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{b.attachment_count}</span>}
            </span>
          )}
        </div>
        <div className={cn('shrink-0 items-center', W.sev)}><SeverityBadge slug={b.severity} /></div>
        <div className={cn('shrink-0 items-center truncate text-[12.5px]', W.proj)}>
          {b.project && <span className="inline-flex min-w-0 items-center gap-1.5" title={b.project.name}><span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: b.project.color }} /><span className="truncate">{b.project.name}</span></span>}
        </div>
        <div className={cn('shrink-0 items-center gap-1.5 text-[12.5px]', W.asg)} title={b.assignee?.name ?? 'Unassigned'}>
          {b.assignee ? <><Avatar user={b.assignee} size={18} /><span className="hidden truncate xl:inline">{b.assignee.name}</span></> : <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-dashed border-muted-foreground/50 text-muted-foreground/60" />}
          {!b.assignee && <span className="hidden text-muted-foreground xl:inline">Unassigned</span>}
        </div>
        <div className={cn('shrink-0 items-center', W.rep)} title={`Reporter: ${b.reporter?.name ?? 'unknown'}`}><Avatar user={b.reporter} size={18} /></div>
        <div className={cn('shrink-0 text-xs text-muted-foreground', W.created)} title={b.created_at}>{formatDate(b.created_at).replace(/, \d{4}$/, '')}</div>
        <div className={cn('shrink-0 text-xs text-muted-foreground', W.upd)}>{timeAgoShort(b.updated_at)}</div>
        <div className="ml-auto shrink-0 md:ml-0">
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100" aria-label={`Actions for ${bugRef(b)}`}><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => nav(`/bugs/${b.id}`)}><Bug className="h-3.5 w-3.5" />Open</DropdownMenuItem>
              {canEdit && <DropdownMenuItem onSelect={() => nav(`/bugs/${b.id}/edit`)}><Pencil className="h-3.5 w-3.5" />Edit</DropdownMenuItem>}
              {canEdit && (<>
                <DropdownMenuSeparator />
                <DropdownMenuSub><DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger><DropdownMenuSubContent>
                  {statusOpts.map((o) => <DropdownMenuItem key={o.value} disabled={o.value === b.status} onSelect={() => runBulk([b.id], 'status', o.value)}>{o.label}</DropdownMenuItem>)}
                </DropdownMenuSubContent></DropdownMenuSub>
                <DropdownMenuSub><DropdownMenuSubTrigger>Priority</DropdownMenuSubTrigger><DropdownMenuSubContent>
                  {prioOpts.map((o) => <DropdownMenuItem key={o.value} disabled={o.value === b.priority} onSelect={() => runBulk([b.id], 'priority', o.value)}>{o.label}</DropdownMenuItem>)}
                </DropdownMenuSubContent></DropdownMenuSub>
                <DropdownMenuSub><DropdownMenuSubTrigger>Assign to</DropdownMenuSubTrigger><DropdownMenuSubContent className="max-h-72">
                  <DropdownMenuItem onSelect={() => runBulk([b.id], 'assign', 0)}>Unassigned</DropdownMenuItem>
                  {(users.data?.items ?? []).map((u) => <DropdownMenuItem key={u.id} disabled={u.id === b.assignee?.id} onSelect={() => runBulk([b.id], 'assign', u.id)}><Avatar user={u} size={16} />{u.name}</DropdownMenuItem>)}
                </DropdownMenuSubContent></DropdownMenuSub>
              </>)}
              {can('delete_bug') && (<><DropdownMenuSeparator /><DropdownMenuItem destructive onSelect={() => remove(b)}><Trash2 className="h-3.5 w-3.5" />Delete</DropdownMenuItem></>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* mobile meta line */}
        <div className="flex w-full items-center gap-3 pl-6 pt-0.5 text-xs text-muted-foreground md:hidden">
          <StatusBadge slug={b.status} className="text-xs" />
          {b.project && <span className="truncate">{b.project.name}</span>}
          <span className="ml-auto flex items-center gap-2">{b.assignee && <Avatar user={b.assignee} size={16} />}{timeAgoShort(b.updated_at)}</span>
        </div>
      </div>
    );
  };

  const groups = useMemo(() => {
    if (!groupByStatus) return null;
    return (settings?.statuses ?? []).map((s) => ({ s, rows: items.filter((b) => b.status === s.slug) })).filter((g) => g.rows.length);
  }, [groupByStatus, items, settings]);

  return (
    <>
      <PageHeader title="Bugs" crumbs={[{ label: 'Bugs' }]}
        actions={<Button variant="ghost" size="icon" onClick={exportCsv} loading={exporting} aria-label="Export CSV" title="Export CSV"><Download className="h-4 w-4" /></Button>} />

      {/* toolbar */}
      <div className="sticky top-11 z-10 border-b border-border bg-background">
        {selected.size > 0 && canEdit ? (
          <div className="flex flex-wrap items-center gap-2 bg-primary/[0.06] px-3 py-1.5">
            <Checkbox checked="indeterminate" onCheckedChange={() => setSelected(new Set())} aria-label="Clear selection" />
            <span className="text-[13px] font-medium">{selected.size} selected</span>
            <div className="w-32"><Select ghost aria-label="Bulk set status" value="" onChange={(v) => v && runBulk([...selected], 'status', v)} options={(settings?.statuses ?? []).map((s) => ({ value: s.slug, label: s.label }))} placeholder="Status…" disabled={bulk.isPending} className="border border-input bg-background" /></div>
            <div className="w-32"><Select ghost aria-label="Bulk set priority" value="" onChange={(v) => v && runBulk([...selected], 'priority', v)} options={(settings?.priorities ?? []).map((s) => ({ value: s.slug, label: s.label }))} placeholder="Priority…" disabled={bulk.isPending} className="border border-input bg-background" /></div>
            <div className="w-40"><Select ghost aria-label="Bulk assign" value="" onChange={(v) => v && runBulk([...selected], 'assign', Number(v))} options={[{ value: '0', label: 'Unassign' }, ...(users.data?.items ?? []).map((u) => ({ value: String(u.id), label: u.name }))]} placeholder="Assign…" disabled={bulk.isPending} className="border border-input bg-background" /></div>
            {can('delete_bug') && <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => runBulk([...selected], 'delete')} disabled={bulk.isPending}><Trash2 className="h-3.5 w-3.5" />Delete</Button>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5">
            <div className="flex items-center rounded-md bg-muted p-0.5" role="tablist" aria-label="Views">
              {views.map((v) => (
                <button key={v.key} role="tab" aria-selected={activeView === v.key} onClick={() => patch(v.p)}
                  className={cn('h-6 rounded px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground', activeView === v.key && 'bg-background text-foreground shadow-sm')}>{v.label}</button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-[7px] h-3.5 w-3.5 text-muted-foreground" />
              <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Filter by title or #id" aria-label="Search bugs"
                className="h-7 w-44 rounded-md border border-input bg-background pl-7 pr-2 text-xs placeholder:text-muted-foreground hover:border-muted-foreground/40 focus:border-ring focus:ring-2 focus:ring-ring/25 sm:w-52" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterMenu label="Status" options={statusOpts} value={list('status')} onChange={(v) => patch({ status: v.join(',') })} />
              <FilterMenu label="Priority" options={prioOpts} value={list('priority')} onChange={(v) => patch({ priority: v.join(',') })} />
              <FilterMenu label="Severity" options={sevOpts} value={list('severity')} onChange={(v) => patch({ severity: v.join(',') })} />
              <FilterMenu label="Project" options={projectOpts} value={list('project_id')} onChange={(v) => patch({ project_id: v.join(',') })} />
              <FilterMenu label="Assignee" multi={false} options={assigneeOpts} value={list('assignee_id')} onChange={(v) => patch({ assignee_id: v[0] ?? '' })} />
              {hasFilters && <button className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => { setSearchText(''); setSp(groupByStatus ? { group: 'status' } : {}, { replace: true }); }}><X className="h-3 w-3" />Clear</button>}
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-28 md:hidden"><Select aria-label="Sort by" value={filters.orderby ?? 'updated_at'} onChange={(v) => patch({ orderby: v, order: 'desc' }, true)} options={SORTS} className="h-7 text-xs" /></div>
              <Button variant={groupByStatus ? 'secondary' : 'ghost'} size="sm" onClick={() => patch({ group: groupByStatus ? '' : 'status' }, true)} aria-pressed={groupByStatus} title="Group by status"><Layers className="h-3.5 w-3.5" /><span className="hidden sm:inline">Group</span></Button>
            </div>
          </div>
        )}
        {/* column header */}
        <div role="row" className="hidden h-7 items-center gap-x-2.5 border-t border-border/70 bg-muted/40 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:flex">
          <div className="w-4 shrink-0"><Checkbox checked={allSelected ? true : selected.size > 0 ? 'indeterminate' : false} onCheckedChange={toggleAll} aria-label="Select all" disabled={!items.length} /></div>
          <Th col="priority" label="Priority" className={cn('flex shrink-0', W.pri, 'overflow-hidden')} />
          <Th col="id" label="ID" className={cn('flex shrink-0', W.id)} />
          <Th col="status" label="Status" className={cn('shrink-0', W.status)} />
          <Th col="title" label="Title" className="flex min-w-0 flex-1 basis-0" />
          <Th col="severity" label="Severity" className={cn('shrink-0', W.sev)} />
          <Th col="project" label="Project" className={cn('shrink-0', W.proj)} />
          <Th col="assignee" label="Assignee" className={cn('shrink-0 overflow-hidden', W.asg)} />
          <Th col="reporter" label="By" className={cn('shrink-0', W.rep)} />
          <Th col="created_at" label="Created" className={cn('shrink-0 !flex justify-end', W.created)} />
          <Th col="updated_at" label="Updated" className={cn('shrink-0 !flex justify-end', W.upd)} />
          <div className="w-6 shrink-0" />
        </div>
      </div>

      {/* list */}
      <div role="table" aria-label="Bugs" className="min-h-[200px]">
        {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
          : q.isLoading ? Array.from({ length: 12 }).map((_, i) => <div key={i} className="flex h-[34px] items-center gap-3 border-b border-border/70 px-3"><div className="h-3 w-3 animate-pulse rounded bg-muted" /><div className="h-3 w-16 animate-pulse rounded bg-muted" /><div className="h-3 flex-1 animate-pulse rounded bg-muted" style={{ maxWidth: `${40 + ((i * 17) % 40)}%` }} /></div>)
          : items.length === 0 ? (
            <EmptyState title={hasFilters ? 'No bugs match these filters' : 'No bugs yet'} description={hasFilters ? 'Try removing a filter or switching view.' : 'Report the first bug to get started. Press C anywhere to create one.'}
              action={hasFilters ? <Button variant="outline" size="sm" onClick={() => { setSearchText(''); setSp({}, { replace: true }); }}>Clear filters</Button> : can('create_bug') ? <Button size="sm" onClick={() => nav('/bugs/new')}><Plus className="h-3.5 w-3.5" />New bug</Button> : undefined} />
          ) : groups ? groups.map(({ s, rows }) => (
            <div key={s.slug}>
              <button className="flex h-7 w-full items-center gap-2 border-b border-border/70 bg-muted/50 px-3 text-xs font-medium hover:bg-muted" onClick={() => setCollapsed((c) => { const n = new Set(c); n.has(s.slug) ? n.delete(s.slug) : n.add(s.slug); return n; })} aria-expanded={!collapsed.has(s.slug)}>
                {collapsed.has(s.slug) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                <StatusIcon category={s.category} color={s.color} />{s.label}<span className="font-normal text-muted-foreground">{rows.length}</span>
              </button>
              {!collapsed.has(s.slug) && rows.map((b) => <Row key={b.id} b={b} />)}
            </div>
          )) : items.map((b) => <Row key={b.id} b={b} />)}
      </div>

      {q.data && q.data.total > 0 && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
          <span><span className="tabular-nums text-foreground">{q.data.total}</span> bug{q.data.total === 1 ? '' : 's'}{q.data.total_pages > 1 && ` · page ${q.data.page} of ${q.data.total_pages}`}</span>
          <div className="flex items-center gap-1.5">
            <div className="w-[108px]"><Select aria-label="Rows per page" value={String(q.data.per_page ?? 50)} onChange={(v) => patch({ per_page: v })} options={[25, 50, 100].map((n) => ({ value: String(n), label: `${n} / page` }))} className="h-7 text-xs" /></div>
            <Button variant="outline" size="sm" disabled={q.data.page <= 1} onClick={() => patch({ page: q.data!.page - 1 }, true)}>Prev</Button>
            <Button variant="outline" size="sm" disabled={q.data.page >= q.data.total_pages} onClick={() => patch({ page: q.data!.page + 1 }, true)}>Next</Button>
          </div>
        </div>
      )}
    </>
  );
}
