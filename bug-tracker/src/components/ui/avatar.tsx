import { useState } from 'react';
import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';
import type { UserRef } from '@/types';

export function Avatar({ user, size = 28, className }: { user: Pick<UserRef, 'name' | 'avatar'> | null; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38) };
  if (!user) return <span className={cn('inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground shrink-0', className)} style={style}>?</span>;
  if (!user.avatar || failed)
    return <span className={cn('inline-flex items-center justify-center rounded-full bg-accent text-accent-foreground font-medium shrink-0', className)} style={style}>{initials(user.name)}</span>;
  return <img src={user.avatar} alt="" onError={() => setFailed(true)} className={cn('rounded-full object-cover shrink-0 bg-muted', className)} style={{ width: size, height: size }} />;
}
