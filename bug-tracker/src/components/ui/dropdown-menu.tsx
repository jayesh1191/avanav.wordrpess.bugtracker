import * as M from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/utils/cn';
import { portalContainer } from './portal';

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;
export const DropdownMenuSub = M.Sub;
export const DropdownMenuSeparator = ({ className, ...p }: ComponentPropsWithoutRef<typeof M.Separator>) => (
  <M.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...p} />
);
export const DropdownMenuLabel = ({ className, ...p }: ComponentPropsWithoutRef<typeof M.Label>) => (
  <M.Label className={cn('px-2 py-1.5 text-xs font-semibold text-muted-foreground', className)} {...p} />
);

const panel = 'z-[99002] min-w-[11rem] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg animate-bt-fade';
const item = 'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50 data-[disabled]:pointer-events-none';

export const DropdownMenuContent = ({ className, align = 'end', ...p }: ComponentPropsWithoutRef<typeof M.Content>) => (
  <M.Portal container={portalContainer()}>
    <M.Content align={align} sideOffset={4} collisionPadding={8} className={cn(panel, className)} {...p} />
  </M.Portal>
);
export const DropdownMenuItem = ({ className, destructive, ...p }: ComponentPropsWithoutRef<typeof M.Item> & { destructive?: boolean }) => (
  <M.Item className={cn(item, destructive && 'text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive', className)} {...p} />
);
export const DropdownMenuCheckItem = ({ className, children, checked, ...p }: ComponentPropsWithoutRef<typeof M.CheckboxItem>) => (
  <M.CheckboxItem checked={checked} className={cn(item, 'pl-7', className)} {...p}>
    <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
      <M.ItemIndicator><Check className="h-4 w-4" /></M.ItemIndicator>
    </span>
    {children}
  </M.CheckboxItem>
);
export const DropdownMenuSubTrigger = ({ className, children, ...p }: ComponentPropsWithoutRef<typeof M.SubTrigger>) => (
  <M.SubTrigger className={cn(item, 'data-[state=open]:bg-accent', className)} {...p}>
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </M.SubTrigger>
);
export const DropdownMenuSubContent = ({ className, ...p }: ComponentPropsWithoutRef<typeof M.SubContent>) => (
  <M.Portal container={portalContainer()}>
    <M.SubContent collisionPadding={8} className={cn(panel, className)} {...p} />
  </M.Portal>
);
