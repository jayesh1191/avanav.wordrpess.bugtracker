import { Download, File as FileIcon, Trash2 } from 'lucide-react';
import type { Attachment } from '@/types';
import { formatBytes } from '@/utils/format';

export function AttachmentList({ items, onRemove, canRemove }: { items: Attachment[]; onRemove?: (a: Attachment) => void; canRemove?: boolean }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((a) => (
        <li key={a.id} className="flex items-center gap-3 rounded-md border border-border p-2.5">
          {a.is_image ? (
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="shrink-0"><img src={a.url} alt={a.file_name} className="h-12 w-12 rounded object-cover bg-muted" loading="lazy" /></a>
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground"><FileIcon className="h-5 w-5" /></span>
          )}
          <div className="min-w-0 flex-1">
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium hover:text-primary hover:underline">{a.file_name}</a>
            <span className="text-xs text-muted-foreground">{formatBytes(a.size)}{a.user ? ` · ${a.user.name}` : ''}</span>
          </div>
          <a href={a.url} download={a.file_name} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label={`Download ${a.file_name}`}><Download className="h-4 w-4" /></a>
          {canRemove && onRemove && (
            <button type="button" onClick={() => onRemove(a)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Remove ${a.file_name}`}><Trash2 className="h-4 w-4" /></button>
          )}
        </li>
      ))}
    </ul>
  );
}
