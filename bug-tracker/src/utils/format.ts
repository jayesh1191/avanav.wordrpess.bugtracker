import { format, formatDistanceToNowStrict, parseISO, isValid } from 'date-fns';

const parse = (v?: string | null) => {
  if (!v) return null;
  const d = parseISO(v);
  return isValid(d) ? d : null;
};
export const formatDate = (v?: string | null) => { const d = parse(v); return d ? format(d, 'MMM d, yyyy') : '—'; };
export const formatDateTime = (v?: string | null) => { const d = parse(v); return d ? format(d, 'MMM d, yyyy h:mm a') : '—'; };
export const timeAgo = (v?: string | null) => { const d = parse(v); return d ? `${formatDistanceToNowStrict(d)} ago` : '—'; };
/** Due dates are plain dates: parse as local to avoid TZ shifts. */
export const formatDueDate = (v?: string | null) => (v ? format(new Date(v + 'T00:00:00'), 'MMM d, yyyy') : '—');
export const isOverdue = (v?: string | null) => !!v && new Date(v + 'T23:59:59') < new Date();
export const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
};
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?';

/** Prevent CSV/formula injection when opened in spreadsheet software. */
const csvCell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};
export function downloadCsv(filename: string, rows: unknown[][]) {
  const blob = new Blob(['﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
