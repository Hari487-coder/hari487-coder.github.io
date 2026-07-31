import { describe, expect, it } from 'vitest';
import {
  burnPercent,
  daysLeft,
  fmt,
  isDueSoon,
  isOverdue,
  stamp,
  todayIST,
} from './dates';

const utc = (iso: string) => new Date(iso);

describe('todayIST', () => {
  it('is still the same IST day just before midnight IST', () => {
    // 18:29 UTC = 23:59 IST on Jul 31
    expect(todayIST(utc('2026-07-31T18:29:00Z'))).toEqual(utc('2026-07-31T00:00:00Z'));
  });

  it('rolls to the next IST day at 18:30 UTC', () => {
    // 18:30 UTC = 00:00 IST on Aug 1
    expect(todayIST(utc('2026-07-31T18:30:00Z'))).toEqual(utc('2026-08-01T00:00:00Z'));
  });

  it('early UTC morning is the same IST calendar day', () => {
    // 03:00 UTC = 08:30 IST same day
    expect(todayIST(utc('2026-08-04T03:00:00Z'))).toEqual(utc('2026-08-04T00:00:00Z'));
  });
});

describe('burnPercent', () => {
  const due = utc('2026-08-20T00:00:00Z');

  it('is 50 at the midpoint of an explicit window', () => {
    const start = utc('2026-08-10T00:00:00Z');
    expect(burnPercent(due, start, utc('2026-08-15T00:00:00Z'))).toBe(50);
  });

  it('uses a 14-day fallback window when start is missing', () => {
    // 7 days before due with a 14-day window = 50%
    expect(burnPercent(due, undefined, utc('2026-08-13T00:00:00Z'))).toBe(50);
  });

  it('clamps to 0 before the window opens', () => {
    const start = utc('2026-08-10T00:00:00Z');
    expect(burnPercent(due, start, utc('2026-08-01T00:00:00Z'))).toBe(0);
  });

  it('clamps to 100 after due', () => {
    const start = utc('2026-08-10T00:00:00Z');
    expect(burnPercent(due, start, utc('2026-09-01T00:00:00Z'))).toBe(100);
  });

  it('returns whole integers', () => {
    const start = utc('2026-08-10T00:00:00Z');
    const v = burnPercent(due, start, utc('2026-08-13T00:00:00Z'));
    expect(Number.isInteger(v)).toBe(true);
  });
});

describe('isDueSoon / isOverdue / daysLeft', () => {
  const today = utc('2026-08-01T00:00:00Z');

  it('due exactly 7 days out is due soon', () => {
    expect(isDueSoon(utc('2026-08-08T00:00:00Z'), today)).toBe(true);
  });

  it('due 8 days out is not due soon', () => {
    expect(isDueSoon(utc('2026-08-09T00:00:00Z'), today)).toBe(false);
  });

  it('overdue items are always due soon', () => {
    expect(isDueSoon(utc('2026-07-25T00:00:00Z'), today)).toBe(true);
  });

  it('due today is due soon and not overdue', () => {
    expect(isDueSoon(utc('2026-08-01T00:00:00Z'), today)).toBe(true);
    expect(isOverdue(utc('2026-08-01T00:00:00Z'), today)).toBe(false);
  });

  it('due yesterday is overdue', () => {
    expect(isOverdue(utc('2026-07-31T00:00:00Z'), today)).toBe(true);
  });

  it('daysLeft is positive before due, negative after', () => {
    expect(daysLeft(utc('2026-08-04T00:00:00Z'), today)).toBe(3);
    expect(daysLeft(utc('2026-07-30T00:00:00Z'), today)).toBe(-2);
  });
});

describe('formatting', () => {
  it('fmt renders "04 Aug 2026"', () => {
    expect(fmt(utc('2026-08-04T00:00:00Z'))).toBe('04 Aug 2026');
  });

  it('stamp renders "04 AUG 2026"', () => {
    expect(stamp(utc('2026-08-04T00:00:00Z'))).toBe('04 AUG 2026');
  });
});
