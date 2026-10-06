import { useMemo } from 'react';
import { Select } from '@/components/ui/select';
import { Avatar } from '@/components/ui/avatar';
import { useProjects, useUsers } from '@/hooks/useData';

/** Assignee picker limited to users who can open the chosen project. */
export function AssigneeSelect({ value, onChange, projectId, disabled, id, className, ghost, 'aria-label': ariaLabel }: {
  value: string; onChange: (v: string) => void; projectId?: string; disabled?: boolean; id?: string; className?: string; ghost?: boolean; 'aria-label'?: string;
}) {
  const users = useUsers();
  const projects = useProjects();
  const options = useMemo(() => {
    const project = projects.data?.find((p) => String(p.id) === projectId);
    const memberIds = new Set([...(project?.members.map((m) => m.user.id) ?? []), project?.lead?.id ?? 0]);
    return (users.data?.items ?? [])
      .filter((u) => !project || u.sees_all_projects || memberIds.has(u.id) || String(u.id) === value)
      .map((u) => ({ value: String(u.id), textValue: u.name, label: <span className="flex items-center gap-2"><Avatar user={u} size={16} />{u.name}</span> }));
  }, [users.data, projects.data, projectId, value]);
  return (
    <Select id={id} ghost={ghost} className={className} aria-label={ariaLabel} value={value} onChange={onChange} options={options} emptyLabel="Unassigned" placeholder="Unassigned" disabled={disabled || users.isLoading} />
  );
}
