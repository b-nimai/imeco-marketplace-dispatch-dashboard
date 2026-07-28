import { describe, expect, it } from 'vitest';
import { parseDispatchDate, toIsoKey } from './parseDate';

/** Every string here was copied out of the live `Outbound Tracker` sheet. */
const iso = (header: string) => {
  const d = parseDispatchDate(header);
  return d ? toIsoKey(d) : null;
};

describe('parseDispatchDate', () => {
  it('parses clean headers', () => {
    expect(iso('1-Apr-2026')).toBe('2026-04-01');
    expect(iso('27-Jul-2026')).toBe('2026-07-27');
    expect(iso('31-Jul-2026')).toBe('2026-07-31');
  });

  it('normalises full month names (FLIPKART / CLICKTECH use both forms)', () => {
    expect(iso('13-June-2026')).toBe('2026-06-13');
    expect(iso('6-Jun-2026')).toBe('2026-06-06');
  });

  it('assigns a date range to its start', () => {
    expect(iso('27-Apr-2026 \nTo \n02-May-2026')).toBe('2026-04-27');
    expect(iso('05-May-2026 \nTo \n07-May-2026')).toBe('2026-05-05');
  });

  it('borrows month+year from the range end when the start is a bare day', () => {
    // 'RK World' column: "22 To 23-May-2026"
    expect(iso('22 To 23-May-2026')).toBe('2026-05-22');
  });

  it('handles space-separated ranges with 2-digit years', () => {
    // 'MEESHO PO' column
    expect(iso('23 Apr 26 \nTo\n04 May 26')).toBe('2026-04-23');
  });

  it('corrects the Mat→May typo found twice in BLINKIT', () => {
    expect(iso('06-Mat-2026 \nTo \n07-May-2026')).toBe('2026-05-06');
    expect(iso('08-Mat-2026 \nTo \n11-May-2026')).toBe('2026-05-08');
  });

  it('takes the FIRST date when a header holds two POs on two dates', () => {
    // 'CLICKTECH P.O.' column L
    expect(
      iso('13-June-2026\nCLICKTECH        5QMN93SY\n06-June-2026\nCLICKTECH        1T1MANEL\n'),
    ).toBe('2026-06-13');
  });

  it('returns null for headers carrying only PO numbers', () => {
    expect(iso('RK_WORLD\t43H3IRBT \nRK_WORLD\t2RBPFZZS')).toBeNull();
    expect(
      iso('RK_WORLD        1T9X8ECQ\nRK_WORLD        4ZZMDCHL\nRK_WORLD        6IC922CH'),
    ).toBeNull();
  });

  it('returns null for warehouse/label headers', () => {
    // The trailing "Nagpur N1" must not be mistaken for a month.
    expect(iso('Blinkit-IMECO \n2549710045028 \nNagpur N1')).toBeNull();
    expect(iso('Blinkit-IMECO \n48287510031040 \n')).toBeNull();
  });

  it('returns null for empty and non-date headers', () => {
    expect(iso('')).toBeNull();
    expect(iso('   ')).toBeNull();
    expect(iso('Total')).toBeNull();
    expect(iso('SKU ID')).toBeNull();
  });

  it('rejects impossible calendar days rather than rolling them over', () => {
    expect(iso('31-Feb-2026')).toBeNull();
    expect(iso('00-Jan-2026')).toBeNull();
  });

  it('is timezone-stable (UTC midnight, not local)', () => {
    // A local-midnight Date would slide a day backwards west of Greenwich.
    expect(parseDispatchDate('1-Apr-2026')?.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });
});
