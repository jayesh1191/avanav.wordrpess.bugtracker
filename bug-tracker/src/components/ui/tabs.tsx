import * as T from '@radix-ui/react-tabs';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/utils/cn';

export const Tabs = T.Root;
export const TabsList = ({ className, ...p }: ComponentPropsWithoutRef<typeof T.List>) => (
  <T.List className={cn('flex gap-1 overflow-x-auto border-b border-border', className)} {...p} />
);
export const TabsTrigger = ({ className, ...p }: ComponentPropsWithoutRef<typeof T.Trigger>) => (
  <T.Trigger
    className={cn('whitespace-nowrap px-3 py-2 text-sm font-medium text-muted-foreground border-b-2 border-transparent -mb-px hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground', className)}
    {...p}
  />
);
export const TabsContent = ({ className, ...p }: ComponentPropsWithoutRef<typeof T.Content>) => (
  <T.Content className={cn('mt-4 focus-visible:outline-none', className)} {...p} />
);
