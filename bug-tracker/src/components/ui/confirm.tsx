import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Button } from './button';
import { Dialog, DialogContent } from './dialog';

interface Options { title: string; description?: string; confirmLabel?: string; destructive?: boolean }
type Confirm = (o: Options) => Promise<boolean>;
const Ctx = createContext<Confirm | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<Options | null>(null);
  const resolver = useRef<(v: boolean) => void>();
  const confirm = useCallback<Confirm>((o) => new Promise((resolve) => { resolver.current = resolve; setOpts(o); }), []);
  const close = (v: boolean) => { resolver.current?.(v); resolver.current = undefined; setOpts(null); };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Dialog open={!!opts} onOpenChange={(o) => !o && close(false)}>
        {opts && (
          <DialogContent title={opts.title} description={opts.description} className="max-w-md">
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button variant={opts.destructive ? 'destructive' : 'default'} onClick={() => close(true)}>{opts.confirmLabel ?? 'Confirm'}</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </Ctx.Provider>
  );
}
export function useConfirm() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useConfirm outside ConfirmProvider');
  return v;
}
