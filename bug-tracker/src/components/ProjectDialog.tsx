import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { ProjectsApi } from '@/api/endpoints';
import { ApiError } from '@/api/client';
import type { Project } from '@/types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { useUsers } from '@/hooks/useData';
import { useInvalidateBugs } from '@/hooks/useData';

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(190, 'Name is too long'),
  key: z.string().trim().max(10, 'At most 10 characters').regex(/^[A-Za-z0-9]*$/, 'Letters and digits only'),
  description: z.string().max(5000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour'),
  status: z.enum(['active', 'archived']),
  lead_id: z.string(),
  members: z.array(z.string()),
});
type V = z.infer<typeof schema>;

export function ProjectDialog({ open, onOpenChange, project, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; project?: Project; onSaved?: (p: Project) => void }) {
  const toast = useToast();
  const invalidate = useInvalidateBugs();
  const users = useUsers();
  const [filter, setFilter] = useState('');
  const { register, control, handleSubmit, setError, watch, formState: { errors } } = useForm<V>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: project?.name ?? '', key: project?.key ?? '', description: project?.description ?? '', color: project?.color ?? '#6366f1',
      status: project?.status ?? 'active', lead_id: project?.lead ? String(project.lead.id) : '', members: project?.members.map((m) => String(m.user.id)) ?? [],
    },
  });
  const lead = watch('lead_id');

  const save = useMutation({
    mutationFn: (v: V) => {
      const body = { ...v, lead_id: Number(v.lead_id || 0), members: v.members.map((id) => ({ user_id: Number(id), role: project?.members.find((m) => String(m.user.id) === id)?.role ?? 'member' })) };
      return project ? ProjectsApi.update(project.id, body) : ProjectsApi.create(body);
    },
    onSuccess: (p) => { invalidate(); toast.success(project ? 'Project updated' : 'Project created'); onOpenChange(false); onSaved?.(p); },
    onError: (e: Error) => {
      if (e instanceof ApiError) for (const [k, m] of Object.entries(e.fields)) setError((k === 'lead_id' ? 'lead_id' : k) as keyof V, { message: m });
      toast.error('Could not save project', e.message);
    },
  });

  const list = (users.data?.items ?? []).filter((u) => u.name.toLowerCase().includes(filter.toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={project ? 'Edit project' : 'New project'} description="Projects group bugs and control who can see them." className="max-w-xl">
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
            <Field label="Name *" htmlFor="p-name" error={errors.name?.message}><Input id="p-name" autoFocus {...register('name')} /></Field>
            <Field label="Key" htmlFor="p-key" error={errors.key?.message} hint="Optional"><Input id="p-key" placeholder="WEB" {...register('key')} /></Field>
          </div>
          <Field label="Description" htmlFor="p-desc" error={errors.description?.message}><Textarea id="p-desc" rows={3} {...register('description')} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Colour" htmlFor="p-color" error={errors.color?.message}><Input id="p-color" type="color" className="p-1 cursor-pointer" {...register('color')} /></Field>
            <Field label="Status" htmlFor="p-status">
              <Controller control={control} name="status" render={({ field }) => <Select id="p-status" value={field.value} onChange={field.onChange} options={[{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]} />} />
            </Field>
            <Field label="Project lead" htmlFor="p-lead" error={errors.lead_id?.message}>
              <Controller control={control} name="lead_id" render={({ field }) => <Select id="p-lead" value={field.value} onChange={field.onChange} emptyLabel="No lead" placeholder="No lead" options={(users.data?.items ?? []).map((u) => ({ value: String(u.id), label: u.name }))} />} />
            </Field>
          </div>
          <Field label="Members" error={errors.members?.message as string | undefined} hint="Members can see this project's bugs. The lead is always a member.">
            <div className="rounded-md border border-input">
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter users…" aria-label="Filter users" className="rounded-b-none border-0 border-b" />
              <Controller control={control} name="members" render={({ field }) => (
                <ul className="max-h-44 overflow-y-auto p-1">
                  {users.isLoading && <li className="p-2 text-sm text-muted-foreground">Loading users…</li>}
                  {list.map((u) => {
                    const checked = field.value.includes(String(u.id)) || lead === String(u.id);
                    return (
                      <li key={u.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                          <Checkbox checked={checked} disabled={lead === String(u.id)}
                            onCheckedChange={(c) => field.onChange(c ? [...field.value, String(u.id)] : field.value.filter((x) => x !== String(u.id)))} />
                          <Avatar user={u} size={20} /><span className="truncate">{u.name}</span>
                        </label>
                      </li>
                    );
                  })}
                  {!users.isLoading && list.length === 0 && <li className="p-2 text-sm text-muted-foreground">No users found.</li>}
                </ul>
              )} />
            </div>
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{project ? 'Save changes' : 'Create project'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
