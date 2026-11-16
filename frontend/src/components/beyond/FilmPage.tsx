import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './FilmPage.css';
import { StoryShell } from '../campfire/StoryShell';
import { GuidesDialog, GUIDE_TIERS } from '../campfire/GuidesDialog';
import { ReflectSections } from '../campfire/StoryReflect';
import { PracticeSections } from '../campfire/StoryPractice';
import type { StorySection } from '../campfire/campfire';
import { BeyondSearch } from './BeyondSearch';
import { FeedbackDialog, type FeedbackMode } from './FeedbackDialog';
import { FilmWatch } from './FilmWatch';
import {
  FilmApiError,
  fetchFilm,
  fetchFilmPrompts,
  fetchUniversalPrompts,
  filmFacts,
  startFilmAi,
  type FilmDetail,
  type FilmPromptsResponse,
  type PromptKind,
  type PromptSet,
} from './beyond';

interface Props {
  tmdbId: number;
  onBackToCampfire: () => void;
  /** The search above the film opens another one. */
  onOpenFilm: (tmdbId: number) => void;
  /** One of LGN's own stories turns out to be this film: go to its full page. */
  onOpenStory: (capsuleId: number) => void;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; film: FilmDetail }
  | { kind: 'held'; film: FilmDetail }
  | { kind: 'notfound' }
  | { kind: 'error'; message: string };

type Which = 'default' | 'ai';

const KINDS: PromptKind[] = ['reflect', 'practice'];

const SECTIONS: { key: StorySection; label: string }[] = [
  { key: 'watch', label: 'Watch' },
  { key: 'reflect', label: 'Reflect' },
  { key: 'practice', label: 'Practice' },
];

const POLL_MS = 2500;
const POLL_MAX = 40;

/**
 * A page of guidance for any film (Beyond the Screen): the film's details on
 * the left, Watch, Reflect and Practice on the right -- the same frame as a
 * monthly story. The search stays above it, as in the frames. Watch has no video
 * of ours: it shows a still (or the poster), and play opens "Where to watch".
 *
 * Questions show at once (the universal set, then the film's own once loaded).
 * After the film loads the page asks the server to write AI questions if this
 * film has none yet; they appear as a labelled alternative when ready.
 *
 * PRIVACY: as Reflect everywhere -- the visitor's writing stays on this device.
 */
