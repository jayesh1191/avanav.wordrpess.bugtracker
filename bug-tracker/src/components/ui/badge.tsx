import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export function Badge({ className, color, style, ...p }: HTMLAttributes<HTMLSpanElement> & { color?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', !color && 'bg-secondary text-secondary-foreground', className)}
      style={color ? { backgroundColor: `${color}26`, color, ...style } : style}
      {...p}
    />
  );
}
