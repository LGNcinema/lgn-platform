import { useState } from 'react';
import '../campfire/CampfireHome.css';
import { GuidesDialog } from '../campfire/GuidesDialog';
import { FilmSearch } from './FilmSearch';

interface Props {
  onOpenFilm: (tmdbId: number) => void;
  onOpenStory: (capsuleId: number) => void;
  /** On a film's own page: the film on screen, shown in the field. */
  filmTitle?: string;
}

/**
 * "Take it beyond the screen": the heading, the one-line intro and the film
 * search. It tops the Go Beyond page and, as in the frames, stays above a
 * film's page too, so a visitor can look up another film without going back.
 */
export function BeyondSearch({ onOpenFilm, onOpenStory, filmTitle }: Props) {
  const [guidesOpen, setGuidesOpen] = useState(false);

  return (
    <section className="cf-section" aria-labelledby="cf-beyond-heading">
      <h1 id="cf-beyond-heading" className="cf-heading cf-heading--beyond">Take it beyond the screen</h1>
      <div className="cf-beyond">
        <p className="cf-beyond-intro">
          Guided reflection and practice for any film.
          <br />
          <span className="cf-grey">
            Starts with AI is refined by people.{' '}
            <button type="button" className="cf-how" onClick={() => setGuidesOpen(true)}>
              How it works.
            </button>
          </span>
        </p>
        <FilmSearch onOpenFilm={onOpenFilm} onOpenStory={onOpenStory} initialQuery={filmTitle} />
      </div>
      <GuidesDialog open={guidesOpen} onClose={() => setGuidesOpen(false)} />
    </section>
  );
}
