import { useEffect, useState } from 'react';
import './WhereToWatch.css';
import { LgnDialog } from '../LgnDialog';
import { fetchFilmWatch, visitorRegion, type FilmWatch } from './beyond';

interface Props {
  open: boolean;
  onClose: () => void;
  tmdbId: number;
  title: string;
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; watch: FilmWatch }
  | { kind: 'error'; message: string };

function countryName(region: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(region) ?? region;
  } catch {
    return region;
  }
}

/**
 * "Where to watch": opened by the play mark on a film's Watch tab. Figma:
 * "WHERE TO WATCH [x]" over the blurred page, one button per service.
 *
 * The data is TMDB's, which TMDB sources from JustWatch, and TMDB requires that
 * JustWatch be credited wherever it is shown (see the line at the foot, and the
 * Credits tab). TMDB gives one link per country, not one per service, so every
 * button opens TMDB's page for the film, where each service links out.
 *
 * Nothing is asked of the visitor: their country comes from their browser's
 * language and goes only to our own API.
 */
export function WhereToWatch({ open, onClose, tmdbId, title }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setState({ kind: 'loading' });
    fetchFilmWatch(tmdbId, visitorRegion(), controller.signal)
      .then((watch) => setState({ kind: 'ready', watch }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' });
      });
    return () => controller.abort();
  }, [open, tmdbId]);

  const tmdbPage = `https://www.themoviedb.org/movie/${tmdbId}/watch`;

  return (
    <LgnDialog open={open} onClose={onClose} label="Where to watch" className="ww-dialog">
      <div className="ww-body">
        {state.kind === 'loading' && <p className="ww-note" role="status">Looking for where to watch…</p>}

        {state.kind === 'error' && (
          <p className="ww-note" role="alert">
            {state.message}{' '}
            <a href={tmdbPage} target="_blank" rel="noopener noreferrer">Try TMDB’s page for {title}.</a>
          </p>
        )}

        {state.kind === 'ready' && !state.watch.available && (
          <p className="ww-note">
            We couldn’t find a place to watch {title} in {countryName(state.watch.region)} right now.{' '}
            <a href={state.watch.link} target="_blank" rel="noopener noreferrer">See TMDB’s page for it.</a>
          </p>
        )}

        {state.kind === 'ready' &&
          state.watch.groups.map((group) => (
            <section key={group.kind} className="ww-group" aria-label={group.label}>
              <h3 className="lgn-label ww-group-label">{group.label}</h3>
              <ul className="ww-list">
                {group.providers.map((name) => (
                  <li key={name}>
                    <a className="lgn-btn ww-btn" href={state.watch.link} target="_blank" rel="noopener noreferrer">
                      <span>{name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>

      <p className="ww-foot">
        {state.kind === 'ready' && state.watch.available && (
          <span>
            Showing {countryName(state.watch.region)}. Each opens TMDB’s page for this film, where every service links out.
          </span>
        )}
        <span>
          Where-to-watch information powered by{' '}
          <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer">JustWatch</a>.
        </span>
      </p>
    </LgnDialog>
  );
}
