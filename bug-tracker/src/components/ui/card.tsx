import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-md border border-border bg-card text-card-foreground', className)} {...p} />
);
export const CardHeader = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-0.5 px-3.5 pt-3 pb-1.5', className)} {...p} />
);
export const CardTitle = ({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-[13px] font-semibold leading-5', className)} {...p} />
);
export const CardDescription = ({ className, ...p }: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-xs text-muted-foreground', className)} {...p} />
);
export const CardContent = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-3.5 pb-3 pt-1.5', className)} {...p} />
);
