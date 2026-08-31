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
