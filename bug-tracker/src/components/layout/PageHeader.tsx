import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useHeaderSlots } from './HeaderSlots';

export interface Crumb { label: ReactNode; to?: string }

/**
 * Renders nothing in place: breadcrumbs/title go to the left of the top bar and
 * `actions` to its right, so every page gets one compact 44px header.
 */
export function PageHeader({ title, crumbs, actions }: { title: ReactNode; description?: ReactNode; crumbs?: Crumb[]; actions?: ReactNode }) {
  const { left, right } = useHeaderSlots();
  const trail = crumbs && crumbs.length > 0 ? crumbs : null;
  return (
    <>
      {left && createPortal(
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-[13px]">
          {trail ? (
            <>
              {trail.map((c, i) => (
                <span key={i} className="flex min-w-0 items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
                  {c.to ? <Link to={c.to} className="text-muted-foreground hover:text-foreground">{c.label}</Link> : <span className="truncate font-medium" aria-current="page">{c.label}</span>}
                </span>
              ))}
            </>
          ) : <h1 className="truncate font-medium">{title}</h1>}
        </nav>, left)}
      {right && actions ? createPortal(<div className="flex items-center gap-1.5">{actions}</div>, right) : null}
    </>
  );
}

/** Standard padded content area for non-list pages. */
export const PageBody = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`mx-auto w-full max-w-[1240px] p-4 ${className}`}>{children}</div>
);
