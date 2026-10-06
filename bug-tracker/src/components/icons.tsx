import type { StatusCategory } from '@/types';

/** Linear-style state glyphs: shape = workflow category, colour = configured colour. */
export function StatusIcon({ category, color, size = 14 }: { category: StatusCategory; color: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 14 14', fill: 'none', 'aria-hidden': true, className: 'shrink-0' } as const;
  switch (category) {
    case 'in_progress':
      return (<svg {...common}><circle cx="7" cy="7" r="5.75" stroke={color} strokeWidth="1.5" /><path d="M7 3.25a3.75 3.75 0 0 1 0 7.5z" fill={color} /></svg>);
    case 'resolved':
      return (<svg {...common}><circle cx="7" cy="7" r="6.5" fill={color} /><path d="M4.2 7.2l2 2 3.6-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
    case 'closed':
      return (<svg {...common}><circle cx="7" cy="7" r="6.5" fill={color} /><path d="M4.9 4.9l4.2 4.2M9.1 4.9L4.9 9.1" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" /></svg>);
    default:
      return (<svg {...common}><circle cx="7" cy="7" r="5.75" stroke={color} strokeWidth="1.5" /></svg>);
  }
}

/** Ascending bars (low→high); the highest level becomes a red alert square. */
export function PriorityIcon({ index, count, color, size = 14 }: { index: number; count: number; color: string; size?: number }) {
  if (count > 1 && index === count - 1) {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden className="shrink-0">
        <rect x="1" y="1" width="12" height="12" rx="3" fill={color} />
        <path d="M7 3.8v4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /><circle cx="7" cy="10.1" r=".95" fill="#fff" />
      </svg>
    );
  }
  const filled = count <= 1 ? 1 : Math.min(3, 1 + Math.floor((index * 3) / (count - 1)));
  const off = 'currentColor';
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden className="shrink-0">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={1.5 + i * 4.3} y={9 - i * 3.5} width="3" height={4 + i * 3.5} rx="0.8" fill={i < filled ? color : off} opacity={i < filled ? 1 : 0.2} />
      ))}
    </svg>
  );
}
