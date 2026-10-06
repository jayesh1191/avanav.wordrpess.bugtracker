import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Check, Circle, MessageSquare, Paperclip, Pencil, Trash2, X } from 'lucide-react';
import { BugsApi } from '@/api/endpoints';
import type { ActivityEntry, BugDetail as Bug, Comment } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm';
import { LabelChip, PriorityBadge, StatusBadge, UserChip, bugRef } from '@/components/badges';
import { describe } from '@/components/ActivityList';
import { AttachmentList } from '@/components/bugs/AttachmentList';
import { useFileValidator } from '@/components/bugs/AttachmentPicker';
import { AssigneeSelect } from '@/components/UserSelect';
import { useApp } from '@/store/app';
import { keys, useBug, useInvalidateBugs } from '@/hooks/useData';
import { formatDateTime, formatDueDate, isOverdue, timeAgo } from '@/utils/format';

const Section = ({ title, children }: { title: string; children?: string }) =>
  children?.trim() ? (
    <section>
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.6]">{children}</p>
    </section>
  ) : null;

const Prop = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid min-h-7 grid-cols-[84px_minmax(0,1fr)] items-center gap-1 text-[13px]">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="min-w-0 px-1.5">{children}</dd>
  </div>
);

function Mentions({ text }: { text: string }) {
  return <>{text.split(/(@[A-Za-z0-9_.-]{2,60})/g).map((p, i) => (p.startsWith('@') ? <span key={i} className="rounded bg-primary/10 px-0.5 font-medium text-primary">{p}</span> : p))}</>;
}

const commentSchema = z.object({ content: z.string().trim().min(1, 'Write something first').max(20000, 'Comment is too long') });

type TimelineItem = { kind: 'comment'; at: string; c: Comment } | { kind: 'event'; at: string; a: ActivityEntry };

function Timeline({ bug }: { bug: Bug }) {
  const { can, user, settings } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const invalidate = useInvalidateBugs();
  const comments = useQuery({ queryKey: ['comments', bug.id], queryFn: () => BugsApi.comments(bug.id) });
  const activity = useQuery({ queryKey: ['activity', bug.id], queryFn: () => BugsApi.activity(bug.id) });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ content: string }>({ resolver: zodResolver(commentSchema), defaultValues: { content: '' } });
  const add = useMutation({
    mutationFn: (v: { content: string }) => BugsApi.addComment(bug.id, v.content),
    onSuccess: () => { reset(); qc.invalidateQueries({ queryKey: ['comments', bug.id] }); qc.invalidateQueries({ queryKey: ['activity', bug.id] }); invalidate(); },
    onError: (e: Error) => toast.error('Could not post comment', e.message),
  });
  const del = useMutation({
    mutationFn: (id: number) => BugsApi.removeComment(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comments', bug.id] }); invalidate(); },
    onError: (e: Error) => toast.error('Could not delete comment', e.message),
  });

  const items = useMemo<TimelineItem[]>(() => {
    const list: TimelineItem[] = [
      ...(comments.data ?? []).map((c) => ({ kind: 'comment' as const, at: c.created_at, c })),
      ...(activity.data ?? []).filter((a) => a.action !== 'commented').map((a) => ({ kind: 'event' as const, at: a.created_at, a })),
    ];
    return list.sort((x, y) => x.at.localeCompare(y.at));
  }, [comments.data, activity.data]);

  return (
    <section aria-label="Activity">
      <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold"><MessageSquare className="h-3.5 w-3.5" />Activity<span className="font-normal text-muted-foreground">{comments.data?.length ?? 0} comment{comments.data?.length === 1 ? '' : 's'}</span></h2>
      {(comments.isLoading || activity.isLoading) && <Skeleton className="h-16" />}
      {(comments.isError || activity.isError) && <ErrorState error={comments.error ?? activity.error} onRetry={() => { comments.refetch(); activity.refetch(); }} className="py-6" />}
      <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-px before:bg-border">
        {items.map((it) => it.kind === 'event' ? (
          <li key={`a${it.a.id}`} className="relative flex items-start gap-2.5 pl-0 text-xs text-muted-foreground">
            <span className="relative z-[1] mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full bg-background"><Circle className="h-2 w-2 fill-current" /></span>
            <p className="min-w-0 break-words pt-px"><span className="font-medium text-foreground">{it.a.user?.name ?? 'Someone'}</span> {describe(it.a, settings)} <span title={formatDateTime(it.a.created_at)}>· {timeAgo(it.a.created_at)}</span></p>
          </li>
        ) : (
          <li key={`c${it.c.id}`} className="relative flex items-start gap-2.5">
            <span className="relative z-[1] bg-background"><Avatar user={it.c.user} size={19} /></span>
            <div className="min-w-0 flex-1 rounded-md border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-3 py-1 text-xs">
                <span className="font-medium">{it.c.user?.name}</span>
                <span className="text-muted-foreground" title={formatDateTime(it.c.created_at)}>{timeAgo(it.c.created_at)}</span>
                {it.c.can_delete && (
                  <button className="ml-auto text-muted-foreground hover:text-destructive" aria-label="Delete comment"
                    onClick={async () => { if (await confirm({ title: 'Delete this comment?', confirmLabel: 'Delete', destructive: true })) del.mutate(it.c.id); }}><Trash2 className="h-3 w-3" /></button>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words px-3 py-2 text-[13px] leading-[1.55]"><Mentions text={it.c.content} /></p>
            </div>
          </li>
        ))}
      </ol>
      {can('create_bug') && (
        <form onSubmit={handleSubmit((v) => add.mutate(v))} className="mt-4 flex items-start gap-2.5" noValidate>
          <Avatar user={user} size={19} className="mt-1.5" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Textarea rows={2} placeholder="Leave a comment — use @username to mention someone" aria-label="Comment" aria-invalid={!!errors.content} {...register('content')}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit((v) => add.mutate(v))(); } }} />
            {errors.content && <p role="alert" className="text-xs text-destructive">{errors.content.message}</p>}
            <div className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground">Ctrl/⌘ + Enter to send</span><Button type="submit" size="sm" loading={add.isPending}>Comment</Button></div>
          </div>
        </form>
      )}
    </section>
  );
}

