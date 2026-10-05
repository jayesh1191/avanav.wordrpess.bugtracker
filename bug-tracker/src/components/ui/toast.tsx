import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/utils/cn';

interface Toast { id: number; title: string; description?: string; variant: 'success' | 'error' }
interface Api { success: (title: string, description?: string) => void; error: (title: string, description?: string) => void }
const Ctx = createContext<Api | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((variant: Toast['variant'], title: string, description?: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, title, description, variant }]);
    setTimeout(() => dismiss(id), variant === 'error' ? 7000 : 4000);
  }, [dismiss]);
  const api = useMemo<Api>(() => ({ success: (t, d) => push('success', t, d), error: (t, d) => push('error', t, d) }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[99100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.variant === 'error' ? 'alert' : 'status'}
            className={cn('flex items-start gap-3 rounded-lg border bg-card p-3 shadow-lg animate-bt-slide', t.variant === 'error' ? 'border-destructive/50' : 'border-border')}>
            {t.variant === 'error' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-muted-foreground break-words">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast outside ToastProvider');
  return v;
}
