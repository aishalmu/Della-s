import { describe, expect, it } from 'vitest';
import { clamp, daysBetween, leadBlanks, longDate, monday, plannerMonths, promptFor, weekLabel, ymd } from './dates';

describe('dates', () => {
  it('clamps into the planner range', () => {
    expect(ymd(clamp(new Date(2026, 8, 25)))).toBe('2026-10-01');
    expect(ymd(clamp(new Date(2028, 0, 3)))).toBe('2027-12-31');
    expect(ymd(clamp(new Date(2027, 4, 9)))).toBe('2027-05-09');
  });

  it('starts weeks on Monday', () => {
    expect(ymd(monday(new Date(2026, 9, 1)))).toBe('2026-09-28'); // Thu 1 Oct 2026
    expect(ymd(monday(new Date(2026, 9, 11)))).toBe('2026-10-05'); // Sunday
    expect(weekLabel(new Date(2026, 9, 7))).toBe('5 Oct – 11 Oct 2026');
  });

  it('formats long dates like the design', () => {
    expect(longDate(new Date(2026, 9, 1))).toBe('Thursday 1 October 2026');
  });

  it('counts blank cells before the 1st', () => {
    expect(leadBlanks(2026, 9)).toBe(3); // Oct 2026 starts on Thursday
    expect(leadBlanks(2027, 1)).toBe(0); // Feb 2027 starts on Monday
  });

  it('counts days across the October clock change', () => {
    expect(daysBetween(new Date(2026, 9, 20), new Date(2026, 10, 1))).toBe(12);
  });

  it('has 15 planner months ending December 2027', () => {
    const m = plannerMonths();
    expect(m).toHaveLength(15);
    expect(ymd(m[14])).toBe('2027-12-01');
  });

  it('rotates prompts by day of year', () => {
    expect(promptFor(new Date(2026, 0, 1))).toBe('Three small things you’re grateful for.');
  });
});
