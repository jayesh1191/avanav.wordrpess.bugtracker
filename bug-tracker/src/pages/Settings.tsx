import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { MiscApi } from '@/api/endpoints';
import type { OptionDef, Settings as S, StatusCategory, StatusDef } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox, Switch } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useApp } from '@/store/app';
import { ACCENTS } from '@/utils/color';
import { cn } from '@/utils/cn';

type Item = OptionDef & Partial<Pick<StatusDef, 'category'>>;
const CATS: { value: StatusCategory; label: string }[] = [{ value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }, { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' }];

function ListEditor({ title, description, items, onChange, withCategory }: { title: string; description: string; items: Item[]; onChange: (i: Item[]) => void; withCategory?: boolean }) {
  const set = (i: number, patch: Partial<Item>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => { const n = [...items]; [n[i], n[i + d]] = [n[i + d], n[i]]; onChange(n); };
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {items.map((it, i) => (
          <div key={it.slug || `new-${i}`} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
            <input type="color" value={it.color} onChange={(e) => set(i, { color: e.target.value })} aria-label={`Colour for ${it.label || 'item'}`} className="h-9 w-10 shrink-0 cursor-pointer rounded border border-input bg-card p-1" />
            <Input className="min-w-[8rem] flex-1" value={it.label} maxLength={40} placeholder="Label" aria-label="Label" onChange={(e) => set(i, { label: e.target.value })} />
            {withCategory && <div className="w-36"><Select aria-label="Category" value={it.category ?? 'open'} onChange={(v) => set(i, { category: v as StatusCategory })} options={CATS} /></div>}
            <div className="ml-auto flex items-center">
              <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" disabled={items.length <= 1} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, { slug: '', label: '', color: '#64748b', ...(withCategory ? { category: 'open' as StatusCategory } : {}) }])}><Plus className="h-4 w-4" />Add</Button>
        <p className="text-xs text-muted-foreground">{withCategory ? 'The category controls dashboard counters and when a bug counts as resolved. ' : 'The order here is the order of importance (lowest → highest). '}Items that bugs still use cannot be deleted.</p>
      </CardContent>
    </Card>
  );
}

const Toggle = ({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
    <span><span className="block text-sm font-medium">{label}</span>{description && <span className="block text-xs text-muted-foreground">{description}</span>}</span>
    <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
  </label>
);

export default function Settings() {
  const { settings, can } = useApp();
  const qc = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<S | null>(null);
  useEffect(() => { if (settings && !draft) setDraft(structuredClone(settings)); }, [settings, draft]);

  const save = useMutation({
    mutationFn: (s: S) => MiscApi.saveSettings(s),
    onSuccess: (s) => { qc.setQueryData(['settings'], s); setDraft(structuredClone(s)); toast.success('Settings saved'); },
    onError: (e: Error) => toast.error('Could not save settings', e.message),
  });

  if (!draft || !settings) return <><PageHeader title="Settings" crumbs={[{ label: 'Settings' }]} /><Skeleton className="h-96" /></>;
  const manage = can('manage_bug_tracker');
  const manageUsers = can('manage_bug_tracker_users') && !!draft.permissions;
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const patch = (p: Partial<S>) => setDraft({ ...draft, ...p });
  const patchUi = (p: Partial<S['ui']>) => setDraft({ ...draft, ui: { ...draft.ui, ...p } });
  const validate = () => {
    for (const k of ['statuses', 'priorities', 'severities'] as const) if (draft[k].some((i) => !i.label.trim())) { toast.error('Every item needs a label', `Check the ${k} tab.`); return false; }
    return true;
  };
  const submit = () => { if (validate()) save.mutate(draft); };

  return (
    <>
      <PageHeader title="Settings" crumbs={[{ label: 'Settings' }]} description="Customise workflow vocabulary, notifications and permissions."
        actions={<><Button variant="outline" disabled={!dirty} onClick={() => setDraft(structuredClone(settings))}>Reset</Button><Button disabled={!dirty} loading={save.isPending} onClick={submit}>Save settings</Button></>} />
      <Tabs defaultValue={manage ? 'statuses' : 'permissions'}>
        <TabsList>
          {manage && <><TabsTrigger value="statuses">Statuses</TabsTrigger><TabsTrigger value="priorities">Priorities</TabsTrigger><TabsTrigger value="severities">Severities</TabsTrigger><TabsTrigger value="project">Projects</TabsTrigger><TabsTrigger value="notifications">Notifications</TabsTrigger><TabsTrigger value="appearance">Appearance</TabsTrigger></>}
          {manageUsers && <TabsTrigger value="permissions">User permissions</TabsTrigger>}
        </TabsList>
        {manage && <>
          <TabsContent value="statuses"><ListEditor title="Bug statuses" description="The workflow stages a bug moves through." items={draft.statuses} withCategory onChange={(i) => patch({ statuses: i as StatusDef[] })} /></TabsContent>
          <TabsContent value="priorities"><ListEditor title="Priorities" description="How urgently a bug needs attention." items={draft.priorities} onChange={(i) => patch({ priorities: i })} /></TabsContent>
          <TabsContent value="severities"><ListEditor title="Severities" description="How badly a bug affects users." items={draft.severities} onChange={(i) => patch({ severities: i })} /></TabsContent>
          <TabsContent value="project">
            <Card><CardHeader><CardTitle>Project settings</CardTitle></CardHeader><CardContent className="space-y-4">
              <Toggle label="Limit visibility to project members" description="When on, users without “manage projects” only see bugs in projects they belong to (plus bugs they reported or are assigned)." checked={draft.project.restrict_to_members} onChange={(v) => patch({ project: { ...draft.project, restrict_to_members: v } })} />
              <div className="grid gap-4 sm:grid-cols-3">
                <div><label className="mb-1.5 block text-sm font-medium" htmlFor="da">Default assignee</label>
                  <Select id="da" value={draft.project.default_assignee} onChange={(v) => patch({ project: { ...draft.project, default_assignee: v as 'none' | 'project_lead' } })} options={[{ value: 'none', label: 'Unassigned' }, { value: 'project_lead', label: 'Project lead' }]} /></div>
                <div><label className="mb-1.5 block text-sm font-medium" htmlFor="mx">Max attachment size (MB)</label>
                  <Input id="mx" type="number" min={1} max={100} value={draft.project.max_attachment_mb} onChange={(e) => patch({ project: { ...draft.project, max_attachment_mb: Number(e.target.value) } })} />
                  <p className="mt-1 text-xs text-muted-foreground">Server limit: {draft.limits.server_max_upload_mb} MB</p></div>
                <div><label className="mb-1.5 block text-sm font-medium" htmlFor="pp">Bugs per page</label>
                  <Input id="pp" type="number" min={5} max={100} value={draft.project.per_page} onChange={(e) => patch({ project: { ...draft.project, per_page: Number(e.target.value) } })} /></div>
              </div>
              <div className="border-t border-border pt-2"><Toggle label="Delete all data when the plugin is uninstalled" description="Removes tables, settings and uploaded files when the plugin is deleted from the Plugins page." checked={!!draft.uninstall?.delete_data} onChange={(v) => patch({ uninstall: { delete_data: v } })} /></div>
            </CardContent></Card>
          </TabsContent>
          <TabsContent value="appearance">
            <Card><CardHeader><CardTitle>Appearance &amp; layout</CardTitle><CardDescription>Defaults for everyone. People can still pick their own theme and collapse the sidebar for themselves.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="ui-name">App name</label>
                    <Input id="ui-name" maxLength={40} placeholder="Defaults to the site name" value={draft.ui.app_name} onChange={(e) => patchUi({ app_name: e.target.value })} /></div>
                  <div><label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="ui-theme">Default theme</label>
                    <Select id="ui-theme" value={draft.ui.theme} onChange={(v) => patchUi({ theme: v as S['ui']['theme'] })} options={[{ value: 'system', label: 'Match system' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} /></div>
                  <div><label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="ui-density">Density</label>
                    <Select id="ui-density" value={draft.ui.density} onChange={(v) => patchUi({ density: v as S['ui']['density'] })} options={[{ value: 'compact', label: 'Compact (34px rows)' }, { value: 'comfortable', label: 'Comfortable (42px rows)' }]} /></div>
                </div>
                <div>
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Accent colour</span>
                  <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Accent colour">
                    {ACCENTS.map((a) => (
                      <button key={a.value} type="button" role="radio" aria-checked={draft.ui.accent.toLowerCase() === a.value} aria-label={a.name} title={a.name} onClick={() => patchUi({ accent: a.value })}
                        className={cn('h-6 w-6 rounded-full ring-offset-2 ring-offset-card transition', draft.ui.accent.toLowerCase() === a.value ? 'ring-2 ring-foreground' : 'hover:ring-2 hover:ring-border')} style={{ background: a.value }} />
                    ))}
                    <input type="color" aria-label="Custom accent colour" value={draft.ui.accent} onChange={(e) => patchUi({ accent: e.target.value })} className="h-7 w-9 cursor-pointer rounded border border-input bg-background p-0.5" />
                    <span className="text-xs tabular-nums text-muted-foreground">{draft.ui.accent}</span>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="ui-view">Default bugs view</label>
                    <Select id="ui-view" value={draft.ui.default_view} onChange={(v) => patchUi({ default_view: v as S['ui']['default_view'] })} options={[{ value: 'all', label: 'All bugs' }, { value: 'active', label: 'Active (open + in progress)' }, { value: 'mine', label: 'Assigned to me' }]} /></div>
                </div>
                <div className="divide-y divide-border">
                  <Toggle label="Group the bug list by status" description="Default for the Bugs screen; each person can toggle it." checked={draft.ui.group_by_status} onChange={(v) => patchUi({ group_by_status: v })} />
                  <Toggle label="Start with the sidebar collapsed to icons" description="Default for new visitors; the burger button in the top bar toggles it." checked={draft.ui.sidebar_collapsed} onChange={(v) => patchUi({ sidebar_collapsed: v })} />
                </div>
                <div>
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Columns in the bug list</span>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {(Object.keys(draft.ui.columns) as (keyof S['ui']['columns'])[]).map((k) => (
                      <label key={k} className="flex cursor-pointer items-center gap-2 text-[13px] capitalize">
                        <Checkbox checked={draft.ui.columns[k]} onCheckedChange={(v) => patchUi({ columns: { ...draft.ui.columns, [k]: v === true } })} />{k}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">ID, status, priority and title are always shown. Small screens hide secondary columns automatically.</p>
                </div>
              </CardContent></Card>
          </TabsContent>
          <TabsContent value="notifications">
            <Card><CardHeader><CardTitle>Notification settings</CardTitle><CardDescription>Choose which events notify users inside the Bug Tracker.</CardDescription></CardHeader><CardContent className="divide-y divide-border">
              {([['assignment', 'Bug assignment', 'When a bug is assigned to someone'], ['status', 'Status changes', 'Tell the reporter and assignee when status changes'], ['comment', 'Comments', 'New comments on bugs you reported or are assigned to'], ['mention', 'Mentions', 'When someone @mentions you in a comment'], ['resolution', 'Resolutions', 'When a bug is resolved or closed'], ['email', 'Also send e-mail', 'Mirror notifications to the user’s WordPress e-mail address']] as const).map(([k, l, d]) => (
                <Toggle key={k} label={l} description={d} checked={draft.notifications[k]} onChange={(v) => patch({ notifications: { ...draft.notifications, [k]: v } })} />
              ))}
            </CardContent></Card>
          </TabsContent>
        </>}
        {manageUsers && draft.permissions && (
          <TabsContent value="permissions">
            <Card><CardHeader><CardTitle>Role permissions</CardTitle><CardDescription>Choose what each WordPress role can do in the Bug Tracker. Administrators always have every permission.</CardDescription></CardHeader>
              <CardContent className="relative overflow-x-auto p-0 sm:p-0">
                {draft.permissions.roles.length === 0 ? <EmptyState title="No roles" /> : (
                  <table className="min-w-[720px] text-sm">
                    <thead><tr className="border-y border-border bg-muted/40 text-xs text-muted-foreground"><th className="px-4 py-2.5 text-left font-medium">Role</th>{draft.permissions.capabilities.map((c) => <th key={c.cap} className="px-2 py-2.5 text-center font-medium" title={c.label}>{c.cap.replace(/_/g, ' ')}</th>)}</tr></thead>
                    <tbody>
                      {draft.permissions.roles.map((role, ri) => (
                        <tr key={role.slug} className="border-b border-border last:border-0">
                          <td className="px-4 py-2.5 font-medium">{role.name}</td>
                          {draft.permissions!.capabilities.map((c) => (
                            <td key={c.cap} className="px-2 py-2.5"><div className="flex justify-center">
                              <Checkbox checked={role.caps[c.cap]} disabled={role.locked} aria-label={`${role.name}: ${c.cap}`}
                                onCheckedChange={(v) => { const roles = draft.permissions!.roles.map((r, i) => (i === ri ? { ...r, caps: { ...r.caps, [c.cap]: v === true } } : r)); patch({ permissions: { ...draft.permissions!, roles } }); }} />
                            </div></td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent></Card>
            <ul className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">{draft.permissions.capabilities.map((c) => <li key={c.cap}><code>{c.cap}</code> — {c.label}</li>)}</ul>
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
