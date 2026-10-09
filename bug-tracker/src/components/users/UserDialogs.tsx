import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { TrackerUsersApi } from '@/api/endpoints';
import { ApiError } from '@/api/client';
import type { Project, TrackerUser } from '@/types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Checkbox, Switch } from '@/components/ui/checkbox';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/utils/cn';

export const useRefreshUsers = () => {
  const qc = useQueryClient();
  return () => {
    for (const k of ['tracker-users', 'projects', 'project', 'users']) qc.invalidateQueries({ queryKey: [k] });
  };
};

function PermissionBoxes({ keys, value, onChange, disabled }: { keys: Record<string, string>; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      {Object.entries(keys).map(([k, label]) => (
        <label key={k} className={cn('flex cursor-pointer items-start gap-2 text-[13px]', disabled && 'cursor-not-allowed opacity-60')}>
          <Checkbox className="mt-0.5" checked={value.includes(k)} disabled={disabled} onCheckedChange={(c) => onChange(c ? [...value, k] : value.filter((x) => x !== k))} />
          <span>{label}</span>
        </label>
      ))}
      <p className="pl-5 text-xs text-muted-foreground">Everyone can view the projects they are assigned to.</p>
    </div>
  );
}
export { PermissionBoxes };

const newUserSchema = z.object({
  username: z.string().trim().min(3, 'At least 3 characters').max(60, 'Too long').regex(/^[A-Za-z0-9._@-]+$/, 'Letters, numbers and . _ - @ only'),
  email: z.string().trim().email('Enter a valid e-mail address'),
  display_name: z.string().trim().max(100, 'Too long'),
  send_notification: z.boolean(),
});
type NewUser = z.infer<typeof newUserSchema>;

/* ------------------------------------------------------------------ */

