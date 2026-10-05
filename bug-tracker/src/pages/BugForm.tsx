import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { BugsApi } from '@/api/endpoints';
import { ApiError } from '@/api/client';
import type { Attachment, BugDetail } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm';
import { AttachmentPicker } from '@/components/bugs/AttachmentPicker';
import { AttachmentList } from '@/components/bugs/AttachmentList';
import { AssigneeSelect } from '@/components/UserSelect';
import { useApp } from '@/store/app';
import { useBug, useInvalidateBugs, useProjects } from '@/hooks/useData';

const schema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(255, 'Title must be 255 characters or fewer'),
  description: z.string().max(50000),
  steps_to_reproduce: z.string().max(50000),
  expected_result: z.string().max(50000),
  actual_result: z.string().max(50000),
  status: z.string().min(1, 'Select a status'),
  priority: z.string().min(1, 'Select a priority'),
  severity: z.string().min(1, 'Select a severity'),
  project_id: z.string().min(1, 'Select a project'),
  component: z.string().max(190, 'Too long'),
  version: z.string().max(100, 'Too long'),
  assignee_id: z.string(),
  environment: z.string().max(50000),
  browser: z.string().max(255, 'Too long'),
  due_date: z.string().refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Enter a valid date'),
});
type FormValues = z.infer<typeof schema>;

