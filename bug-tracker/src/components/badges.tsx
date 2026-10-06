import { Avatar } from '@/components/ui/avatar';
import { useApp } from '@/store/app';
import { cn } from '@/utils/cn';
import { PriorityIcon, StatusIcon } from '@/components/icons';
import type { BugSummary, ProjectRef, UserRef } from '@/types';

/** Jira-style key, e.g. WR-12. */
export const bugRef = (b: Pick<BugSummary, 'id' | 'project'>) => `${b.project?.key || 'BUG'}-${b.id}`;

export function StatusBadge({ slug, className, iconOnly }: { slug: string; className?: string; iconOnly?: boolean }) {
  const { settings } = useApp();
  const d = settings?.statuses.find((s) => s.slug === slug);
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px]', className)} title={d?.label ?? slug}>
      <StatusIcon category={d?.category ?? 'open'} color={d?.color ?? '#64748b'} />
      {!iconOnly && <span className="truncate">{d?.label ?? slug}</span>}
    </span>
  );
}

export function PriorityBadge({ slug, className, iconOnly, collapse }: { slug: string; className?: string; iconOnly?: boolean; collapse?: boolean }) {
  const { settings } = useApp();
  const list = settings?.priorities ?? [];
  const idx = Math.max(0, list.findIndex((p) => p.slug === slug));
  const d = list[idx];
  const urgent = list.length > 1 && idx === list.length - 1;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px]', urgent && 'font-medium', className)} title={`Priority: ${d?.label ?? slug}`}>
      <PriorityIcon index={idx} count={list.length} color={d?.color ?? '#64748b'} />
      {!iconOnly && <span className={cn('truncate', collapse && 'hidden xl:inline')}>{d?.label ?? slug}</span>}
    </span>
  );
}

export function SeverityBadge({ slug, className }: { slug: string; className?: string }) {
  const { settings } = useApp();
  const list = settings?.severities ?? [];
  const idx = list.findIndex((s) => s.slug === slug);
  const d = list[idx];
  const strong = list.length > 1 && idx >= list.length - 2;
  return (
    <span
      className={cn('inline-flex items-center rounded border px-1.5 text-[11px] font-medium leading-[18px] whitespace-nowrap', className)}
      style={{ color: strong ? d?.color : undefined, borderColor: strong ? `${d?.color}55` : undefined, backgroundColor: strong ? `${d?.color}12` : undefined }}
      title={`Severity: ${d?.label ?? slug}`}
    >
      <span className={strong ? '' : 'text-muted-foreground'}>{d?.label ?? slug}</span>
    </span>
  );
}

export function LabelChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full border border-border bg-muted/60 px-1.5 text-[11px] leading-[17px] text-muted-foreground whitespace-nowrap', className)}>{children}</span>;
}

export function ProjectChip({ project, className }: { project: ProjectRef | null; className?: string }) {
  if (!project) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn('inline-flex items-center gap-1.5 min-w-0', className)} title={project.name}>
      <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: project.color }} />
      <span className="truncate">{project.name}</span>
    </span>
  );
}

export function UserChip({ user, empty = 'Unassigned', size = 18, className }: { user: UserRef | null; empty?: string; size?: number; className?: string }) {
  if (!user) return <span className={cn('text-muted-foreground', className)}>{empty}</span>;
  return (
    <span className={cn('inline-flex items-center gap-1.5 min-w-0', className)}>
      <Avatar user={user} size={size} />
      <span className="truncate">{user.name}</span>
    </span>
  );
}
