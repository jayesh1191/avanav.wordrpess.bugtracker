import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
export const Skeleton = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div aria-hidden className={cn('animate-pulse rounded-md bg-muted', className)} {...p} />
);
