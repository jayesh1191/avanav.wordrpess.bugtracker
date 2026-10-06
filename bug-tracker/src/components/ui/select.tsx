import * as S from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { portalContainer } from './portal';

export interface Option { value: string; label: ReactNode; textValue?: string }
const NONE = '__none__';

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  /** When set, an extra first option with an empty value is shown. */
  emptyLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  invalid?: boolean;
  'aria-label'?: string;
  triggerClassName?: string;
  /** Borderless until hovered – used for inline property editing. */
  ghost?: boolean;
}

export function Select({ value, onChange, options, placeholder = 'Select…', emptyLabel, disabled, id, className, invalid, triggerClassName, ghost, ...rest }: Props) {
  const all: Option[] = emptyLabel ? [{ value: NONE, label: emptyLabel }, ...options] : options;
  return (
    <S.Root value={value === '' && emptyLabel ? NONE : value} onValueChange={(v) => onChange(v === NONE ? '' : v)} disabled={disabled}>
      <S.Trigger
        id={id}
        aria-label={rest['aria-label']}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-2 rounded-md border bg-background px-2.5 text-[13px] text-left data-[placeholder]:text-muted-foreground focus:ring-2 focus:ring-ring/25 focus:border-ring disabled:opacity-60 disabled:cursor-not-allowed',
          ghost ? 'h-7 border-transparent bg-transparent px-1.5 hover:bg-accent disabled:hover:bg-transparent disabled:opacity-100' : 'border-input hover:border-muted-foreground/40',
          invalid && 'border-destructive',
          className,
          triggerClassName,
        )}
      >
        <span className="truncate min-w-0"><S.Value placeholder={placeholder} /></span>
        {!(ghost && disabled) && <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />}
      </S.Trigger>
      <S.Portal container={portalContainer()}>
        <S.Content position="popper" sideOffset={4} collisionPadding={8}
          className="z-[99003] min-w-[var(--radix-select-trigger-width)] max-h-[min(20rem,var(--radix-select-content-available-height))] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg animate-bt-fade">
          <S.Viewport className="p-1">
            {all.map((o) => (
              <S.Item key={o.value} value={o.value} textValue={o.textValue}
                className="relative flex cursor-pointer select-none items-center rounded-sm py-1 pl-7 pr-2 text-[13px] outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                <span className="absolute left-2 flex h-4 w-4 items-center justify-center"><S.ItemIndicator><Check className="h-4 w-4" /></S.ItemIndicator></span>
                <S.ItemText>{o.label}</S.ItemText>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
