import { useEffect, useState } from 'react';
import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query';
import { ChevronRight, MoreHorizontal, Pencil, Plus, RotateCcw, Search, ShieldCheck, Trash2, UserCheck, UserX, Users as UsersIcon } from 'lucide-react';
import { TrackerUsersApi } from '@/api/endpoints';
import type { Project, TrackerUser } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm';
import { useProjects } from '@/hooks/useData';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/utils/cn';
import { formatDate, formatDateTime } from '@/utils/format';
import { AddUserDialog, EditUserDialog, PermissionBoxes, useRefreshUsers } from './UserDialogs';

const STATUS: Record<string, { label: string; dot: string }> = {
  active: { label: 'Active', dot: 'bg-success' },
  inactive: { label: 'Inactive', dot: 'bg-warning' },
  removed: { label: 'Removed', dot: 'bg-muted-foreground/40' },
};
const StatusPill = ({ status }: { status: string }) => (
  <span className="inline-flex items-center gap-1.5 text-xs"><span className={cn('h-1.5 w-1.5 rounded-full', STATUS[status]?.dot)} />{STATUS[status]?.label ?? status}</span>
);

function ProjectAccess({ user, projects }: { user: TrackerUser; projects: Project[] }) {
  const toast = useToast();
  const refresh = useRefreshUsers();
  const set = useMutation({
    mutationFn: (v: { pid: number; granted: boolean; role?: 'member' | 'maintainer' }) => TrackerUsersApi.setProject(user.id, v.pid, v.granted, v.role),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error('Could not update access', e.message),
  });
  const by = new Map(user.projects.map((p) => [p.project_id, p.role]));
  const locked = user.status === 'removed';
  if (projects.length === 0) return <p className="text-xs text-muted-foreground">There are no projects yet.</p>;
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {projects.map((p) => {
        const role = by.get(p.id);
        const granted = role !== undefined;
        return (
          <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-2.5 py-1.5">
            <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: p.color }} />
            <span className="min-w-0 flex-1 truncate text-[13px] max-sm:basis-full">{p.name}{p.status === 'archived' && <span className="ml-1.5 text-xs text-muted-foreground">(archived)</span>}</span>
            <span className={cn('inline-flex items-center gap-1 text-xs', granted ? 'text-success' : 'text-muted-foreground')}>
              <span className={cn('h-1.5 w-1.5 rounded-full', granted ? 'bg-success' : 'bg-muted-foreground/40')} />{granted ? 'Has access' : 'No access'}
            </span>
            {granted && (
              <div className="w-[108px]"><Select ghost aria-label={`Role in ${p.name}`} value={role!} disabled={locked || set.isPending} onChange={(v) => set.mutate({ pid: p.id, granted: true, role: v as 'member' | 'maintainer' })}
                options={[{ value: 'member', label: 'Member' }, { value: 'maintainer', label: 'Maintainer' }]} className="h-6 text-xs" /></div>
            )}
            <Button size="sm" variant={granted ? 'ghost' : 'outline'} className={cn('w-[74px]', granted && 'text-destructive hover:bg-destructive/10 hover:text-destructive')} disabled={locked || set.isPending}
              aria-label={`${granted ? 'Remove' : 'Assign'} ${user.name} ${granted ? 'from' : 'to'} ${p.name}`} onClick={() => set.mutate({ pid: p.id, granted: !granted })}>{granted ? 'Remove' : 'Assign'}</Button>
          </li>
        );
      })}
    </ul>
  );
}

