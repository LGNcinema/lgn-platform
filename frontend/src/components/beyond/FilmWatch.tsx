import { useState } from 'react';
import './FilmWatch.css';
import { PlayMark } from '../campfire/StoryWatch';
import { WhereToWatch } from './WhereToWatch';
import type { FilmDetail } from './beyond';

/**
 * The Watch tab for a film that isn't one of LGN's stories: the same frame as a
 * story's Watch (StoryWatch), with a still from the film and the play mark.
 * There is no video here, so pressing play opens "Where to watch" instead.
 *
 * The picture: a still from TMDB if the film has one, else the poster shown
 * whole (never cropped), else the title on a plain card. The poster appears
 * only here, not in the side panel.
 */
export function FilmWatch({ film }: { film: FilmDetail }) {
  const [open, setOpen] = useState(false);
  // The poster arrives as the small thumbnail the search list uses; filling the
  // panel wants TMDB's larger size (same file, same host, just w780).
  const poster = film.poster_url?.replace('/w342/', '/w780/') ?? null;
  const image = film.still_url ?? poster;
  const asPoster = !film.still_url && Boolean(poster);

  return (
    <>
      <button
        type="button"
        // The still is dark enough for the frame's white mark; a poster or a
        // card sits on light grey, so those get the dark mark.
        className={`story-watch film-watch${film.still_url ? '' : ' story-watch-no-still'}${asPoster ? ' film-watch--poster' : ''}`}
        style={{ aspectRatio: '16 / 9' }}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Where to watch ${film.title}`}
      >
        {image ? (
          // Decorative: the button's label already names the film.
          <img className="story-watch-still" src={image} alt="" />
        ) : (
          <span className="film-watch-card" aria-hidden="true">{film.title}</span>
        )}
        <PlayMark />
      </button>
      <WhereToWatch open={open} onClose={() => setOpen(false)} tmdbId={film.tmdb_id} title={film.title} />
    </>
  );
}
