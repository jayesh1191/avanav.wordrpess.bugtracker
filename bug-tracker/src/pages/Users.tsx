import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Search, Users as UsersIcon } from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Pagination } from '@/components/Pagination';
import { config } from '@/api/client';
import { useApp } from '@/store/app';
import { ManageUsers } from '@/components/users/ManageUsers';
import { useUsers } from '@/hooks/useData';
import { useDebounce } from '@/hooks/useDebounce';
import { timeAgo } from '@/utils/format';

function TeamTable() {
  const { can } = useApp();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search);
  const q = useUsers({ search: debounced, page, per_page: 25 });
  const items = q.data?.items ?? [];
  const showEmail = items.some((u) => u.email);

  return (
    <>
      <PageHeader title="Users" crumbs={[{ label: 'Users' }]} description="WordPress users who can use the Bug Tracker."
        actions={can('manage_bug_tracker_users') && <Button asChild variant="outline"><a href={`${config().adminUrl}users.php`}>Manage in WordPress<ExternalLink className="h-3.5 w-3.5" /></a></Button>} />
      <Card>
        <div className="border-b border-border p-3"><div className="relative max-w-sm"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Search users" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search users" /></div></div>
        {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-1.5 font-medium">User</th>{showEmail && <th className="px-3 py-1.5 font-medium">Email</th>}
                <th className="px-3 py-1.5 font-medium">Role</th><th className="px-3 py-1.5 font-medium">Assigned bugs</th><th className="px-3 py-1.5 font-medium">Status</th><th className="px-3 py-1.5 font-medium">Last active</th>
              </tr></thead>
              <tbody>
                {q.isLoading && Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-8" /></td></tr>)}
                {items.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-1.5"><div className="flex items-center gap-2.5"><Avatar user={u} size={22} /><div><div className="font-medium leading-4">{u.name}</div><div className="text-[11px] leading-4 text-muted-foreground">@{u.login}</div></div></div></td>
                    {showEmail && <td className="px-3 py-1.5 text-muted-foreground">{u.email}</td>}
                    <td className="px-3 py-1.5"><div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r}>{r}</Badge>)}</div></td>
                    <td className="px-3 py-1.5">{u.assigned.total ? <Link to={`/bugs?assignee_id=${u.id}`} className="text-primary hover:underline">{u.assigned.open} open / {u.assigned.total} total</Link> : <span className="text-muted-foreground">0</span>}</td>
                    <td className="px-3 py-1.5"><span className="inline-flex items-center gap-1.5 text-xs"><span className={`h-1.5 w-1.5 rounded-full ${u.status === 'active' ? 'bg-success' : 'bg-muted-foreground/40'}`} />{u.status === 'active' ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-3 py-1.5 text-muted-foreground">{u.last_active ? timeAgo(u.last_active) : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!q.isLoading && items.length === 0 && <EmptyState icon={<UsersIcon className="h-6 w-6" />} title="No users found" description="Only users whose role has the view_bug_tracker capability are listed." />}
          </div>
        )}
        {q.data && q.data.total > 0 && <Pagination page={q.data.page} totalPages={q.data.total_pages} total={q.data.total} label="users" onPage={setPage} />}
      </Card>
    </>
  );
}

/** The Bug Tracker Admin manages users here; everyone else sees a read-only team directory. */
export default function Users() {
  const { can } = useApp();
  return can('manage_bug_tracker_users') ? <ManageUsers /> : <PageBody><TeamTable /></PageBody>;
}
