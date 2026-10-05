import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { useVocab } from '@/store/app';
import type { ProjectRef, UserRef } from '@/types';

export function StatusBadge({ slug }: { slug: string }) {
  const d = useVocab().status(slug);
  return <Badge color={d?.color ?? '#64748b'}>{d?.label ?? slug}</Badge>;
}
export function PriorityBadge({ slug }: { slug: string }) {
  const d = useVocab().priority(slug);
  return (
    <Badge color={d?.color ?? '#64748b'}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: d?.color ?? '#64748b' }} />
      {d?.label ?? slug}
    </Badge>
  );
}
export function SeverityBadge({ slug }: { slug: string }) {
  const d = useVocab().severity(slug);
  return <Badge color={d?.color ?? '#64748b'}>{d?.label ?? slug}</Badge>;
}
export function ProjectChip({ project }: { project: ProjectRef | null }) {
  if (!project) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: project.color }} />
      <span className="truncate">{project.name}</span>
    </span>
  );
}
export function UserChip({ user, empty = 'Unassigned', size = 22 }: { user: UserRef | null; empty?: string; size?: number }) {
  if (!user) return <span className="text-muted-foreground">{empty}</span>;
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <Avatar user={user} size={size} />
      <span className="truncate">{user.name}</span>
    </span>
  );
}
