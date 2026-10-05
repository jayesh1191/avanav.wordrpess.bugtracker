import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export interface Crumb { label: string; to?: string }

export function PageHeader({ title, description, crumbs, actions }: { title: ReactNode; description?: ReactNode; crumbs?: Crumb[]; actions?: ReactNode }) {
  return (
    <div className="mb-5">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Bug Tracker</Link>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1 min-w-0">
              <ChevronRight className="h-3 w-3 shrink-0" />
              {c.to ? <Link to={c.to} className="hover:text-foreground">{c.label}</Link> : <span className="text-foreground truncate max-w-[18rem]" aria-current="page">{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight break-words">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
