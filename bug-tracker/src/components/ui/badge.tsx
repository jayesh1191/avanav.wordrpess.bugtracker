import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export function Badge({ className, color, style, ...p }: HTMLAttributes<HTMLSpanElement> & { color?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded px-1.5 py-px text-[11px] font-medium leading-4 whitespace-nowrap', !color && 'bg-secondary text-secondary-foreground', className)}
      style={color ? { backgroundColor: `${color}1f`, color, ...style } : style}
      {...p}
    />
  );
}
