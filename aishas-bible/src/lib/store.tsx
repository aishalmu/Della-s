import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/** One flat key/value object, same schema as the design reference. */
export type Data = Record<string, unknown>;

export const STORAGE_KEY = 'aisha-bible-v1';
const SAVE_DELAY_MS = 300;

export function loadData(): Data {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveData(data: Data): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export const str = (v: unknown) => (v == null ? '' : String(v));
export const num = (v: unknown) => parseFloat(str(v)) || 0;

interface Store {
  data: Data;
  set: (k: string, v: unknown) => void;
  toggle: (k: string) => void;
  replaceAll: (data: Data) => void;
  /** False when the last save to the device failed (for example, storage is full). */
  saved: boolean;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(loadData);
  const [saved, setSaved] = useState(true);
  const latest = useRef(data);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(() => {
    if (timer.current === undefined) return;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    setSaved(saveData(latest.current));
  }, []);

  // Typing writes on every keystroke; batch those into one save per pause,
  // and flush right away when the app is hidden or closed.
  useEffect(() => {
    latest.current = data;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
  }, [data, flush]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  const set = useCallback((k: string, v: unknown) => setData((d) => ({ ...d, [k]: v })), []);
  const toggle = useCallback((k: string) => setData((d) => ({ ...d, [k]: !d[k] })), []);
  const replaceAll = useCallback((next: Data) => {
    latest.current = next;
    setSaved(saveData(next));
    setData(next);
  }, []);

  const value = useMemo(() => ({ data, set, toggle, replaceAll, saved }), [data, set, toggle, replaceAll, saved]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
