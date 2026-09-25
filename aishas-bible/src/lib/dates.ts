import { END, MN, DN, PROMPTS, START } from './constants';

export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const ym = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1);
export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
/** Monday of the week containing d. */
export const monday = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
export const clamp = (d: Date) => (d < START ? new Date(START) : d > END ? new Date(END) : d);
export const midnight = (d: Date) => {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t;
};
/** Day of year, 1-based. */
export const doy = (d: Date) => Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 864e5);
export const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** Blank cells before day 1 in a Monday-first grid. */
export const leadBlanks = (y: number, m: number) => (new Date(y, m, 1).getDay() + 6) % 7;
/** Whole days from a to b, safe across clock changes. */
export const daysBetween = (a: Date, b: Date) => Math.round((midnight(b).getTime() - midnight(a).getTime()) / 864e5);

export const weekdayName = (d: Date) => DN[(d.getDay() + 6) % 7];
export const shortDate = (d: Date) => d.getDate() + ' ' + MN[d.getMonth()].slice(0, 3);
export const longDate = (d: Date) => weekdayName(d) + ' ' + d.getDate() + ' ' + MN[d.getMonth()] + ' ' + d.getFullYear();
export const monthLabel = (d: Date) => MN[d.getMonth()] + ' ' + d.getFullYear();
export const weekLabel = (d: Date) => {
  const mon = monday(d);
  const sun = addDays(mon, 6);
  return shortDate(mon) + ' – ' + shortDate(sun) + ' ' + sun.getFullYear();
};
export const promptFor = (d: Date) => PROMPTS[doy(d) % PROMPTS.length];
export const greeting = (now: Date) => {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

/** Every month in the planner range, as first-of-month dates. */
export const plannerMonths = () => {
  const n = (END.getFullYear() - START.getFullYear()) * 12 + END.getMonth() - START.getMonth() + 1;
  return Array.from({ length: n }, (_, i) => new Date(START.getFullYear(), START.getMonth() + i, 1));
};
/** "September 2026 – December 2027" */
export const rangeLabel = () => monthLabel(START) + ' – ' + monthLabel(END);
/** "Sep 26 — Dec 27", for the sidebar stamp. */
export const stampLabel = () => {
  const s = (d: Date) => MN[d.getMonth()].slice(0, 3) + ' ' + String(d.getFullYear()).slice(2);
  return s(START) + ' — ' + s(END);
};
