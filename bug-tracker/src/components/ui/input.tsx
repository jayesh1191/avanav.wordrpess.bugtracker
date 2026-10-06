import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

const field =
  'w-full rounded-md border border-input bg-background text-foreground text-[13px] shadow-none placeholder:text-muted-foreground/80 hover:border-muted-foreground/40 focus:border-ring focus:ring-2 focus:ring-ring/25 disabled:opacity-55 disabled:cursor-not-allowed aria-[invalid=true]:border-destructive';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(field, 'h-8 px-2.5 py-1 min-h-0 leading-normal', className)} {...p} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(field, 'min-h-[72px] px-2.5 py-1.5 leading-normal resize-y', className)} {...p} />
));
Textarea.displayName = 'Textarea';

export const Label = ({ className, ...p }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn('text-xs font-medium text-muted-foreground leading-none block mb-1', className)} {...p} />
);

export function Field({ label, htmlFor, error, hint, children, className }: {
  label?: string; htmlFor?: string; error?: string; hint?: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
