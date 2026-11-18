import type { Film } from './types';

/** Compose the credit line from whatever the film record actually has. */
export const buildFilmInfo = (film: Film): string => {
  const title = film.title?.trim();
  const director = film.director?.trim();
  const lead = [title, director ? `a film by ${director}` : null].filter(Boolean).join(' ');

  return [lead, film.duration?.trim(), film.description?.trim()]
    .filter((part): part is string => Boolean(part))
    .join('. ');
};

/**
 * Split a newline-separated content field (`discuss_prompts`, `steps`) into items.
 *
 * Editors type real newlines in the admin textareas, but content loaded through
 * `supabase/seed.sql` arrives with the two-character sequence `\n` instead --
 * plain SQL string literals do not interpret backslash escapes. Both forms mean
 * "one item per line" to a reader, so both are treated as separators here.
 * Blank lines are dropped; the text of each line is otherwise left untouched.
 */
export const splitLines = (value?: string | null): string[] =>
  (value ?? '')
    .split(/\\r\\n|\\n|\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

/** "1h 43m" from a runtime in seconds. */
function formatRuntime(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** The film's details under the tabs: year, director, runtime, then its
 *  description (Figma: "2012 / Stephen Chbosky / 1h 43m"). */
export function filmFacts(film: Film | null | undefined): string[] {
  if (!film) return [];
  return [
    film.release_year?.trim(),
    film.director?.trim(),
    film.duration?.trim() || formatRuntime(film.video_duration_seconds) || undefined,
  ].filter((v): v is string => Boolean(v));
}

export interface CreditRow {
  role: string;
  names: string;
}

/**
 * The admin's credits text as groups of rows: one "Role: Name, Name" per line,
 * a blank line between groups. A role with no names yet is left out, so the
 * standard roles can sit in the admin unfilled. A line without a colon is all
 * names.
 */
export function parseCredits(text: string | null | undefined): CreditRow[][] {
  const groups: CreditRow[][] = [];
  let current: CreditRow[] = [];
  for (const raw of (text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      if (current.length) groups.push(current);
      current = [];
      continue;
    }
    const colon = line.indexOf(':');
    const role = colon === -1 ? '' : line.slice(0, colon).trim();
    const names = (colon === -1 ? line : line.slice(colon + 1)).trim();
    if (names) current.push({ role, names });
  }
  if (current.length) groups.push(current);
  return groups;
}
