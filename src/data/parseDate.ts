// Date-column header parser.
//
// Roughly 8% of the date columns in `Outbound Tracker` are not dates. They are date
// RANGES, dates with purchase-order numbers glued on after a newline, one header holding
// TWO dates, a `May`→`Mat` typo, and a handful with no date at all — only PO numbers or a
// warehouse name. A naive `new Date(header)` silently produces garbage on all of them.
//
// Every case below was found in the live sheet; `parseDate.test.ts` pins each one.

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,

  // Observed typo, twice, in BLINKIT: "06-Mat-2026 \nTo \n07-May-2026".
  // Both neighbours are May, so this is a fat-fingered 'y'.
  mat: 4,
};

// day <sep> month-word <sep> year. The month word is validated against MONTHS below —
// that check is what stops "Blinkit-IMECO 2549710045028 Nagpur N1" from parsing as a date.
const DATE_RE = /\b(\d{1,2})[-\s]+([A-Za-z]{3,9})[-\s]+(\d{2,4})\b/g;

// Bare day number, for "22 To 23-May-2026" where only the range END carries the month.
const BARE_DAY_RE = /^\s*(\d{1,2})\s*$/;

const RANGE_SEP_RE = /\bto\b/i;

/** Collapse the newlines and tabs the sheet is full of, so one regex pass sees it all. */
function normalise(raw: string): string {
  return String(raw ?? '').replace(/\s+/g, ' ').trim();
}

/** Build a UTC-midnight Date, rejecting impossible days (31 Feb) via round-trip check. */
function makeDate(year: number, month: number, day: number): Date | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

function expandYear(raw: string): number {
  const n = Number(raw);
  return raw.length <= 2 ? 2000 + n : n;
}

interface Parts {
  day: number;
  month: number;
  year: number;
}

/** First valid `d-mmm-yyyy` in the string. "First" is what disambiguates the two-date
 *  CLICKTECH header, whose second date belongs to a different PO on the same column. */
function firstDateParts(text: string): Parts | null {
  DATE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DATE_RE.exec(text)) !== null) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month === undefined) continue; // not a month word — keep scanning
    const parts = { day: Number(m[1]), month, year: expandYear(m[3]) };
    if (makeDate(parts.year, parts.month, parts.day)) return parts;
  }
  return null;
}

/**
 * Resolve a dispatch-date column header to the date it should be bucketed under.
 *
 * Ranges resolve to their START — splitting a range's units evenly across its days would
 * invent daily granularity the sheet never recorded.
 *
 * Returns `null` for headers carrying no date at all (PO numbers, warehouse names). Those
 * columns still hold real units; `parseSheet` attributes them to a neighbouring date.
 */
export function parseDispatchDate(header: string): Date | null {
  const text = normalise(header);
  if (!text) return null;

  if (RANGE_SEP_RE.test(text)) {
    const [leftRaw, ...rest] = text.split(RANGE_SEP_RE);
    const rightRaw = rest.join(' ');

    const left = firstDateParts(leftRaw);
    if (left) return makeDate(left.year, left.month, left.day);

    // "22 To 23-May-2026" — the start has only a day; borrow month+year from the end.
    const bareDay = BARE_DAY_RE.exec(leftRaw);
    const right = firstDateParts(rightRaw);
    if (bareDay && right) return makeDate(right.year, right.month, Number(bareDay[1]));

    // Fall through: a range whose start is unparseable still resolves via its end.
    if (right) return makeDate(right.year, right.month, right.day);
    return null;
  }

  const parts = firstDateParts(text);
  return parts ? makeDate(parts.year, parts.month, parts.day) : null;
}

/** Stable bucket key. Duplicate and out-of-order columns collapse on this. */
export function toIsoKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fromIsoKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}
