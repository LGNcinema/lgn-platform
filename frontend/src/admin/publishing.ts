/**
 * Publication state for the admin portal -- draft / scheduled / published --
 * plus the timezone conversions the schedule picker depends on.
 *
 * TIMEZONE CONTRACT
 * -----------------
 * `publish_at` travels as *naive UTC* ISO-8601: `2026-09-01T13:00:00`, with no
 * `Z` and no offset. JavaScript parses exactly that shape as **local** time, so
 * `new Date(capsule.publish_at)` is silently wrong by the viewer's UTC offset.
 * Every read therefore goes through `parseNaiveUtc` (which supplies the missing
 * `Z`) and every write through `toNaiveUtcIso` (which strips the zone back off).
 *
 * `<input type="datetime-local">` is the mirror image of the same problem: its
 * value is a bare local wall-clock string carrying no zone at all. It is parsed
 * with the local-time `Date` constructor and formatted from local getters --
 * never with `toISOString()`, which would silently shift it into UTC.
 *
 * The two conversions are exact inverses, to the minute (`datetime-local` has no
 * seconds), so a value can be loaded, shown, and saved back unchanged.
 *
 * WHAT COUNTS AS PUBLISHED IS THE SERVER'S CALL
 * ---------------------------------------------
 * The server sends a derived, read-only `is_published` (`is_active OR
 * publish_at <= utcnow()`). That is never recomputed here: a browser clock a few
 * minutes out would otherwise make the portal disagree with the site it is
 * describing. The one comparison this module does make against the local clock
 * is cosmetic -- deciding whether a schedule the fetched copy has not caught up
 * with yet should still be *described* as upcoming (see `publicationState`).
 */
import type { CapsuleSummary } from '../types';

/** Everything this module needs from a capsule, summary or detail alike. */
export interface PublishableCapsule {
  is_active: boolean;
  is_published?: boolean;
  publish_at?: string | null;
}

/**
 * `published` -- live on the site now.
 * `scheduled` -- not yet live, with a go-live time still in the future.
 * `due`       -- not yet live *in this fetched copy*, but its go-live time has
 *                since passed, so the server now considers it published.
 * `draft`     -- not live, not scheduled.
 */
export type PublicationState = 'published' | 'scheduled' | 'due' | 'draft';

/** The three states a user actually chooses between. `due` is a stale `scheduled`. */
export type PublishMode = 'published' | 'scheduled' | 'draft';

export const STATE_LABEL: Record<PublicationState, string> = {
  published: 'Published',
  scheduled: 'Scheduled',
  due: 'Going live',
  draft: 'Draft',
};

/**
 * Whether the site is serving this capsule, straight from the server's own
 * derived flag. The `is_active` fallback only covers a server that predates
 * `is_published`; it is deliberately not a time comparison.
 */
export function isPublished(capsule: PublishableCapsule): boolean {
  return capsule.is_published ?? capsule.is_active === true;
}

/**
 * `now` is only ever used to tell an upcoming schedule from one that has already
 * elapsed -- never to decide whether something is published (see the module
 * note). An elapsed schedule reports `due` rather than a stale `scheduled`, so
 * the UI can say "this has gone live" instead of promising a past date.
 */
export function publicationState(
  capsule: PublishableCapsule,
  now: number = Date.now(),
): PublicationState {
  if (isPublished(capsule)) return 'published';
  const at = parseNaiveUtc(capsule.publish_at);
  if (!at) return 'draft';
  return at.getTime() <= now ? 'due' : 'scheduled';
}

/* ------------------------------------------------------------------ wire -- */

/** A trailing `Z` or `+01:00` / `+0100` -- i.e. the value already names a zone. */
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Parse the server's naive-UTC `publish_at` into a real instant.
 *
 * Anything unparseable returns `null` rather than an Invalid Date, so callers
 * cannot accidentally render "NaN" or compare against a poisoned timestamp.
 */
export function parseNaiveUtc(value: string | null | undefined): Date | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Postgres/`str()` style `2026-09-01 13:00:00` is the same instant as the
  // `T`-separated form; normalise before deciding whether a zone is present.
  const normalised = trimmed.replace(/^(\d{4}-\d{2}-\d{2})[ ]/, '$1T');
  const withZone = HAS_ZONE.test(normalised) ? normalised : `${normalised}Z`;

  const ms = Date.parse(withZone);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * Render an instant as the naive-UTC ISO string the API expects. Built from the
 * `getUTC*` getters, and deliberately without milliseconds or a `Z` suffix.
 */
