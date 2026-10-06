import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuCheckItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/utils/cn';

export interface FilterOption { value: string; label: ReactNode; text?: string }

/** Compact filter chip: dashed when idle, solid with a summary when active. */
export function FilterMenu({ label, icon, options, value, onChange, multi = true }: {
  label: string; icon?: ReactNode; options: FilterOption[]; value: string[]; onChange: (v: string[]) => void; multi?: boolean;
}) {
  const active = value.length > 0;
  const first = options.find((o) => o.value === value[0]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Filter by ${label.toLowerCase()}`}
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors',
          active ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15' : 'border-dashed border-input text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        {icon}
        <span>{label}</span>
        {active && (
          <span className="max-w-[9rem] truncate border-l border-current/25 pl-1.5">
            {first?.text ?? label}{value.length > 1 && ` +${value.length - 1}`}
          </span>
        )}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 min-w-[12rem]">
        {options.map((o) => {
          const on = value.includes(o.value);
          return multi ? (
            <DropdownMenuCheckItem key={o.value} checked={on} onSelect={(e) => e.preventDefault()}
              onCheckedChange={(c) => onChange(c ? [...value, o.value] : value.filter((v) => v !== o.value))}>
              <span className="flex min-w-0 items-center gap-2">{o.label}</span>
            </DropdownMenuCheckItem>
          ) : (
            <DropdownMenuCheckItem key={o.value} checked={on} onCheckedChange={() => onChange(on ? [] : [o.value])}>
              <span className="flex min-w-0 items-center gap-2">{o.label}</span>
            </DropdownMenuCheckItem>
          );
        })}
        {active && (<><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => onChange([])}>Clear</DropdownMenuItem></>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