export function AddUserDialog({ open, onOpenChange, permissionKeys, projects, licenseFull }: {
  open: boolean; onOpenChange: (o: boolean) => void; permissionKeys: Record<string, string>; projects: Project[]; licenseFull: boolean;
}) {
  const toast = useToast();
  const refresh = useRefreshUsers();
  const [tab, setTab] = useState<'existing' | 'new'>('existing');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<number | null>(null);
  const [perms, setPerms] = useState<string[]>(['create_bug', 'edit_bug']);
  const [active, setActive] = useState(true);
  const [projectIds, setProjectIds] = useState<number[]>([]);
  const [formError, setFormError] = useState('');
  const debounced = useDebounce(search, 250);
  const cands = useQuery({ queryKey: ['tracker-users', 'candidates', debounced], queryFn: () => TrackerUsersApi.candidates(debounced), enabled: open && tab === 'existing' });
  const { register, handleSubmit, setError, formState: { errors }, control } = useForm<NewUser>({ resolver: zodResolver(newUserSchema), defaultValues: { username: '', email: '', display_name: '', send_notification: true } });

  const add = useMutation({
    mutationFn: (body: Record<string, unknown>) => TrackerUsersApi.add(body),
    onSuccess: (u) => { refresh(); toast.success(`${u.name} added`); onOpenChange(false); },
    onError: (e: Error) => {
      if (e instanceof ApiError) {
        for (const [k, m] of Object.entries(e.fields)) setError(k as keyof NewUser, { message: m });
        setFormError(e.message);
      }
      toast.error('Could not add user', e.message);
    },
  });
  const common = { permissions: perms, status: active ? 'active' : 'inactive', projects: projectIds };
  const submitExisting = () => {
    setFormError('');
    if (!picked) { setFormError('Select a WordPress user first.'); return; }
    add.mutate({ ...common, user_id: picked });
  };
  const submitNew = handleSubmit((v) => { setFormError(''); add.mutate({ ...common, new_user: v }); });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add user" description="Give someone access to the Bug Tracker. No WordPress role is assigned." className="max-w-xl">
        {licenseFull && active && <p role="alert" className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">Your plan’s active-user limit is reached. Turn off “Activate immediately” to add this user as inactive, or free a seat first.</p>}
        <Tabs value={tab} onValueChange={(v) => { setTab(v as 'existing' | 'new'); setFormError(''); }}>
          <TabsList><TabsTrigger value="existing">Existing WordPress user</TabsTrigger><TabsTrigger value="new">Create new user</TabsTrigger></TabsList>
          <TabsContent value="existing" className="space-y-2">
            <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search by name, username or e-mail" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search WordPress users" /></div>
            <ul className="max-h-48 overflow-y-auto rounded-md border border-border" role="radiogroup" aria-label="WordPress users">
              {cands.isLoading && <li className="p-2"><Skeleton className="h-7" /></li>}
              {cands.data?.map((c) => (
                <li key={c.id}>
                  <button type="button" role="radio" aria-checked={picked === c.id} onClick={() => setPicked(c.id)}
                    className={cn('flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-muted', picked === c.id && 'bg-primary/10')}>
                    <Avatar user={c} size={22} /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{c.name}</span><span className="block truncate text-xs text-muted-foreground">{c.login} · {c.email}</span></span>
                  </button>
                </li>
              ))}
              {cands.data?.length === 0 && <li className="p-3 text-center text-xs text-muted-foreground">No matching users outside the tracker. Try “Create new user”.</li>}
            </ul>
          </TabsContent>
          <TabsContent value="new">
            <form id="new-user-form" onSubmit={submitNew} className="grid gap-3 sm:grid-cols-2" noValidate>
              <Field label="Username *" htmlFor="nu-username" error={errors.username?.message}><Input id="nu-username" autoComplete="off" {...register('username')} /></Field>
              <Field label="E-mail *" htmlFor="nu-email" error={errors.email?.message}><Input id="nu-email" type="email" autoComplete="off" {...register('email')} /></Field>
              <Field className="sm:col-span-2" label="Display name" htmlFor="nu-name" error={errors.display_name?.message} hint="Defaults to the username."><Input id="nu-name" {...register('display_name')} /></Field>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] sm:col-span-2">
                <Controller control={control} name="send_notification" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />} />
                E-mail them a link to set their password
              </label>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-4 grid gap-4 border-t border-border pt-3 sm:grid-cols-2">
          <div><h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Permissions</h4><PermissionBoxes keys={permissionKeys} value={perms} onChange={setPerms} /></div>
          <div>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project access</h4>
            <ul className="max-h-36 space-y-1 overflow-y-auto">
              {projects.map((p) => (
                <li key={p.id}><label className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <Checkbox checked={projectIds.includes(p.id)} onCheckedChange={(c) => setProjectIds((l) => (c ? [...l, p.id] : l.filter((x) => x !== p.id)))} />
                  <span className="h-2 w-2 rounded-[3px]" style={{ background: p.color }} /><span className="truncate">{p.name}</span>
                </label></li>
              ))}
              {projects.length === 0 && <li className="text-xs text-muted-foreground">No projects yet – assign access later.</li>}
            </ul>
          </div>
        </div>
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 text-[13px]"><span>Activate immediately<span className="block text-xs text-muted-foreground">Inactive users keep their account but cannot sign in to the tracker.</span></span><Switch checked={active} onCheckedChange={setActive} aria-label="Activate immediately" /></label>
        {formError && <p role="alert" className="mt-2 text-xs text-destructive">{formError}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {tab === 'existing'
            ? <Button onClick={submitExisting} loading={add.isPending} disabled={!picked}>Add user</Button>
            : <Button type="submit" form="new-user-form" loading={add.isPending}>Create &amp; add</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

const editSchema = z.object({
  display_name: z.string().trim().min(1, 'Enter a name').max(100, 'Too long'),
  email: z.string().trim().email('Enter a valid e-mail address'),
});
type EditValues = z.infer<typeof editSchema>;

export function EditUserDialog({ user, onClose, permissionKeys }: { user: TrackerUser | null; onClose: () => void; permissionKeys: Record<string, string> }) {
  const toast = useToast();
  const refresh = useRefreshUsers();
  const [perms, setPerms] = useState<string[]>(user?.permissions ?? []);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<EditValues>({ resolver: zodResolver(editSchema), values: user ? { display_name: user.name, email: user.email } : undefined });
  const save = useMutation({
    mutationFn: (v: EditValues) => {
      const body: Record<string, unknown> = {};
      if (user?.profile_editable) Object.assign(body, v);
      if (!user?.is_admin) body.permissions = perms;
      return TrackerUsersApi.update(user!.id, body);
    },
    onSuccess: () => { refresh(); toast.success('User updated'); onClose(); },
    onError: (e: Error) => {
      if (e instanceof ApiError) for (const [k, m] of Object.entries(e.fields)) setError(k as keyof EditValues, { message: m });
      toast.error('Could not update user', e.message);
    },
  });
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      {user && (
        <DialogContent title={`Edit ${user.name}`} description={`@${user.login}`} className="max-w-md">
          <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-3" noValidate>
            <Field label="Display name" htmlFor="eu-name" error={errors.display_name?.message}><Input id="eu-name" disabled={!user.profile_editable} {...register('display_name')} /></Field>
            <Field label="E-mail" htmlFor="eu-email" error={errors.email?.message}
              hint={user.profile_editable ? undefined : 'This WordPress account has administrative rights; edit its profile in WordPress.'}><Input id="eu-email" type="email" disabled={!user.profile_editable} {...register('email')} /></Field>
            <div><h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Permissions</h4>
              <PermissionBoxes keys={permissionKeys} value={user.is_admin ? Object.keys(permissionKeys) : perms} onChange={setPerms} disabled={user.is_admin} />
              {user.is_admin && <p className="mt-1 pl-5 text-xs text-muted-foreground">The Bug Tracker Admin always has every permission.</p>}</div>
            <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={save.isPending}>Save changes</Button></div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
