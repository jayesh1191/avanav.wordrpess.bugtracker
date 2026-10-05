import { useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Check, MessageSquare, Pencil, Paperclip, Trash2, X, History } from 'lucide-react';
import { BugsApi } from '@/api/endpoints';
import type { BugDetail as Bug } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm';
import { PriorityBadge, SeverityBadge, StatusBadge, UserChip } from '@/components/badges';
import { ActivityList } from '@/components/ActivityList';
import { AttachmentList } from '@/components/bugs/AttachmentList';
import { useFileValidator } from '@/components/bugs/AttachmentPicker';
import { AssigneeSelect } from '@/components/UserSelect';
import { useApp } from '@/store/app';
import { keys, useBug, useInvalidateBugs } from '@/hooks/useData';
import { formatDate, formatDateTime, formatDueDate, isOverdue, timeAgo } from '@/utils/format';

const Section = ({ title, children }: { title: string; children?: string }) => (
  <div>
    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
    {children?.trim() ? <p className="whitespace-pre-wrap break-words text-sm">{children}</p> : <p className="text-sm italic text-muted-foreground">Not provided</p>}
  </div>
);

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid grid-cols-[6.5rem_1fr] items-center gap-2 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0">{children}</dd>
  </div>
);

function Mentions({ text }: { text: string }) {
  return <>{text.split(/(@[A-Za-z0-9_.-]{2,60})/g).map((p, i) => (p.startsWith('@') ? <span key={i} className="font-medium text-primary">{p}</span> : p))}</>;
}

const commentSchema = z.object({ content: z.string().trim().min(1, 'Write something first').max(20000, 'Comment is too long') });