export function FilmPage({ tmdbId, onBackToCampfire, onOpenFilm, onOpenStory }: Props) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [universal, setUniversal] = useState<PromptSet | null>(null);
  const [prompts, setPrompts] = useState<FilmPromptsResponse | null>(null);
  const [which, setWhich] = useState<Which>('default');
  const [section, setSection] = useState<StorySection>('watch');
  const [aiRunning, setAiRunning] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackMode | null>(null);
  const [guidesOpen, setGuidesOpen] = useState(false);
  // The parent hands in a new function every render; loading must not restart for that.
  const openStoryRef = useRef(onOpenStory);
  openStoryRef.current = onOpenStory;

  // Film details + prompts. The universal questions are fetched in parallel so
  // there is something to read before the details arrive.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoad({ kind: 'loading' });
    setPrompts(null);
    setUniversal(null);
    setWhich('default');
    setSection('watch');
    setAiRunning(false);

    fetchUniversalPrompts(signal).then(setUniversal).catch(() => undefined);

    (async () => {
      try {
        const film = await fetchFilm(tmdbId, signal);
        if (film.lgn_capsule_id) {
          openStoryRef.current(film.lgn_capsule_id);
          return;
        }
        if (film.handling === 'held') {
          setLoad({ kind: 'held', film });
          return;
        }
        setLoad({ kind: 'ready', film });
        const first = await fetchFilmPrompts(tmdbId, signal);
        setPrompts(first);

        // Ask for AI questions once the page is up, unless LGN has already
        // written both Reflect and Practice (its own are then the only ones
        // shown). The server decides the rest (switch, cap, film settings); a
        // plain answer means no.
        const lgnCoversBoth = KINDS.every((k) => first.default_sources[k] === 'lgn');
        if (first.handling === 'normal' && first.ai_status !== 'ready' && !lgnCoversBoth) {
          setAiRunning(true);
          startFilmAi(tmdbId)
            .catch(() => undefined)
            .then(() => fetchFilmPrompts(tmdbId, signal))
            .then(setPrompts)
            .catch(() => undefined)
            .finally(() => {
              if (!signal.aborted) setAiRunning(false);
            });
        }
      } catch (err) {
        if (signal.aborted) return;
        if (err instanceof FilmApiError && err.status === 404) setLoad({ kind: 'notfound' });
        else setLoad({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' });
      }
    })();

    return () => controller.abort();
  }, [tmdbId, attempt]);

  // Once LGN has written a kind's questions they are the ONLY ones offered for
  // it: no Universal | AI choice there, and no way back. The choice exists only
  // for a kind LGN has not written yet.
  const lgnOwns = (k: PromptKind) => prompts?.default_sources[k] === 'lgn';
  const anyOpenKind = KINDS.some((k) => !lgnOwns(k));
  // While the server is writing them (here or for someone else), look again.
  const preparing = (prompts?.ai_status === 'pending' || aiRunning) && anyOpenKind;
  const refresh = useCallback(() => fetchFilmPrompts(tmdbId).then(setPrompts).catch(() => undefined), [tmdbId]);
  useEffect(() => {
    if (!preparing) return;
    let ticks = 0;
    const id = window.setInterval(() => {
      ticks += 1;
      if (ticks > POLL_MAX) window.clearInterval(id);
      else void refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [preparing, refresh]);

  // The questions on screen belong to one kind (Reflect or Practice), and the
  // choice is made per kind: LGN can have written Reflect but not Practice.
  const kind: PromptKind = section === 'practice' ? 'practice' : 'reflect';
  const hasAi = !lgnOwns(kind) && (prompts?.ai?.[kind].length ?? 0) > 0;
  const active: Which = which === 'ai' && hasAi ? 'ai' : 'default';
  const showToggle = section !== 'watch' && !lgnOwns(kind) && (hasAi || preparing);
  const set: PromptSet | null = useMemo(() => {
    if (active === 'ai' && prompts?.ai) return prompts.ai;
    return prompts?.default ?? universal;
  }, [active, prompts, universal]);

  if (load.kind === 'notfound' || load.kind === 'error' || load.kind === 'held') {
    return (
      <div className="film-message">
        <button type="button" className="story-shell-back" onClick={onBackToCampfire}>&lt; Go Beyond</button>
        {load.kind === 'held' ? (
          <>
            <h1 className="film-message-title">{load.film.title}</h1>
            <p>
              We don’t offer a guide for this film. Some films call for more care than a set of questions can give.
            </p>
          </>
        ) : load.kind === 'notfound' ? (
          <p>We couldn’t find that film.</p>
        ) : (
          <>
            <p>{load.message}</p>
            <button type="button" className="lgn-btn" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
          </>
        )}
      </div>
    );
  }

  const film = load.kind === 'ready' ? load.film : null;
  const title = film?.title ?? 'One moment…';
  const source = active === 'ai' ? 'ai' : prompts?.default_sources[kind] ?? 'universal';
  const tier = source === 'ai' ? 1 : source === 'lgn' ? 2 : 0;

  const meta = `LGN · Go Beyond${film?.year ? ` · ${film.year}` : ''}`;
  const storageStem = `beyond_reflect_${tmdbId}_${active}`;

  // "Not the right film?": the search is right above, so take them to it.
  const focusSearch = () => {
    const field = document.getElementById('film-search-field') as HTMLInputElement | null;
    field?.focus();
    field?.select();
  };

  return (
    <div className="film-page">
      {/* As in the frames, the search stays above the film so another one is a
          step away. It shows this film's title until the visitor types. */}
      <div className="campfire-home film-page-head">
        <BeyondSearch
          key={film?.title ?? 'loading'}
          filmTitle={film?.title}
          onOpenFilm={onOpenFilm}
          onOpenStory={onOpenStory}
        />
      </div>

      <StoryShell
        embedded
        title={title}
        sections={SECTIONS}
        labels={['LGN', 'Go Beyond', film?.year ? String(film.year) : '']}
        section={section}
        onSelectSection={setSection}
        onBackToCampfire={onBackToCampfire}
        gemeTuning={null}
        gemeTuningVersion={0}
        eyebrow={
          film && (
            <button type="button" className="film-eyebrow" onClick={focusSearch}>
              Not the right film?
            </button>
          )
        }
        intro={
          film && (
            <>
              <p className="story-shell-credit">
                {filmFacts(film)}
                {film.cast.length > 0 && (
                  <>
                    <br />
                    <span className="film-cast">With {film.cast.join(', ')}</span>
                  </>
                )}
              </p>
              {film.logline && <p>{film.logline}</p>}
            </>
          )
        }
      >
        {film?.care_note && (
          <aside className="film-care" role="note">
            <p className="lgn-label">A note of care</p>
            <p>{film.care_note}</p>
          </aside>
        )}

        {section === 'watch' ? (
          film ? (
            <FilmWatch film={film} />
          ) : (
            <p className="film-loading" role="status">One moment…</p>
          )
        ) : (
          <>
            <div className="film-guide-bar">
              {showToggle && (
                <div className="film-toggle" role="group" aria-label="Which questions">
                  <button
                    type="button"
                    className={`film-toggle-btn${active === 'default' ? ' is-on' : ''}`}
                    aria-pressed={active === 'default'}
                    onClick={() => setWhich('default')}
                  >
                    Universal questions
                  </button>
                  <button
                    type="button"
                    className={`film-toggle-btn${active === 'ai' ? ' is-on' : ''}`}
                    aria-pressed={active === 'ai'}
                    disabled={!hasAi}
                    onClick={() => setWhich('ai')}
                  >
                    {hasAi ? 'AI-generated questions' : 'AI questions: preparing…'}
                  </button>
                </div>
              )}
              <p className="film-source lgn-label">
                <span aria-hidden="true">{'●'.repeat(tier + 1)}</span>{' '}
                {source === 'ai' ? 'AI-generated, not yet reviewed by LGN' : GUIDE_TIERS[tier]}
                {' · '}
                <button type="button" className="film-link" onClick={() => setGuidesOpen(true)}>
                  How these guides are made
                </button>
              </p>
            </div>

            {set ? (
              section === 'reflect' ? (
                <ReflectSections
                  resetKey={`${tmdbId}-${active}`}
                  title={title}
                  meta={meta}
                  storageKey={storageStem}
                  reflections={set.reflect}
                  intro={
                    <p>
                      {film
                        ? `After watching ${film.title}, here are a few questions to help you reflect: for yourself, for your neighbor, and for the world.`
                        : 'Here are a few questions to help you reflect on what you just watched.'}
                    </p>
                  }
                />
              ) : (
                <PracticeSections
                  resetKey={`${tmdbId}-${active}`}
                  practices={set.practice}
                  intro={
                    <p className="practice-intro">
                      A small exercise in carrying the film with you. Three levels, from yourself outward. Find one
                      that suits you, or try more than one.
                    </p>
                  }
                />
              )
            ) : (
              <p className="film-loading" role="status">Loading questions…</p>
            )}
          </>
        )}

        <p className="film-suggest">
          {section !== 'watch' && (
            <button type="button" className="film-link" onClick={() => setFeedback('suggestion')}>
              Suggest a question or tell us what missed
            </button>
          )}
          {film && section !== 'watch' && ' · '}
          {film && (
            <button type="button" className="film-link" onClick={() => setFeedback('something_off')}>
              Is something off about this film?
            </button>
          )}
        </p>

        {film && (
          <FeedbackDialog
            open={feedback !== null}
            onClose={() => setFeedback(null)}
            mode={feedback ?? 'suggestion'}
            film={{ tmdb_id: film.tmdb_id, title: film.title }}
            kind={kind}
          />
        )}
        <GuidesDialog open={guidesOpen} onClose={() => setGuidesOpen(false)} />
      </StoryShell>
    </div>
  );
}
