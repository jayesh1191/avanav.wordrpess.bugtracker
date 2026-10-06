import * as C from '@radix-ui/react-checkbox';
import * as SW from '@radix-ui/react-switch';
import { Check, Minus } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/utils/cn';

export const Checkbox = ({ className, checked, ...p }: ComponentPropsWithoutRef<typeof C.Root>) => (
  <C.Root
    checked={checked}
    className={cn('flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border border-input bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary text-primary-foreground disabled:opacity-50', className)}
    {...p}
  >
    <C.Indicator>{checked === 'indeterminate' ? <Minus className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />}</C.Indicator>
  </C.Root>
);

export const Switch = ({ className, ...p }: ComponentPropsWithoutRef<typeof SW.Root>) => (
  <SW.Root className={cn('relative inline-flex h-4 w-7 shrink-0 items-center rounded-full bg-input data-[state=checked]:bg-primary transition-colors disabled:opacity-50', className)} {...p}>
    <SW.Thumb className="block h-3 w-3 rounded-full bg-white shadow translate-x-0.5 data-[state=checked]:translate-x-[14px] transition-transform" />
  </SW.Root>
);
