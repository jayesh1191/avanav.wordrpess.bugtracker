import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { portalContainer } from './portal';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ className, children, title, description }: { className?: string; children: ReactNode; title: string; description?: string }) {
  return (
    <D.Portal container={portalContainer()}>
      <D.Overlay className="fixed inset-0 z-[99000] bg-black/50 animate-bt-fade" />
      <D.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-[99001] w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card text-card-foreground p-4 shadow-2xl animate-bt-pop',
          className,
        )}
      >
        <div className="mb-3 pr-6">
          <D.Title className="text-[14px] font-semibold">{title}</D.Title>
          {description ? <D.Description className="mt-1 text-sm text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
        </div>
        {children}
        <D.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground" aria-label="Close">
          <X className="h-4 w-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