function Row({ u, expanded, onToggle, projects, permissionKeys, onEdit, onStatus, onRemove, onRestore, busy }: {
  u: TrackerUser; expanded: boolean; onToggle: () => void; projects: Project[]; permissionKeys: Record<string, string>;
  onEdit: () => void; onStatus: (s: 'active' | 'inactive') => void; onRemove: () => void; onRestore: () => void; busy: boolean;
}) {
  const toast = useToast();
  const refresh = useRefreshUsers();
  const [perms, setPerms] = useState(u.permissions);
  useEffect(() => setPerms(u.permissions), [u.permissions]);
  const dirty = perms.slice().sort().join() !== u.permissions.slice().sort().join();
  const savePerms = useMutation({
    mutationFn: () => TrackerUsersApi.update(u.id, { permissions: perms }),
    onSuccess: () => { refresh(); toast.success('Permissions saved'); },
    onError: (e: Error) => toast.error('Could not save permissions', e.message),
  });
  const panelId = `user-panel-${u.id}`;
  const removed = u.status === 'removed';
  return (
    <div role="listitem" className={cn('border-b border-border/70', expanded && 'bg-muted/30')}>
      <div className="flex items-center gap-1 pr-2">
        <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={panelId}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-left hover:bg-muted/50 md:flex-nowrap">
          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
          <Avatar user={u} size={26} />
          <span className="min-w-0 flex-1 basis-[40%]">
            <span className="flex items-center gap-1.5"><span className="truncate font-medium">{u.name}</span>{u.is_admin && <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 text-[11px] font-medium text-primary"><ShieldCheck className="h-3 w-3" />Admin</span>}</span>
            <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
          </span>
          <span className="w-[84px] shrink-0"><StatusPill status={u.status} /></span>
          <span className="w-[88px] shrink-0 text-xs text-muted-foreground max-sm:hidden">{u.is_admin ? <span className="text-foreground">All projects</span> : <><span className="tabular-nums text-foreground">{u.project_count}</span> project{u.project_count === 1 ? '' : 's'}</>}</span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {removed ? (
            <Button size="sm" variant="outline" onClick={onRestore} disabled={busy}><RotateCcw className="h-3.5 w-3.5" /><span className="hidden sm:inline">Restore</span></Button>
          ) : !u.is_admin && (
            <Button size="sm" variant="ghost" className="hidden md:inline-flex" onClick={() => onStatus(u.status === 'active' ? 'inactive' : 'active')} disabled={busy}>
              {u.status === 'active' ? <><UserX className="h-3.5 w-3.5" />Deactivate</> : <><UserCheck className="h-3.5 w-3.5" />Activate</>}
            </Button>
          )}
          {!removed && (
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded p-1.5 text-muted-foreground hover:bg-accent" aria-label={`Actions for ${u.name}`}><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={onEdit}><Pencil className="h-3.5 w-3.5" />Edit details</DropdownMenuItem>
                {!u.is_admin && <DropdownMenuItem onSelect={() => onStatus(u.status === 'active' ? 'inactive' : 'active')}>{u.status === 'active' ? <><UserX className="h-3.5 w-3.5" />Deactivate</> : <><UserCheck className="h-3.5 w-3.5" />Activate</>}</DropdownMenuItem>}
                {!u.is_admin && <><DropdownMenuSeparator /><DropdownMenuItem destructive onSelect={onRemove}><Trash2 className="h-3.5 w-3.5" />Remove from Bug Tracker</DropdownMenuItem></>}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {expanded && (
        <div id={panelId} role="region" aria-label={`Details for ${u.name}`} className="grid gap-5 px-4 pb-4 pt-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:pl-[60px]">
          <section aria-label="User details" className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Details</h3>
            <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-y-1 text-[13px]">
              <dt className="text-xs text-muted-foreground">Username</dt><dd className="truncate">{u.login}</dd>
              <dt className="text-xs text-muted-foreground">E-mail</dt><dd className="truncate">{u.email}</dd>
              <dt className="text-xs text-muted-foreground">Added</dt><dd>{formatDate(u.added_at)}</dd>
              <dt className="text-xs text-muted-foreground">Status since</dt><dd>{formatDateTime(u.status_changed_at)}</dd>
            </dl>
            <h3 className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Permissions</h3>
            <PermissionBoxes keys={permissionKeys} value={u.is_admin ? Object.keys(permissionKeys) : perms} onChange={setPerms} disabled={u.is_admin || removed} />
            {u.is_admin && <p className="text-xs text-muted-foreground">The Bug Tracker Admin has every permission and can see every project.</p>}
            {!u.is_admin && !removed && <div className="pl-5"><Button size="sm" disabled={!dirty} loading={savePerms.isPending} onClick={() => savePerms.mutate()}>Save permissions</Button></div>}
            {!removed && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3.5 w-3.5" />Edit details</Button>
                {!u.is_admin && <Button size="sm" variant="outline" onClick={() => onStatus(u.status === 'active' ? 'inactive' : 'active')} disabled={busy}>{u.status === 'active' ? 'Deactivate' : 'Activate'}</Button>}
                {!u.is_admin && <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onRemove} disabled={busy}>Remove</Button>}
              </div>
            )}
          </section>
          <section aria-label="Project access" className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Project access ({u.is_admin ? 'all projects' : `${u.project_count} of ${projects.length}`})</h3>
            {u.is_admin
              ? <p className="rounded-md border border-border bg-card px-3 py-2 text-[13px] text-muted-foreground">The Bug Tracker Admin can access every project.</p>
              : removed ? <p className="text-xs text-muted-foreground">Project access was revoked when this user was removed. Restore the user to assign projects again.</p>
              : <ProjectAccess user={u} projects={projects} />}
          </section>
        </div>
      )}
    </div>
  );
}

export function ManageUsers() {
  const toast = useToast();
  const confirm = useConfirm();
  const refresh = useRefreshUsers();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TrackerUser | null>(null);
  const dSearch = useDebounce(search, 300);
  const q = useQuery({
    queryKey: ['tracker-users', { s: dSearch, status, page }],
    queryFn: () => TrackerUsersApi.list({ search: dSearch, status, page, per_page: 20 }),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
  const projects = useProjects();
  const lic = q.data?.license;
  const counts = q.data?.counts;

  const changeStatus = useMutation({
    mutationFn: ({ u, s }: { u: TrackerUser; s: 'active' | 'inactive' }) => TrackerUsersApi.update(u.id, { status: s }),
    onSuccess: (u) => { refresh(); toast.success(u.status === 'active' ? `${u.name} activated` : `${u.name} deactivated`); },
    onError: (e: Error) => toast.error('Could not change status', e.message),
  });
  const remove = useMutation({
    mutationFn: (u: TrackerUser) => TrackerUsersApi.remove(u.id),
    onSuccess: () => { refresh(); toast.success('User removed from the Bug Tracker'); setOpen(null); },
    onError: (e: Error) => toast.error('Could not remove user', e.message),
  });
  const restore = useMutation({
    mutationFn: (u: TrackerUser) => TrackerUsersApi.add({ user_id: u.user_id }),
    onSuccess: (u) => { refresh(); toast.success(`${u.name} restored`); },
    onError: (e: Error) => toast.error('Could not restore user', e.message),
  });
  const busy = changeStatus.isPending || remove.isPending || restore.isPending;

  const tabs: { key: string; label: string; n?: number }[] = [
    { key: '', label: 'All', n: counts ? counts.active + counts.inactive : undefined },
    { key: 'active', label: 'Active', n: counts?.active }, { key: 'inactive', label: 'Inactive', n: counts?.inactive }, { key: 'removed', label: 'Removed', n: counts?.removed },
  ];
  const items = q.data?.items ?? [];

  return (
    <div>
      <PageHeader title="Users" crumbs={[{ label: 'Users' }]}
        actions={<>
          {lic && <span className={cn('hidden rounded-md border px-2 py-1 text-xs sm:inline', lic.over_limit || !lic.can_add ? 'border-warning/50 bg-warning/10' : 'border-border text-muted-foreground')} title={`${lic.plan_label} plan`}>
            <span className="tabular-nums font-medium text-foreground">{lic.active}</span> / {lic.limit || '∞'} active · {lic.plan_label}</span>}
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" />Add user</Button>
        </>} />

      {lic && !lic.can_add && (
        <div role="status" className="border-b border-warning/40 bg-warning/10 px-3 py-1.5 text-xs">You’ve reached the {lic.limit}-user limit of the {lic.plan_label} plan. Deactivate or remove someone to activate another user, or upgrade your plan. You can still add users as inactive.</div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-3 py-1.5">
        <div className="flex items-center rounded-md bg-muted p-0.5" role="tablist" aria-label="Filter by status">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={status === t.key} onClick={() => { setStatus(t.key); setPage(1); }}
              className={cn('h-6 rounded px-2 text-xs font-medium text-muted-foreground hover:text-foreground', status === t.key && 'bg-background text-foreground shadow-sm')}>
              {t.label}{t.n !== undefined && <span className="ml-1 tabular-nums opacity-60">{t.n}</span>}
            </button>
          ))}
        </div>
        <div className="relative"><Search className="pointer-events-none absolute left-2 top-[7px] h-3.5 w-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or e-mail" aria-label="Search users"
            className="h-7 w-52 rounded-md border border-input bg-background pl-7 pr-2 text-xs focus:border-ring focus:ring-2 focus:ring-ring/25" /></div>
      </div>

      <div role="list" aria-label="Bug Tracker users" className="min-h-[160px]">
        {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
          : q.isLoading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="m-2 h-10" />)
          : items.length === 0 ? <EmptyState icon={<UsersIcon className="h-5 w-5" />} title={search || status ? 'No users match' : 'No users yet'} description={search || status ? 'Try another search or filter.' : 'Add people to give them access to projects.'} action={!search && !status ? <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" />Add user</Button> : undefined} />
          : items.map((u) => (
            <Row key={u.id} u={u} expanded={open === u.id} onToggle={() => setOpen(open === u.id ? null : u.id)} projects={(projects.data ?? [])} permissionKeys={q.data!.permission_keys} busy={busy}
              onEdit={() => setEditing(u)} onStatus={(s) => changeStatus.mutate({ u, s })} onRestore={() => restore.mutate(u)}
              onRemove={async () => { if (await confirm({ title: `Remove ${u.name}?`, description: 'They lose access to the Bug Tracker and all projects. Their bugs, comments and history are kept, and their WordPress account is not deleted. You can restore them later.', confirmLabel: 'Remove', destructive: true })) remove.mutate(u); }} />
          ))}
      </div>

      {q.data && q.data.total_pages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
          <span>{q.data.total} users · page {q.data.page} of {q.data.total_pages}</span>
          <div className="flex gap-1.5"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button><Button variant="outline" size="sm" disabled={page >= q.data.total_pages} onClick={() => setPage(page + 1)}>Next</Button></div>
        </div>
      )}

      {adding && q.data && <AddUserDialog open={adding} onOpenChange={setAdding} permissionKeys={q.data.permission_keys} projects={(projects.data ?? [])} licenseFull={!q.data.license.can_add} />}
      <EditUserDialog user={editing} onClose={() => setEditing(null)} permissionKeys={q.data?.permission_keys ?? {}} />
    </div>
  );
}
