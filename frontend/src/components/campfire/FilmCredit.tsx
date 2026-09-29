import './FilmCredit.css';
import type { Film } from '../../types';

interface Props {
  film: Film;
  /** The paragraph's class -- each page sizes and positions its own credit line. */
  className?: string;
}

/**
 * A film's credit line, e.g. "LIGHTPOLES a film by JANE DOE. 10 min. A short
 * film about ...". Used by the Campfire hub's cards and the story page.
 *
 * Same parts and punctuation as buildFilmInfo (filmInfo.ts), but returned as
 * nodes rather than a string: the frames set the film title and the people's
 * names in capitals while the connecting words ("a film by") and the rest of
 * the line keep their own case ("86 min.", mixed-case description). Uppercasing
 * the whole string would lose that. Only the title and director are
 * capitalised -- the fields the frames show in caps; duration and description
 * are editor text and render as typed.
 *
 * Doing the capitalising here rather than relying on editors to type names in
 * capitals keeps the hub and the story page agreeing with each other, and with
 * the frames, whatever is in the database.
 */
export function FilmCredit({ film, className }: Props) {
  const title = film.title?.trim();
  const director = film.director?.trim();
  const rest = [film.duration?.trim(), film.description?.trim()].filter(
    (part): part is string => Boolean(part),
  );
  const hasLead = Boolean(title || director);

  if (!hasLead && rest.length === 0) return null;

  return (
    <p className={className}>
      {title && <span className="film-credit-name">{title}</span>}
      {title && director && ' '}
      {director && (
        <>
          a film by <span className="film-credit-name">{director}</span>
        </>
      )}
      {rest.length > 0 && `${hasLead ? '. ' : ''}${rest.join('. ')}`}
    </p>
  );
}
