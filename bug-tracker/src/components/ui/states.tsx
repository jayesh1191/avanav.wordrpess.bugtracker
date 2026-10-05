import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';
import { cn } from '@/utils/cn';

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertTriangle className="h-6 w-6" /></div>
      <h3 className="text-sm font-semibold">Couldn't load this</h3>
      <p className="max-w-md text-sm text-muted-foreground break-words">{message}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Try again</Button>}
    </div>
  );
}

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn('h-4 w-4 animate-spin', className)} aria-label="Loading" />;
