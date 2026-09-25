import { describe, expect, it } from 'vitest';
import { budgetSummary, categoryIds, dayInfo, money, nextCategoryId, nextTrip, pilatesCount, readingSummary, tripCountdown } from './planner';

describe('planner', () => {
  it('collects celebrations that repeat every year', () => {
    const data = { 'ev:10-14:0': 'Mum', 'ev:10-14:0:type': 'Birthday', 'd:2027-10-14:p1': 'Buy card', 'd:2027-10-14:h9': 'Gym' };
    expect(dayInfo(data, '2027-10-14')).toEqual({ ev: ['Birthday · Mum'], pr: ['Buy card'], sch: ['9:00 Gym'] });
    expect(dayInfo(data, '2026-10-14').ev).toEqual(['Birthday · Mum']);
  });

  it('counts pilates classes in a month', () => {
    expect(pilatesCount({ 'pl:2026-10-01': true, 'pl:2026-10-31': true, 'pl:2026-11-01': true, 'pl:2026-10-02': false }, 2026, 9)).toBe(2);
  });

  it('summarises reading', () => {
    const r = readingSummary({ 'bk0:t': 'Circe', 'bk0:s': 'Reading', 'bk1:s': 'Finished', 'rd:goal': '4' });
    expect(r).toMatchObject({ finished: 1, goal: 4, current: 'Circe', pct: 25, list: 'Circe' });
    expect(readingSummary({}).goal).toBe(24);
  });

  it('finds the nearest upcoming trip', () => {
    const today = new Date(2026, 9, 1);
    const data = { 'tr0:dep': '2026-09-01', 'tr1:dep': '2026-12-01', 'tr1:to': 'Rome', 'tr2:dep': '2026-10-11', 'tr2:to': 'Lisbon' };
    expect(nextTrip(data, today)).toEqual({ name: 'Lisbon', when: '10 days to go' });
    expect(nextTrip({}, today).name).toBe('No trips booked yet');
    expect(tripCountdown('2026-10-01', today)).toBe('Departing today');
    expect(tripCountdown('2026-09-01', today)).toBe('Trip complete');
  });

  it('adds budget categories without reusing old ids', () => {
    expect(categoryIds({})).toHaveLength(9);
    expect(nextCategoryId({})).toBe(9);
    expect(nextCategoryId({ 'bg:ids': [0], 'bg:cat12': 'Gifts' })).toBe(13);
    expect(nextCategoryId({ 'bg:ids': [] })).toBe(9);
    const s = budgetSummary({ 'bg:ids': [0, 1], 'bg:2026-10:inc': '2000', 'bg:2026-10:p0': '900', 'bg:2026-10:a0': '900', 'bg:2026-10:a1': '150.5', 'bg:2026-10:a5': '99' }, '2026-10');
    expect(s).toEqual({ planned: 900, actual: 1050.5, left: 949.5 });
    expect(money(-12.5)).toBe('−£12.5');
    expect(money(1234)).toBe('£1,234');
  });
});
