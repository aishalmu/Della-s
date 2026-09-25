import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { NAV, type PageId } from './constants';
import { clamp, midnight, parse, ymd } from './dates';
import { useStore } from './store';

interface NavState {
  page: PageId;
  setPage: (p: PageId) => void;
  /** Selected day, YYYY-MM-DD, always inside the planner range. */
  day: string;
  D: Date;
  setDay: (d: Date) => void;
  openDay: (k: string) => void;
  /** Real today at midnight (may fall outside the planner range). */
  today: Date;
  /** Key of today clamped into the planner range. */
  todayKey: string;
  now: Date;
  trip: number;
  setTrip: (i: number) => void;
}

const NavContext = createContext<NavState | null>(null);
const isPage = (p: unknown): p is PageId => NAV.some(([id]) => id === p);

export function NavProvider({ children }: { children: ReactNode }) {
  const { data, set } = useStore();
  const [now, setNow] = useState(() => new Date());
  const [day, setDayKey] = useState(() => ymd(clamp(midnight(new Date()))));
  const [trip, setTrip] = useState(0);
  const page: PageId = isPage(data.__page) ? data.__page : 'home';

  // Keep "today" right when the iPad app is left open overnight.
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const setPage = useCallback((p: PageId) => set('__page', p), [set]);
  const setDay = useCallback((d: Date) => setDayKey(ymd(clamp(midnight(d)))), []);
  const openDay = useCallback(
    (k: string) => {
      setDayKey(ymd(clamp(parse(k))));
      set('__page', 'day');
    },
    [set],
  );

  const today = midnight(now);
  const todayKey = ymd(clamp(today));
  const value = useMemo(
    () => ({ page, setPage, day, D: parse(day), setDay, openDay, today, todayKey, now, trip, setTrip }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, setPage, day, setDay, openDay, todayKey, now, trip],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavState {
  const n = useContext(NavContext);
  if (!n) throw new Error('useNav must be used inside NavProvider');
  return n;
}
