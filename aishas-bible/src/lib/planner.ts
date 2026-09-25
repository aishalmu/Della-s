import { CATS } from './constants';
import { daysBetween, daysInMonth, parse, ymd } from './dates';
import { num, str, type Data } from './store';

export interface DayInfo {
  ev: string[];
  pr: string[];
  sch: string[];
}

/** Celebrations (repeat yearly by MM-DD), top three and schedule lines for one date. */
export function dayInfo(data: Data, k: string): DayInfo {
  const md = k.slice(5);
  const ev: string[] = [];
  const pr: string[] = [];
  const sch: string[] = [];
  for (let i = 0; i < 3; i++) {
    const t = str(data[`ev:${md}:${i}`]).trim();
    if (t) {
      const ty = str(data[`ev:${md}:${i}:type`]);
      ev.push(ty ? ty + ' · ' + t : t);
    }
    const p = str(data[`d:${k}:p${i}`]).trim();
    if (p) pr.push(p);
  }
  for (let h = 7; h < 22; h++) {
    const s = str(data[`d:${k}:h${h}`]).trim();
    if (s) sch.push(h + ':00 ' + s);
  }
  return { ev, pr, sch };
}

export function pilatesCount(data: Data, y: number, m: number) {
  let c = 0;
  for (let d = 1; d <= daysInMonth(y, m); d++) if (data['pl:' + ymd(new Date(y, m, d))]) c++;
  return c;
}

export const BOOK_ROWS = 20;
export const bookKeys = (i: number) => {
  const p = 'bk' + i + ':';
  return { t: p + 't', a: p + 'a', g: p + 'g', f: p + 'f', s: p + 's', r: p + 'r' };
};

export function readingSummary(data: Data) {
  const books = Array.from({ length: BOOK_ROWS }, (_, i) => bookKeys(i));
  const finished = books.filter((b) => data[b.s] === 'Finished').length;
  const goal = num(data['rd:goal']) || 24;
  const current = books.filter((b) => data[b.s] === 'Reading').map((b) => str(data[b.t])).filter(Boolean);
  return {
    finished,
    goal,
    current: current[0] || 'Pick your next book',
    pct: Math.min(100, Math.round((finished / goal) * 100)),
    list: current.join(' · ') || 'Nothing on the go',
  };
}

export function tripCountdown(dep: string, today: Date) {
  if (!dep) return 'Add a departure date';
  const n = daysBetween(today, parse(dep));
  return n > 0 ? n + (n === 1 ? ' day to go' : ' days to go') : n === 0 ? 'Departing today' : 'Trip complete';
}

export function nextTrip(data: Data, today: Date) {
  let best: { n: number; name: string } | null = null;
  for (let i = 0; i < 4; i++) {
    const d = str(data['tr' + i + ':dep']);
    if (!d) continue;
    const n = daysBetween(today, parse(d));
    if (n >= 0 && (!best || n < best.n)) best = { n, name: str(data['tr' + i + ':to']) || 'Trip ' + (i + 1) };
  }
  return best
    ? { name: best.name, when: best.n === 0 ? 'Departing today' : best.n + (best.n === 1 ? ' day to go' : ' days to go') }
    : { name: 'No trips booked yet', when: 'Add one in Travel' };
}

export function categoryIds(data: Data): number[] {
  const ids = data['bg:ids'];
  return Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isFinite(n)) : CATS.map((_, i) => i);
}

/** Next unused category id, never reusing one whose name is still stored. */
export function nextCategoryId(data: Data) {
  const used = Object.keys(data)
    .filter((k) => /^bg:cat\d+$/.test(k))
    .map((k) => +k.slice(6));
  return Math.max(-1, ...categoryIds(data), ...used, CATS.length - 1) + 1;
}

export function budgetSummary(data: Data, ymKey: string) {
  const inc = num(data[`bg:${ymKey}:inc`]);
  let planned = 0;
  let actual = 0;
  for (const i of categoryIds(data)) {
    planned += num(data[`bg:${ymKey}:p${i}`]);
    actual += num(data[`bg:${ymKey}:a${i}`]);
  }
  return { planned, actual, left: inc - actual };
}

export const money = (n: number) =>
  (n < 0 ? '−£' : '£') + (Math.round(Math.abs(n) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
