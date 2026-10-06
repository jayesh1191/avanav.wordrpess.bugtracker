import { Star } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectsApi } from '@/api/endpoints';
import { useToast } from '@/components/ui/toast';
import { keys } from '@/hooks/useData';
import { cn } from '@/utils/cn';
import type { Project } from '@/types';

/** Per-user favourite toggle: filled amber star when starred, outline when not. */
export function StarButton({ project, className, size = 14 }: { project: Pick<Project, 'id' | 'name' | 'is_favorite'>; className?: string; size?: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({
    mutationFn: (on: boolean) => ProjectsApi.favorite(project.id, on),
    onSuccess: (_d, on) => {
      qc.invalidateQueries({ queryKey: keys.projects });
      qc.invalidateQueries({ queryKey: ['project', project.id] });
      toast.success(on ? `Starred ${project.name}` : `Unstarred ${project.name}`);
    },
    onError: (e: Error) => toast.error('Could not update star', e.message),
  });
  const on = project.is_favorite;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Unstar ${project.name}` : `Star ${project.name}`}
      title={on ? 'Starred – click to unstar' : 'Star this project'}
      disabled={m.isPending}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); m.mutate(!on); }}
      className={cn('inline-flex shrink-0 items-center justify-center rounded p-0.5 transition-colors hover:bg-accent disabled:opacity-60', on ? 'text-amber-500' : 'text-muted-foreground/60 hover:text-foreground', className)}
    >
      <Star width={size} height={size} className={on ? 'fill-current' : ''} />
    </button>
  );
}
