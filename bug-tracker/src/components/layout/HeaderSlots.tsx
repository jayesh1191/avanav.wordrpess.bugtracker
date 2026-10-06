import { createContext, useContext, useState, type ReactNode } from 'react';

interface Slots { left: HTMLElement | null; right: HTMLElement | null; setLeft: (e: HTMLElement | null) => void; setRight: (e: HTMLElement | null) => void }
const Ctx = createContext<Slots | null>(null);

/** Lets each page portal its title/breadcrumbs/actions into the single top bar. */
export function HeaderSlotsProvider({ children }: { children: ReactNode }) {
  const [left, setLeft] = useState<HTMLElement | null>(null);
  const [right, setRight] = useState<HTMLElement | null>(null);
  return <Ctx.Provider value={{ left, right, setLeft, setRight }}>{children}</Ctx.Provider>;
}
export const useHeaderSlots = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('HeaderSlotsProvider missing');
  return v;
};
