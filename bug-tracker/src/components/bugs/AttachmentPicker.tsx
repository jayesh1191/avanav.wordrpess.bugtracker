import { useRef } from 'react';
import { File as FileIcon, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/store/app';
import { formatBytes } from '@/utils/format';

export const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'txt', 'log', 'csv', 'json', 'zip', 'doc', 'docx', 'xls', 'xlsx', 'mp4', 'webm'];

/** Returns an error message for an unacceptable file, or null. */
export function useFileValidator() {
  const { settings } = useApp();
  const maxMb = Math.min(settings?.project.max_attachment_mb ?? 10, settings?.limits.server_max_upload_mb ?? 10);
  return (f: File): string | null => {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXT.includes(ext)) return `${f.name}: .${ext} files are not allowed`;
    if (f.size > maxMb * 1048576) return `${f.name}: larger than ${maxMb} MB`;
    return null;
  };
}

export function AttachmentPicker({ files, onChange, onError, disabled }: { files: File[]; onChange: (f: File[]) => void; onError: (m: string) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const validate = useFileValidator();
  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      const err = validate(f);
      if (err) onError(err);
      else next.push(f);
    }
    onChange(next);
    if (input.current) input.current.value = '';
  };
  return (
    <div>
      <input ref={input} type="file" multiple hidden onChange={(e) => add(e.target.files)} accept={ALLOWED_EXT.map((e) => '.' + e).join(',')} />
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (!disabled) add(e.dataTransfer.files); }}
        className="flex flex-col items-center gap-2 rounded-md border border-dashed border-input p-4 text-center text-sm text-muted-foreground"
      >
        <Paperclip className="h-5 w-5" />
        <span>Drag files here or</span>
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={disabled}>Choose files</Button>
      </div>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-sm">
              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
