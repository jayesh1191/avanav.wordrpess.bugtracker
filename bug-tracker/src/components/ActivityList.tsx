import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/avatar';
import { useApp } from '@/store/app';
import { timeAgo } from '@/utils/format';
import type { ActivityEntry, Settings } from '@/types';

const FIELD_LABELS: Record<string, string> = {
  title: 'title', status: 'status', priority: 'priority', severity: 'severity', assignee: 'assignee', project: 'project',
  component: 'component', version: 'version', due_date: 'due date', browser: 'browser/device', description: 'description',
  steps_to_reproduce: 'steps to reproduce', expected_result: 'expected result', actual_result: 'actual result', environment: 'environment',
};

function valueLabel(field: string, v: string | null, s?: Settings) {
  if (!v) return 'none';
  const list = field === 'status' ? s?.statuses : field === 'priority' ? s?.priorities : field === 'severity' ? s?.severities : undefined;
  return list?.find((i) => i.slug === v)?.label ?? v;
}

export function describe(a: ActivityEntry, s?: Settings) {
  switch (a.action) {
    case 'created': return 'created this bug';
    case 'commented': return 'added a comment';
    case 'attachment_added': return `attached ${a.new_value}`;
    case 'attachment_removed': return `removed attachment ${a.old_value}`;
    case 'deleted': return `deleted bug ${a.new_value}`;
    case 'project_created': return `created project ${a.new_value}`;
    case 'updated': {
      const label = FIELD_LABELS[a.field] ?? a.field;
      if (!a.old_value && !a.new_value) return `updated the ${label}`;
      return `changed ${label} from “${valueLabel(a.field, a.old_value, s)}” to “${valueLabel(a.field, a.new_value, s)}”`;
    }
    default: return a.action;
  }
}

export function ActivityList({ items, showBug }: { items: ActivityEntry[]; showBug?: boolean }) {
  const { settings } = useApp();
  return (
    <ul className="space-y-4">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3">
          <Avatar user={a.user} size={28} />
          <div className="min-w-0 flex-1 text-sm">
            <p className="break-words">
              <span className="font-medium">{a.user?.name ?? 'Someone'}</span> {describe(a, settings)}
              {showBug && a.bug_id > 0 && a.bug_title && (
                <> on <Link to={`/bugs/${a.bug_id}`} className="font-medium text-primary hover:underline">#{a.bug_id} {a.bug_title}</Link></>
              )}
            </p>
            <p className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
