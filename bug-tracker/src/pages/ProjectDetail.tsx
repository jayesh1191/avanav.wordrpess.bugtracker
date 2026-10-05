import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, UserMinus } from 'lucide-react';
import { ProjectsApi } from '@/api/endpoints';
import { ApiError } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm';
import { ProjectDialog } from '@/components/ProjectDialog';
import { PriorityBadge, StatusBadge, UserChip } from '@/components/badges';
import { CategoryBars } from '@/components/charts';
import { useApp } from '@/store/app';
import { useBugs, useInvalidateBugs, useProject, useUsers } from '@/hooks/useData';
import { formatDate, timeAgo } from '@/utils/format';

export default function ProjectDetail() {
  const id = Number(useParams().id) || 0;
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const invalidate = useInvalidateBugs();
  const { can } = useApp();
  const qc = useQueryClient();
  const [gone, setGone] = useState(false);
  const q = useProject(gone ? 0 : id);
  const bugs = useBugs({ project_id: String(id), per_page: 10, orderby: 'updated_at', order: 'desc' });
  const users = useUsers();
  const [editing, setEditing] = useState(false);
  const [toAdd, setToAdd] = useState('');
  const manage = can('manage_projects');

  const setMembers = useMutation({
    mutationFn: (members: { user_id: number; role: string }[]) => ProjectsApi.update(id, { members }),
    onSuccess: () => { invalidate(); setToAdd(''); toast.success('Members updated'); },
    onError: (e: Error) => toast.error('Could not update members', e.message),
  });

  if (q.isError) return <><PageHeader title="Project" crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Not found' }]} /><Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card></>;
  if (q.isLoading || !q.data) return <><PageHeader title="Loading…" crumbs={[{ label: 'Projects', to: '/projects' }]} /><Skeleton className="h-80" /></>;
  const p = q.data;
  const memberIds = new Set(p.members.map((m) => m.user.id));
  const asList = (members = p.members) => members.map((m) => ({ user_id: m.user.id, role: m.role }));

  const onDelete = async () => {
    const n = p.stats.total;
    if (!(await confirm({ title: `Delete “${p.name}”?`, description: n ? `This also permanently deletes its ${n} bug${n === 1 ? '' : 's'}, comments and attachments.` : 'This cannot be undone.', confirmLabel: 'Delete project', destructive: true }))) return;
    try { await ProjectsApi.remove(p.id, true); setGone(true); qc.removeQueries({ queryKey: ['project', p.id], exact: true }); invalidate(); toast.success('Project deleted'); nav('/projects', { replace: true }); }
    catch (e) { toast.error('Could not delete project', e instanceof ApiError ? e.message : 'Unknown error'); }
  };

  const stat = (label: string, v: number) => <Card className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{v}</div></Card>;

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Projects', to: '/projects' }, { label: p.name }]}
        title={<span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 rounded" style={{ background: p.color }} />{p.name}{p.key && <Badge>{p.key}</Badge>}{p.status === 'archived' && <Badge>Archived</Badge>}</span>}
        description={p.description}
        actions={<>
          {can('create_bug') && <Button asChild variant="outline"><Link to={`/bugs/new?project_id=${p.id}`}><Plus className="h-4 w-4" />New bug</Link></Button>}
          {manage && <><Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" />Edit</Button><Button variant="outline" className="text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" />Delete</Button></>}
        </>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {stat('Total', p.stats.total)}{stat('Open', p.stats.open)}{stat('In progress', p.stats.in_progress)}{stat('Resolved', p.stats.resolved)}{stat('Closed', p.stats.closed)}
      </div>

      <Tabs defaultValue="bugs">
        <TabsList>
          <TabsTrigger value="bugs">Bugs</TabsTrigger>
          <TabsTrigger value="members">Members ({p.members.length})</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="bugs">
          <Card>
            {bugs.isLoading ? <CardContent><Skeleton className="h-32" /></CardContent>
              : bugs.isError ? <ErrorState error={bugs.error} onRetry={() => bugs.refetch()} />
              : bugs.data && bugs.data.items.length === 0 ? <EmptyState title="No bugs in this project" description="Reported bugs will appear here." action={can('create_bug') ? <Button asChild size="sm"><Link to={`/bugs/new?project_id=${p.id}`}>Report a bug</Link></Button> : undefined} />
              : <>
                <ul className="divide-y divide-border">
                  {bugs.data?.items.map((b) => (
                    <li key={b.id}><Link to={`/bugs/${b.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted/60">
                      <span className="text-xs tabular-nums text-muted-foreground">#{b.id}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{b.title}</span>
                      <PriorityBadge slug={b.priority} /><StatusBadge slug={b.status} /><UserChip user={b.assignee} size={20} />
                      <span className="text-xs text-muted-foreground">{timeAgo(b.updated_at)}</span>
                    </Link></li>
                  ))}
                </ul>
                <div className="border-t border-border p-3 text-center"><Button asChild variant="link" size="sm"><Link to={`/bugs?project_id=${p.id}`}>View all {bugs.data?.total} bugs</Link></Button></div>
              </>}
          </Card>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            {manage && (
              <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
                <div className="w-64"><Select aria-label="Add member" value={toAdd} onChange={setToAdd} placeholder="Add a member…" options={(users.data?.items ?? []).filter((u) => !memberIds.has(u.id)).map((u) => ({ value: String(u.id), label: u.name }))} /></div>
                <Button size="sm" disabled={!toAdd} loading={setMembers.isPending} onClick={() => setMembers.mutate([...asList(), { user_id: Number(toAdd), role: 'member' }])}><Plus className="h-4 w-4" />Add</Button>
              </div>
            )}
            {p.members.length === 0 ? <EmptyState title="No members yet" description={manage ? 'Add people who should see this project’s bugs.' : undefined} /> : (
              <ul className="divide-y divide-border">
                {p.members.map((m) => (
                  <li key={m.user.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar user={m.user} size={32} />
                    <div className="min-w-0 flex-1"><div className="truncate font-medium">{m.user.name}</div><div className="text-xs text-muted-foreground">@{m.user.login}</div></div>
                    {p.lead?.id === m.user.id && <Badge>Lead</Badge>}
                    {manage && p.lead?.id !== m.user.id && (
                      <Button variant="ghost" size="icon" aria-label={`Remove ${m.user.name}`} disabled={setMembers.isPending} onClick={() => setMembers.mutate(asList(p.members.filter((x) => x.user.id !== m.user.id)))}><UserMinus className="h-4 w-4" /></Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>Bugs by status</CardTitle></CardHeader><CardContent>
              <CategoryBars height={220} data={[
                { key: 'open', label: 'Open', color: '#3b82f6', count: p.stats.open }, { key: 'in_progress', label: 'In progress', color: '#f59e0b', count: p.stats.in_progress },
                { key: 'resolved', label: 'Resolved', color: '#10b981', count: p.stats.resolved }, { key: 'closed', label: 'Closed', color: '#6b7280', count: p.stats.closed },
              ]} />
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Details</CardTitle></CardHeader><CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Lead</dt><dd><UserChip user={p.lead} empty="No lead" /></dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd className="capitalize">{p.status}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Created</dt><dd>{formatDate(p.created_at)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Last updated</dt><dd>{formatDate(p.updated_at)}</dd></div>
              </dl>
            </CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
      {editing && <ProjectDialog open={editing} onOpenChange={setEditing} project={p} />}
    </>
  );
}