function BugFormInner({ bug }: { bug?: BugDetail }) {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const invalidate = useInvalidateBugs();
  const qc = useQueryClient();
  const { settings } = useApp();
  const projects = useProjects({ status: 'active' });
  const [files, setFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState<Attachment[]>(bug?.attachments ?? []);
  const [submitting, setSubmitting] = useState(false);

  const statuses = settings?.statuses ?? [];
  const priorities = settings?.priorities ?? [];
  const severities = settings?.severities ?? [];
  const defaults: FormValues = {
    title: bug?.title ?? '',
    description: bug?.description ?? '',
    steps_to_reproduce: bug?.steps_to_reproduce ?? '',
    expected_result: bug?.expected_result ?? '',
    actual_result: bug?.actual_result ?? '',
    status: bug?.status ?? statuses.find((s) => s.category === 'open')?.slug ?? statuses[0]?.slug ?? '',
    priority: bug?.priority ?? priorities[Math.min(1, priorities.length - 1)]?.slug ?? '',
    severity: bug?.severity ?? severities[Math.min(1, severities.length - 1)]?.slug ?? '',
    project_id: bug?.project ? String(bug.project.id) : sp.get('project_id') ?? '',
    component: bug?.component ?? '',
    version: bug?.version ?? '',
    assignee_id: bug?.assignee ? String(bug.assignee.id) : '',
    environment: bug?.environment ?? '',
    browser: bug?.browser ?? '',
    due_date: bug?.due_date ?? '',
  };
  const { register, control, handleSubmit, watch, setError, formState: { errors, isDirty } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const projectId = watch('project_id');
  const err = (k: keyof FormValues) => errors[k]?.message as string | undefined;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const payload = { ...values, project_id: Number(values.project_id), assignee_id: Number(values.assignee_id || 0) };
      const saved = bug ? await BugsApi.update(bug.id, payload) : await BugsApi.create(payload);
      const failed: string[] = [];
      for (const f of files) {
        try { await BugsApi.upload(saved.id, f); } catch (e) { failed.push(`${f.name}: ${(e as Error).message}`); }
      }
      invalidate();
      qc.removeQueries({ queryKey: ['bug', saved.id] });
      if (failed.length) toast.error('Bug saved, but some attachments failed', failed.join('\n'));
      else toast.success(bug ? 'Bug updated' : `Bug #${saved.id} created`);
      nav(`/bugs/${saved.id}`);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) {
        for (const [k, m] of Object.entries(e.fields)) setError(k as keyof FormValues, { message: m });
      }
      toast.error('Could not save the bug', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  });

  const removeExisting = async (a: Attachment) => {
    if (!(await confirm({ title: 'Remove attachment?', description: a.file_name, confirmLabel: 'Remove', destructive: true }))) return;
    try { await BugsApi.removeAttachment(a.id); setExisting((l) => l.filter((x) => x.id !== a.id)); invalidate(); }
    catch (e) { toast.error('Could not remove attachment', (e as Error).message); }
  };

  const opts = (l: { slug: string; label: string }[]) => l.map((i) => ({ value: i.slug, label: i.label }));
  const projectOpts = (projects.data ?? []).filter((p) => p.status === 'active' || String(p.id) === projectId).map((p) => ({ value: String(p.id), label: p.name }));

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        title={bug ? `Edit bug #${bug.id}` : 'Report a bug'}
        crumbs={bug ? [{ label: 'Bugs', to: '/bugs' }, { label: `#${bug.id}`, to: `/bugs/${bug.id}` }, { label: 'Edit' }] : [{ label: 'Bugs', to: '/bugs' }, { label: 'New bug' }]}
        actions={<>
          <Button type="button" variant="outline" onClick={async () => { if (isDirty && !(await confirm({ title: 'Discard changes?', description: 'Your unsaved changes will be lost.', confirmLabel: 'Discard', destructive: true }))) return; nav(bug ? `/bugs/${bug.id}` : '/bugs'); }}>Cancel</Button>
          <Button type="submit" loading={submitting}>{bug ? 'Save changes' : 'Create bug'}</Button>
        </>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card><CardContent className="space-y-4 pt-5">
            <Field label="Title *" htmlFor="title" error={err('title')}><Input id="title" maxLength={255} placeholder="Short, specific summary" aria-invalid={!!errors.title} {...register('title')} /></Field>
            <Field label="Description" htmlFor="description" error={err('description')}><Textarea id="description" rows={5} placeholder="What is going wrong?" {...register('description')} /></Field>
            <Field label="Steps to reproduce" htmlFor="steps" error={err('steps_to_reproduce')}><Textarea id="steps" rows={4} placeholder={'1. Go to…\n2. Click…'} {...register('steps_to_reproduce')} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Expected result" htmlFor="expected" error={err('expected_result')}><Textarea id="expected" rows={3} {...register('expected_result')} /></Field>
              <Field label="Actual result" htmlFor="actual" error={err('actual_result')}><Textarea id="actual" rows={3} {...register('actual_result')} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Environment" htmlFor="environment" error={err('environment')} hint="OS, WordPress/PHP version, plugins…"><Textarea id="environment" rows={2} {...register('environment')} /></Field>
              <Field label="Browser / device" htmlFor="browser" error={err('browser')}><Input id="browser" placeholder="Chrome 126 / iPhone 15" {...register('browser')} /></Field>
            </div>
          </CardContent></Card>

          <Card>
            <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {existing.length > 0 && <AttachmentList items={existing} canRemove onRemove={removeExisting} />}
              <AttachmentPicker files={files} onChange={setFiles} onError={(m) => toast.error('File not added', m)} disabled={submitting} />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit"><CardContent className="space-y-4 pt-5">
          <Field label="Project *" htmlFor="project" error={err('project_id')}>
            <Controller control={control} name="project_id" render={({ field }) => (
              <Select id="project" value={field.value} onChange={field.onChange} options={projectOpts} placeholder={projects.isLoading ? 'Loading…' : 'Select project'} invalid={!!errors.project_id} />
            )} />
            {!projects.isLoading && projectOpts.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No projects available. Ask a project manager to create or add you to one.</p>}
          </Field>
          <Field label="Status" htmlFor="status" error={err('status')}>
            <Controller control={control} name="status" render={({ field }) => <Select id="status" value={field.value} onChange={field.onChange} options={opts(statuses)} />} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority" htmlFor="priority" error={err('priority')}>
              <Controller control={control} name="priority" render={({ field }) => <Select id="priority" value={field.value} onChange={field.onChange} options={opts(priorities)} />} />
            </Field>
            <Field label="Severity" htmlFor="severity" error={err('severity')}>
              <Controller control={control} name="severity" render={({ field }) => <Select id="severity" value={field.value} onChange={field.onChange} options={opts(severities)} />} />
            </Field>
          </div>
          <Field label="Assignee" htmlFor="assignee" error={err('assignee_id')}>
            <Controller control={control} name="assignee_id" render={({ field }) => <AssigneeSelect id="assignee" value={field.value} onChange={field.onChange} projectId={projectId} />} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Component" htmlFor="component" error={err('component')}><Input id="component" {...register('component')} /></Field>
            <Field label="Version" htmlFor="version" error={err('version')}><Input id="version" {...register('version')} /></Field>
          </div>
          <Field label="Due date" htmlFor="due" error={err('due_date')}><Input id="due" type="date" {...register('due_date')} /></Field>
        </CardContent></Card>
      </div>
    </form>
  );
}

export default function BugForm() {
  const { id } = useParams();
  const bugId = Number(id) || 0;
  const { can, settings } = useApp();
  const q = useBug(bugId);

  if (!can('create_bug') && !bugId) return <EmptyState title="You can't report bugs" description="Your role does not include the create_bug capability." />;
  if (!settings) return <Skeleton className="h-96" />;
  if (bugId) {
    if (q.isError) return <Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>;
    if (q.isLoading || !q.data) return <Skeleton className="h-96" />;
    if (!q.data.can_edit) return <Card><EmptyState title="You can't edit this bug" description="You don't have permission to edit it." /></Card>;
    return <BugFormInner key={q.data.updated_at} bug={q.data} />;
  }
  return <BugFormInner />;
}