export default function BugDetail() {
  const bugId = Number(useParams().id) || 0;
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const invalidate = useInvalidateBugs();
  const { settings, can } = useApp();
  const validate = useFileValidator();
  const [gone, setGone] = useState(false);
  const q = useBug(gone ? 0 : bugId);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const update = useMutation({
    mutationFn: (patch: Record<string, unknown>) => BugsApi.update(bugId, patch),
    onSuccess: (data: Bug) => { qc.setQueryData(keys.bug(bugId), data); qc.invalidateQueries({ queryKey: ['activity', bugId] }); invalidate(); toast.success('Updated'); },
    onError: (e: Error) => toast.error('Update failed', e.message),
  });

  if (q.isError) return <><PageHeader title="Bug" crumbs={[{ label: 'Bugs', to: '/bugs' }, { label: 'Not found' }]} /><ErrorState error={q.error} onRetry={() => q.refetch()} /></>;
  if (q.isLoading || !q.data || !settings) return <><PageHeader title="Loading…" crumbs={[{ label: 'Bugs', to: '/bugs' }]} /><div className="grid gap-6 p-5 lg:grid-cols-[1fr_288px]"><Skeleton className="h-80" /><Skeleton className="h-80" /></div></>;

  const b = q.data;
  const edit = b.can_edit;
  const finished = settings.statuses.some((s) => s.slug === b.status && ['resolved', 'closed'].includes(s.category));
  const statusOpts = settings.statuses.map((s) => ({ value: s.slug, textValue: s.label, label: <StatusBadge slug={s.slug} /> }));
  const prioOpts = settings.priorities.map((s) => ({ value: s.slug, textValue: s.label, label: <PriorityBadge slug={s.slug} /> }));
  const sevOpts = settings.severities.map((s) => ({ value: s.slug, label: s.label }));

  const onDelete = async () => {
    if (!(await confirm({ title: `Delete ${bugRef(b)}?`, description: 'The bug, its comments and its attachments will be permanently deleted.', confirmLabel: 'Delete', destructive: true }))) return;
    try { await BugsApi.remove(b.id); setGone(true); qc.removeQueries({ queryKey: keys.bug(b.id), exact: true }); invalidate(); toast.success('Bug deleted'); nav('/bugs', { replace: true }); }
    catch (e) { toast.error('Could not delete bug', (e as Error).message); }
  };
  const saveTitle = () => {
    const t = title.trim();
    if (t.length < 3) { toast.error('Title must be at least 3 characters'); return; }
    if (t !== b.title) update.mutate({ title: t });
    setEditingTitle(false);
  };
  const uploadFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    let ok = 0;
    for (const f of Array.from(list)) {
      const err = validate(f);
      if (err) { toast.error('File not added', err); continue; }
      try { await BugsApi.upload(b.id, f); ok++; } catch (e) { toast.error(`Upload failed: ${f.name}`, (e as Error).message); }
    }
    if (fileInput.current) fileInput.current.value = '';
    setUploading(false);
    if (ok) { toast.success(`${ok} file${ok === 1 ? '' : 's'} attached`); invalidate(); qc.invalidateQueries({ queryKey: ['activity', bugId] }); }
  };
  const removeAttachment = async (id: number, name: string) => {
    if (!(await confirm({ title: 'Remove attachment?', description: name, confirmLabel: 'Remove', destructive: true }))) return;
    try { await BugsApi.removeAttachment(id); invalidate(); qc.invalidateQueries({ queryKey: ['activity', bugId] }); toast.success('Attachment removed'); }
    catch (e) { toast.error('Could not remove attachment', (e as Error).message); }
  };

  const hasBody = [b.description, b.steps_to_reproduce, b.expected_result, b.actual_result].some((x) => x?.trim());

  return (
    <>
      <PageHeader title={bugRef(b)}
        crumbs={[{ label: 'Bugs', to: '/bugs' }, ...(b.project ? [{ label: b.project.name, to: `/bugs?project_id=${b.project.id}` }] : []), { label: bugRef(b) }]}
        actions={<>
          {edit && <Button variant="ghost" size="sm" onClick={() => nav(`/bugs/${b.id}/edit`)}><Pencil className="h-3.5 w-3.5" />Edit</Button>}
          {b.can_delete && <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" />Delete</Button>}
        </>} />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_288px]">
        <div className="min-w-0 space-y-6 p-4 sm:p-6 lg:max-w-[820px]">
          <div>
            {editingTitle ? (
              <div className="flex items-center gap-1.5">
                <Input autoFocus value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }} aria-label="Bug title" className="h-9 text-lg font-semibold" />
                <Button size="icon" onClick={saveTitle} aria-label="Save title"><Check className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingTitle(false)} aria-label="Cancel"><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <h1 className="group flex items-start gap-2 text-xl font-semibold leading-7 tracking-tight">
                <span className="break-words">{b.title}</span>
                {edit && <button className="mt-1 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100" onClick={() => { setTitle(b.title); setEditingTitle(true); }} aria-label="Edit title"><Pencil className="h-3.5 w-3.5" /></button>}
              </h1>
            )}
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>Reported by <span className="font-medium text-foreground">{b.reporter?.name ?? 'unknown'}</span> {timeAgo(b.created_at)}</span>
              {b.component && <LabelChip>{b.component}</LabelChip>}{b.version && <LabelChip>v{b.version}</LabelChip>}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 lg:hidden"><StatusBadge slug={b.status} /><PriorityBadge slug={b.priority} /></div>
          </div>

          {hasBody ? (
            <div className="space-y-4">
              <Section title="Description">{b.description}</Section>
              <Section title="Steps to reproduce">{b.steps_to_reproduce}</Section>
              {(b.expected_result?.trim() || b.actual_result?.trim()) && (
                <div className="grid gap-4 sm:grid-cols-2"><Section title="Expected">{b.expected_result}</Section><Section title="Actual">{b.actual_result}</Section></div>
              )}
            </div>
          ) : <p className="text-[13px] italic text-muted-foreground">No description provided.</p>}

          {(b.environment?.trim() || b.browser?.trim()) && (
            <div className="grid gap-4 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-2"><Section title="Environment">{b.environment}</Section><Section title="Browser / device">{b.browser}</Section></div>
          )}

          <section aria-label="Attachments">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold"><Paperclip className="h-3.5 w-3.5" />Attachments<span className="font-normal text-muted-foreground">{b.attachments.length}</span></h2>
              {can('create_bug') && (<><input ref={fileInput} type="file" multiple hidden onChange={(e) => uploadFiles(e.target.files)} /><Button size="sm" variant="ghost" loading={uploading} onClick={() => fileInput.current?.click()}>Add files</Button></>)}
            </div>
            {b.attachments.length ? <AttachmentList items={b.attachments} canRemove={can('create_bug')} onRemove={(a) => removeAttachment(a.id, a.file_name)} /> : <p className="text-xs text-muted-foreground">No attachments.</p>}
          </section>

          <Timeline bug={b} />
        </div>

        <aside aria-label="Properties" className="border-t border-border bg-sidebar p-3 lg:sticky lg:top-11 lg:h-[calc(100vh-44px)] lg:overflow-y-auto lg:border-l lg:border-t-0">
          <h2 className="mb-1 px-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Properties</h2>
          <dl className="space-y-0.5">
            <Prop label="Status"><Select ghost aria-label="Status" value={b.status} onChange={(v) => update.mutate({ status: v })} options={statusOpts} disabled={!edit || update.isPending} className="-mx-1.5 w-[calc(100%+12px)]" /></Prop>
            <Prop label="Priority"><Select ghost aria-label="Priority" value={b.priority} onChange={(v) => update.mutate({ priority: v })} options={prioOpts} disabled={!edit || update.isPending} className="-mx-1.5 w-[calc(100%+12px)]" /></Prop>
            <Prop label="Severity"><Select ghost aria-label="Severity" value={b.severity} onChange={(v) => update.mutate({ severity: v })} options={sevOpts} disabled={!edit || update.isPending} className="-mx-1.5 w-[calc(100%+12px)]" /></Prop>
            <Prop label="Assignee">
              {edit ? <AssigneeSelect ghost aria-label="Assignee" value={b.assignee ? String(b.assignee.id) : ''} projectId={b.project ? String(b.project.id) : undefined} onChange={(v) => update.mutate({ assignee_id: Number(v || 0) })} disabled={update.isPending} className="-mx-1.5 w-[calc(100%+12px)]" /> : <UserChip user={b.assignee} />}
            </Prop>
          </dl>
          <div className="my-3 border-t border-border" />
          <dl className="space-y-0.5">
            <Prop label="Project">{b.project ? <Link to={`/projects/${b.project.id}`} className="inline-flex items-center gap-1.5 hover:text-primary hover:underline"><span className="h-2 w-2 rounded-[3px]" style={{ background: b.project.color }} />{b.project.name}</Link> : '—'}</Prop>
            <Prop label="Reporter"><UserChip user={b.reporter} empty="Unknown" /></Prop>
            <Prop label="Component">{b.component || <span className="text-muted-foreground">—</span>}</Prop>
            <Prop label="Version">{b.version || <span className="text-muted-foreground">—</span>}</Prop>
            <Prop label="Due">
              <span className={isOverdue(b.due_date) && !finished ? 'inline-flex items-center gap-1 font-medium text-destructive' : 'inline-flex items-center gap-1'}>
                {b.due_date && <CalendarClock className="h-3.5 w-3.5" />}{b.due_date ? formatDueDate(b.due_date) : <span className="text-muted-foreground">—</span>}
              </span>
            </Prop>
          </dl>
          <div className="my-3 border-t border-border" />
          <dl className="space-y-0.5 text-xs">
            <Prop label="Created"><span title={formatDateTime(b.created_at)}>{timeAgo(b.created_at)}</span></Prop>
            <Prop label="Updated"><span title={formatDateTime(b.updated_at)}>{timeAgo(b.updated_at)}</span></Prop>
            {b.resolved_at && <Prop label="Resolved"><span title={formatDateTime(b.resolved_at)}>{timeAgo(b.resolved_at)}</span></Prop>}
          </dl>
        </aside>
      </div>
    </>
  );
}
