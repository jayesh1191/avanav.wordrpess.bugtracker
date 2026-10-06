import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderKanban, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { ProjectDialog } from '@/components/ProjectDialog';
import { LabelChip } from '@/components/badges';
import { useApp } from '@/store/app';
import { useProjects } from '@/hooks/useData';
import { useDebounce } from '@/hooks/useDebounce';

export default function Projects() {
  const { can } = useApp();
  const nav = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [open, setOpen] = useState(false);
  const q = useProjects({ search: useDebounce(search), status });
  const manage = can('manage_projects');

  return (
    <div>
      <PageHeader title="Projects" crumbs={[{ label: 'Projects' }]} actions={manage && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" />New project</Button>} />
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5">
        <div className="relative"><Search className="pointer-events-none absolute left-2 top-[7px] h-3.5 w-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter projects" aria-label="Search projects" className="h-7 w-52 rounded-md border border-input bg-background pl-7 pr-2 text-xs focus:border-ring focus:ring-2 focus:ring-ring/25" /></div>
        <div className="w-32"><Select aria-label="Project status" value={status} onChange={setStatus} options={[{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]} emptyLabel="All" className="h-7 text-xs" /></div>
      </div>
      <div className="hidden h-7 items-center gap-3 border-b border-border/70 bg-muted/40 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:flex">
        <span className="flex-1">Project</span><span className="w-24">Lead</span><span className="w-24">Members</span><span className="w-56">Progress</span><span className="w-14 text-right">Active</span><span className="w-14 text-right">Total</span>
      </div>
      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
        : q.isLoading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="m-2 h-8" />)
        : q.data && q.data.length === 0 ? <EmptyState icon={<FolderKanban className="h-5 w-5" />} title="No projects found" description={manage ? 'Create a project to start tracking bugs.' : 'You are not a member of any project yet. Ask a project manager to add you.'} action={manage ? <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" />New project</Button> : undefined} />
        : q.data?.map((p) => {
          const done = p.stats.resolved + p.stats.closed;
          const pct = p.stats.total ? Math.round((done / p.stats.total) * 100) : 0;
          return (
            <div key={p.id} role="link" tabIndex={0} onClick={() => nav(`/projects/${p.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/projects/${p.id}`)}
              className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/70 px-3 py-2 hover:bg-muted/60 md:h-11 md:flex-nowrap md:py-0">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} />
                <Link to={`/projects/${p.id}`} className="truncate font-medium hover:text-primary">{p.name}</Link>
                {p.key && <LabelChip>{p.key}</LabelChip>}{p.status === 'archived' && <LabelChip>Archived</LabelChip>}
                <span className="hidden truncate text-xs text-muted-foreground lg:inline">{p.description}</span>
              </div>
              <div className="flex w-24 items-center gap-1.5 text-[12.5px]">{p.lead ? <><Avatar user={p.lead} size={18} /><span className="truncate">{p.lead.name}</span></> : <span className="text-muted-foreground">—</span>}</div>
              <div className="flex w-24 -space-x-1.5">{p.members.slice(0, 4).map((m) => <Avatar key={m.user.id} user={m.user} size={18} className="ring-2 ring-background" />)}{p.members.length > 4 && <span className="pl-2.5 text-xs text-muted-foreground">+{p.members.length - 4}</span>}</div>
              <div className="flex w-56 items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name} resolved`}><div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} /></div><span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span></div>
              <span className="w-14 text-right tabular-nums">{p.stats.open + p.stats.in_progress}</span>
              <span className="w-14 text-right tabular-nums text-muted-foreground">{p.stats.total}</span>
            </div>
          );
        })}
      {open && <ProjectDialog open={open} onOpenChange={setOpen} />}
    </div>
  );
}
