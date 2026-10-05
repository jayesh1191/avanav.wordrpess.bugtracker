import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { ProjectDialog } from '@/components/ProjectDialog';
import { useApp } from '@/store/app';
import { useProjects } from '@/hooks/useData';
import { useDebounce } from '@/hooks/useDebounce';
import type { Project } from '@/types';

export function ProjectCard({ p }: { p: Project }) {
  const done = p.stats.resolved + p.stats.closed;
  const pct = p.stats.total ? Math.round((done / p.stats.total) * 100) : 0;
  return (
    <Link to={`/projects/${p.id}`} className="block rounded-lg focus-visible:outline-2">
      <Card className="h-full p-4 transition-shadow hover:shadow-md">
        <div className="flex items-start gap-3">
          <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ background: p.color }} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><h3 className="truncate font-semibold">{p.name}</h3>{p.key && <Badge>{p.key}</Badge>}{p.status === 'archived' && <Badge>Archived</Badge>}</div>
            <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{p.description || 'No description'}</p>
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{p.stats.total} bugs · {p.stats.open + p.stats.in_progress} active</span><span>{pct}% done</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Resolved share"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex -space-x-2">{p.members.slice(0, 5).map((m) => <Avatar key={m.user.id} user={m.user} size={24} className="ring-2 ring-card" />)}</div>
          <span className="text-xs text-muted-foreground">{p.members.length} member{p.members.length === 1 ? '' : 's'}</span>
        </div>
      </Card>
    </Link>
  );
}

export default function Projects() {
  const { can } = useApp();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [open, setOpen] = useState(false);
  const q = useProjects({ search: useDebounce(search), status });
  const manage = can('manage_projects');

  return (
    <>
      <PageHeader title="Projects" crumbs={[{ label: 'Projects' }]} description="Group bugs by product, site or team."
        actions={manage && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New project</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search projects" /></div>
        <div className="w-40"><Select aria-label="Project status" value={status} onChange={setStatus} options={[{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]} emptyLabel="All projects" /></div>
      </div>
      {q.isError ? <Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>
        : q.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
        : q.data && q.data.length === 0 ? <Card><EmptyState icon={<FolderKanban className="h-6 w-6" />} title="No projects found" description={manage ? 'Create a project to start tracking bugs.' : 'You are not a member of any project yet. Ask a project manager to add you.'} action={manage ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New project</Button> : undefined} /></Card>
        : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{q.data?.map((p) => <ProjectCard key={p.id} p={p} />)}</div>}
      {open && <ProjectDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}