export function toNaiveUtcIso(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, '0');
  const mo = pad2(date.getUTCMonth() + 1);
  const d = pad2(date.getUTCDate());
  const h = pad2(date.getUTCHours());
  const mi = pad2(date.getUTCMinutes());
  const s = pad2(date.getUTCSeconds());
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

/* -------------------------------------------------------- datetime-local -- */

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Format an instant as a `datetime-local` value in the viewer's own zone. */
export function toDatetimeLocalValue(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0');
  return `${y}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * Read a `datetime-local` value as local wall-clock time.
 *
 * The fields are handed to the local-time `Date` constructor by hand rather than
 * to `Date.parse`, whose treatment of zone-less strings has historically varied
 * between engines. The round-trip check rejects impossible dates (`2026-02-31`),
 * which the constructor would otherwise roll forward without complaint.
 */
export function fromDatetimeLocalValue(value: string): Date | null {
  const match = LOCAL_INPUT.exec(value.trim());
  if (!match) return null;

  const [, y, mo, d, h, mi, s] = match;
  const year = Number(y);
  const monthIndex = Number(mo) - 1;
  const day = Number(d);

  const date = new Date(year, monthIndex, day, Number(h), Number(mi), s ? Number(s) : 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** The server's `publish_at` as a `datetime-local` value; `''` when unset. */
export function publishAtToInput(publishAt: string | null | undefined): string {
  const date = parseNaiveUtc(publishAt);
  return date ? toDatetimeLocalValue(date) : '';
}

/** A `datetime-local` value as naive-UTC `publish_at`; `null` when empty. */
export function inputToPublishAt(value: string): string | null | undefined {
  if (value.trim() === '') return null;
  const date = fromDatetimeLocalValue(value);
  // `undefined` == "the user typed something that is not a date": the caller
  // must refuse to save rather than silently clearing the schedule.
  return date ? toNaiveUtcIso(date) : undefined;
}

/** Sensible first offer for the picker: tomorrow morning, local time. */
export function defaultScheduleValue(now: Date = new Date()): string {
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0);
  return toDatetimeLocalValue(target);
}

/* --------------------------------------------------------------- display -- */

/**
 * Built once. `dateStyle`/`timeStyle` are avoided on purpose: they cannot be
 * combined with individual component options, and the day-month-year-time shape
 * below is what the copy ("Goes live 1 Sep 2026, 9:00 AM") promises.
 */
let dateTimeFormat: Intl.DateTimeFormat | null = null;

function getDateTimeFormat(): Intl.DateTimeFormat | null {
  if (dateTimeFormat) return dateTimeFormat;
  try {
    dateTimeFormat = new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    dateTimeFormat = null;
  }
  return dateTimeFormat;
}

/** `1 Sep 2026, 9:00 AM` -- always in the viewer's own zone. */
export function formatLocal(date: Date): string {
  const formatter = getDateTimeFormat();
  if (!formatter) return date.toString();
  return formatter.format(date);
}

/** The viewer's IANA zone, e.g. `America/New_York`. Empty when unavailable. */
export function localZoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

/** `your local time (America/New_York)` -- the label every displayed time carries. */
export function localTimeLabel(): string {
  const zone = localZoneName();
  return zone ? `your local time (${zone})` : 'your local time';
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

/** `in 3 days` / `2 hours ago`. Returns `''` when `Intl` cannot oblige. */
export function formatRelative(date: Date, now: number = Date.now()): string {
  let formatter: Intl.RelativeTimeFormat;
  try {
    formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  } catch {
    return '';
  }

  const diff = date.getTime() - now;
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return formatter.format(0, 'minute');
}

/* ------------------------------------------------------------- ordering -- */

/**
 * The capsule the public site opens on: the published one with the newest
 * `month`. Months are `YYYY-MM`, so a string comparison is the date comparison.
 */
export function currentCapsuleId(capsules: CapsuleSummary[]): number | null {
  let best: CapsuleSummary | null = null;
  for (const capsule of capsules) {
    if (!isPublished(capsule)) continue;
    if (!best || (capsule.month ?? '') > (best.month ?? '')) best = capsule;
  }
  return best ? best.id : null;
}