function Comments({ bugId }: { bugId: number }) {
  const { can, user } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const invalidate = useInvalidateBugs();
  const q = useQuery({ queryKey: ['comments', bugId], queryFn: () => BugsApi.comments(bugId) });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ content: string }>({ resolver: zodResolver(commentSchema), defaultValues: { content: '' } });
  const add = useMutation({
    mutationFn: (v: { content: string }) => BugsApi.addComment(bugId, v.content),
    onSuccess: () => { reset(); qc.invalidateQueries({ queryKey: ['comments', bugId] }); qc.invalidateQueries({ queryKey: ['activity', bugId] }); invalidate(); },
    onError: (e: Error) => toast.error('Could not post comment', e.message),
  });
  const del = useMutation({
    mutationFn: (id: number) => BugsApi.removeComment(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comments', bugId] }); invalidate(); },
    onError: (e: Error) => toast.error('Could not delete comment', e.message),
  });

  return (
    <div className="space-y-5">
      {q.isLoading && <Skeleton className="h-20" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} className="py-6" />}
      {q.data?.length === 0 && <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="No comments yet" description="Start the conversation below." className="py-6" />}
      <ul className="space-y-4">
        {q.data?.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Avatar user={c.user} size={32} />
            <div className="min-w-0 flex-1 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{c.user?.name}</span>
                <span className="text-xs text-muted-foreground" title={formatDateTime(c.created_at)}>{timeAgo(c.created_at)}</span>
                {c.can_delete && (
                  <button className="ml-auto text-muted-foreground hover:text-destructive" aria-label="Delete comment"
                    onClick={async () => { if (await confirm({ title: 'Delete this comment?', confirmLabel: 'Delete', destructive: true })) del.mutate(c.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm"><Mentions text={c.content} /></p>
            </div>
          </li>
        ))}
      </ul>
      {can('create_bug') && (
        <form onSubmit={handleSubmit((v) => add.mutate(v))} className="flex gap-3" noValidate>
          <Avatar user={user} size={32} />
          <div className="flex-1 space-y-2">
            <Textarea rows={3} placeholder="Add a comment… use @username to mention someone" aria-label="Comment" {...register('content')} />
            {errors.content && <p role="alert" className="text-xs text-destructive">{errors.content.message}</p>}
            <div className="flex justify-end"><Button type="submit" size="sm" loading={add.isPending}>Comment</Button></div>
          </div>
        </form>
      )}
    </div>
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
  const act = useQuery({ queryKey: ['activity', bugId], queryFn: () => BugsApi.activity(bugId), enabled: bugId > 0 && !gone });
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const update = useMutation({
    mutationFn: (patch: Record<string, unknown>) => BugsApi.update(bugId, patch),
    onSuccess: (data: Bug) => {
      qc.setQueryData(keys.bug(bugId), data);
      qc.invalidateQueries({ queryKey: ['activity', bugId] });
      invalidate();
      toast.success('Bug updated');
    },
    onError: (e: Error) => toast.error('Update failed', e.message),
  });

  if (q.isError) return <><PageHeader title="Bug" crumbs={[{ label: 'Bugs', to: '/bugs' }, { label: 'Not found' }]} /><Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card></>;
  if (q.isLoading || !q.data || !settings) return <><PageHeader title="Loading…" crumbs={[{ label: 'Bugs', to: '/bugs' }]} /><div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-96 lg:col-span-2" /><Skeleton className="h-96" /></div></>;

  const b = q.data;
  const edit = b.can_edit;
  const opts = (l: { slug: string; label: string }[]) => l.map((i) => ({ value: i.slug, label: i.label }));

  const onDelete = async () => {
    if (!(await confirm({ title: `Delete bug #${b.id}?`, description: 'The bug, its comments and its attachments will be permanently deleted.', confirmLabel: 'Delete', destructive: true }))) return;
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

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Bugs', to: '/bugs' }, { label: `#${b.id}` }]}
        title={
          editingTitle ? (
            <span className="flex items-center gap-2">
              <Input autoFocus value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }} aria-label="Bug title" className="text-base" />
              <Button size="icon" onClick={saveTitle} aria-label="Save title"><Check className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => setEditingTitle(false)} aria-label="Cancel"><X className="h-4 w-4" /></Button>
            </span>
          ) : (
            <span className="group inline-flex items-start gap-2">
              <span><span className="text-muted-foreground font-normal">#{b.id}</span> {b.title}</span>
              {edit && <button className="mt-1.5 text-muted-foreground opacity-60 hover:opacity-100" onClick={() => { setTitle(b.title); setEditingTitle(true); }} aria-label="Edit title"><Pencil className="h-4 w-4" /></button>}
            </span>
          )
        }
        description={<span className="flex flex-wrap items-center gap-2"><StatusBadge slug={b.status} /><PriorityBadge slug={b.priority} /><SeverityBadge slug={b.severity} /><span>Opened {timeAgo(b.created_at)} by {b.reporter?.name ?? 'unknown'}</span></span>}
        actions={<>
          {edit && <Button variant="outline" onClick={() => nav(`/bugs/${b.id}/edit`)}><Pencil className="h-4 w-4" />Edit</Button>}
          {b.can_delete && <Button variant="outline" className="text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" />Delete</Button>}
        </>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2 min-w-0">
          <Card><CardContent className="space-y-5 pt-5">
            <Section title="Description">{b.description}</Section>
            <Section title="Steps to reproduce">{b.steps_to_reproduce}</Section>
            <div className="grid gap-5 sm:grid-cols-2">
              <Section title="Expected result">{b.expected_result}</Section>
              <Section title="Actual result">{b.actual_result}</Section>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Section title="Environment">{b.environment}</Section>
              <Section title="Browser / device">{b.browser}</Section>
            </div>
          </CardContent></Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Paperclip className="h-4 w-4" />Attachments ({b.attachments.length})</CardTitle>
              {can('create_bug') && (
                <>
                  <input ref={fileInput} type="file" multiple hidden onChange={(e) => uploadFiles(e.target.files)} />
                  <Button size="sm" variant="outline" loading={uploading} onClick={() => fileInput.current?.click()}>Add files</Button>
                </>
              )}
            </CardHeader>
            <CardContent>
              {b.attachments.length ? <AttachmentList items={b.attachments} canRemove={can('create_bug')} onRemove={(a) => removeAttachment(a.id, a.file_name)} /> : <p className="text-sm text-muted-foreground">No attachments.</p>}
            </CardContent>
          </Card>

          <Card><CardContent className="pt-4">
            <Tabs defaultValue="comments">
              <TabsList>
                <TabsTrigger value="comments"><span className="inline-flex items-center gap-1.5"><MessageSquare className="h-4 w-4" />Comments ({b.comment_count})</span></TabsTrigger>
                <TabsTrigger value="activity"><span className="inline-flex items-center gap-1.5"><History className="h-4 w-4" />Activity</span></TabsTrigger>
              </TabsList>
              <TabsContent value="comments"><Comments bugId={b.id} /></TabsContent>
              <TabsContent value="activity">
                {act.isLoading && <Skeleton className="h-24" />}
                {act.isError && <ErrorState error={act.error} onRetry={() => act.refetch()} className="py-6" />}
                {act.data?.length === 0 && <EmptyState title="No activity yet" className="py-6" />}
                {act.data && act.data.length > 0 && <ActivityList items={act.data} />}
              </TabsContent>
            </Tabs>
          </CardContent></Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-[100px]">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <Row label="Status"><Select aria-label="Status" value={b.status} onChange={(v) => update.mutate({ status: v })} options={opts(settings.statuses)} disabled={!edit || update.isPending} /></Row>
              <Row label="Priority"><Select aria-label="Priority" value={b.priority} onChange={(v) => update.mutate({ priority: v })} options={opts(settings.priorities)} disabled={!edit || update.isPending} /></Row>
              <Row label="Severity"><Select aria-label="Severity" value={b.severity} onChange={(v) => update.mutate({ severity: v })} options={opts(settings.severities)} disabled={!edit || update.isPending} /></Row>
              <Row label="Assignee">
                {edit ? <AssigneeSelect aria-label="Assignee" value={b.assignee ? String(b.assignee.id) : ''} projectId={b.project ? String(b.project.id) : undefined} onChange={(v) => update.mutate({ assignee_id: Number(v || 0) })} disabled={update.isPending} /> : <UserChip user={b.assignee} />}
              </Row>
              <Row label="Reporter"><UserChip user={b.reporter} empty="Unknown" /></Row>
              <Row label="Project">{b.project ? <Link to={`/projects/${b.project.id}`} className="inline-flex items-center gap-1.5 hover:text-primary hover:underline"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: b.project.color }} />{b.project.name}</Link> : '—'}</Row>
              <Row label="Component">{b.component || '—'}</Row>
              <Row label="Version">{b.version || '—'}</Row>
              <Row label="Due date">
                <span className={isOverdue(b.due_date) && !settings.statuses.some((s) => s.slug === b.status && ['resolved', 'closed'].includes(s.category)) ? 'inline-flex items-center gap-1 text-destructive' : 'inline-flex items-center gap-1'}>
                  {b.due_date && <CalendarClock className="h-3.5 w-3.5" />}{formatDueDate(b.due_date)}
                </span>
              </Row>
              <Row label="Created">{formatDateTime(b.created_at)}</Row>
              <Row label="Updated">{formatDateTime(b.updated_at)}</Row>
              {b.resolved_at && <Row label="Resolved">{formatDate(b.resolved_at)}</Row>}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
