/**
 * "Go Beyond films" in the admin: the outside films LGN has touched, each one's
 * settings and questions, the universal set, and the inbox.
 *
 *   /admin/films             list, and add a film by searching TMDB
 *   /admin/films/universal   the questions every film shows by default
 *   /admin/films/inbox       what visitors sent
 *   /admin/films/:tmdbId     one film
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { filmFacts, type FilmSearchResult } from '../../components/beyond/beyond';
import { AdminApiError, adminFetch } from '../adminClient';
import { Alert, DeleteControl, Note, PanelHead, SaveBar, SelectField, Section, TextArea } from '../panels/Fields';
import { errorMessage, useEditState, useSaveState } from '../panels/formState';
import { FeatureSwitch } from './FeatureSwitch';
import { FilmInbox } from './FilmInbox';
import { PromptGroups } from './PromptEditor';
import {
  AI_LABEL,
  HANDLING_LABEL,
  type AdminFilmDetail,
  type AdminFilmRow,
  type AdminPrompt,
  type Handling,
} from './filmsTypes';
import type { BeyondFlag } from './useBeyondFlag';
import './films.css';

interface Props {
  /** The inbox badge in the sidebar should re-read. */
  onInboxChanged: () => void;
  flag: BeyondFlag;
}

export function FilmsAdmin({ onInboxChanged, flag }: Props) {
  const navigate = useNavigate();
  const match = useMatch('/admin/films/:which');
  const which = match?.params.which;

  if (which === 'inbox') {
    return <FilmInbox onChanged={onInboxChanged} onOpenFilm={(id) => navigate(`/admin/films/${id}`)} />;
  }
  if (which === 'universal') return <UniversalPrompts />;
  const id = Number(which);
  if (which && Number.isInteger(id) && id > 0) {
    return <FilmEditor key={id} tmdbId={id} onGone={() => navigate('/admin/films')} />;
  }
  return <FilmList flag={flag} onOpen={(tmdbId) => navigate(`/admin/films/${tmdbId}`)} />;
}

/* ------------------------------------------------------------------ list */

function FilmList({ onOpen, flag }: { onOpen: (tmdbId: number) => void; flag: BeyondFlag }) {
  const [rows, setRows] = useState<AdminFilmRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<FilmSearchResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);

  useEffect(() => {
    adminFetch<AdminFilmRow[]>('/api/admin/films')
      .then(setRows)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearchError(null);
    try {
      const res = await adminFetch<{ results: FilmSearchResult[] }>(
        `/api/admin/films/search?q=${encodeURIComponent(query.trim())}`,
      );
      setHits(res.results);
    } catch (err) {
      setHits(null);
      setSearchError(errorMessage(err));
    }
  };

  const add = async (tmdbId: number) => {
    setAdding(tmdbId);
    try {
      await adminFetch('/api/admin/films', { method: 'POST', body: { tmdb_id: tmdbId } });
      onOpen(tmdbId);
    } catch (err) {
      setSearchError(errorMessage(err));
      setAdding(null);
    }
  };

  return (
    <div className="apnl">
      <PanelHead
        title="Go Beyond films"
        description="Films outside the monthly stories. A film appears here once someone opens its page, or once you add it. Everything not set here uses the universal questions."
      />

      <FeatureSwitch flag={flag} />

      <Section title="Add a film">
        <form className="fa-search" onSubmit={(e) => void search(e)}>
          <input
            className="apnl-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title"
            aria-label="Search TMDB by title"
          />
          <button type="submit" className="apnl-btn apnl-btn--primary">Search</button>
        </form>
        {searchError && <Alert>{searchError}</Alert>}
        {hits && hits.length === 0 && <p className="apnl-empty">No films found.</p>}
        {hits && hits.length > 0 && (
          <ul className="fa-hits">
            {hits.map((h) => (
              <li key={h.tmdb_id}>
                <span>
                  {h.title} {h.year ? `(${h.year})` : ''}
                </span>
                <button
                  type="button"
                  className="apnl-btn"
                  disabled={adding !== null}
                  onClick={() => void add(h.tmdb_id as number)}
                >
                  {adding === h.tmdb_id ? 'Adding…' : 'Add and open'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Films">
        {error && <Alert>{error}</Alert>}
        {rows === null && !error && <p className="admin-muted">Loading…</p>}
        {rows && rows.length === 0 && <p className="apnl-empty">No films yet. Search above to add one.</p>}
        {rows && rows.length > 0 && (
          <ul className="fa-rows">
            {rows.map((r) => (
              <li key={r.id}>
                <button type="button" className="fa-row" onClick={() => onOpen(r.tmdb_id)}>
                  <span className="fa-row-title">
                    {r.title ?? `Film ${r.tmdb_id}`} {r.year ? <span className="admin-muted">({r.year})</span> : null}
                  </span>
                  <span className="fa-row-pills">
                    {r.handling !== 'normal' && <span className="fa-pill fa-pill--warn">{HANDLING_LABEL[r.handling]}</span>}
                    {r.has_care_note && <span className="fa-pill">Care note</span>}
                    {r.lgn_prompt_count > 0 && <span className="fa-pill fa-pill--on">{r.lgn_prompt_count} LGN prompts</span>}
                    <span className="fa-pill">{AI_LABEL[r.ai_status]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------- one film */

function FilmEditor({ tmdbId, onGone }: { tmdbId: number; onGone: () => void }) {
  const [film, setFilm] = useState<AdminFilmDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setFilm(await adminFetch<AdminFilmDetail>(`/api/admin/films/${tmdbId}`));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [tmdbId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="apnl">
        <Alert>{error}</Alert>
        <button type="button" className="apnl-btn" onClick={onGone}>Back to films</button>
      </div>
    );
  }
  if (!film) return <p className="admin-muted">Loading…</p>;

  const title = film.film?.title ?? `Film ${film.tmdb_id}`;

  return (
    <div className="apnl">
      <PanelHead
        title={title}
        description={
          <>
            {film.film ? filmFacts(film.film) : 'TMDB details unavailable right now.'}{' '}
            <a href={`/?view=film&tmdb=${film.tmdb_id}`} target="_blank" rel="noreferrer">
              Preview on the site ↗
            </a>
          </>
        }
      />

      <Settings film={film} onSaved={load} />

      <Section title="LGN questions and actions">
        <Note>
          When a film has its own set for Reflect or Practice, visitors see only that set: the universal and AI
          questions are no longer offered for it, and visitors have no way back to them. Reflect and Practice are decided
          separately. Leave one empty to keep the universal set there, with the AI set as its one alternative.
        </Note>
        <PromptGroups prompts={film.lgn} tmdbId={film.tmdb_id} canAdd onChanged={load} />
      </Section>

      <AiSet film={film} onChanged={load} />

      <Section title="Remove">
        <DeleteControl
          label="Remove this film’s settings"
          question="Delete its settings and every LGN and AI question for it?"
          busy={false}
          onConfirm={() => {
            void adminFetch(`/api/admin/films/${film.tmdb_id}`, { method: 'DELETE' }).then(onGone, (err) =>
              setError(errorMessage(err)),
            );
          }}
        />
      </Section>
    </div>
  );
}

function Settings({ film, onSaved }: { film: AdminFilmDetail; onSaved: () => void | Promise<void> }) {
  const { draft, dirty, set, reset, commit } = useEditState({
    handling: film.handling as string,
    care_note: film.care_note ?? '',
    logline: film.logline ?? '',
  });
  const save = useSaveState();

  return (
    <Section title="Settings">
      <SelectField
        label="Handling"
        value={draft.handling as Handling}
        options={(Object.keys(HANDLING_LABEL) as Handling[]).map((h) => ({ value: h, label: HANDLING_LABEL[h] }))}
        onChange={(v) => set('handling', v)}
        help="Held: no page and no AI. Universal only: ignore LGN and AI questions for this film."
      />
      <TextArea
        label="Care note"
        rows={3}
        value={draft.care_note}
        onChange={(v) => set('care_note', v)}
        help="Shown at the top of the film’s page (for example 988 and findahelpline.com). Also tells the AI to keep its questions gentle."
      />
      <TextArea
        label="Logline"
        rows={2}
        value={draft.logline}
        onChange={(v) => set('logline', v)}
        help="Optional. Shown only if you write one: TMDB’s own summaries can spoil the film, so they are never shown."
      />
      <SaveBar
        dirty={dirty}
        save={save}
        onReset={reset}
        onSave={() =>
          void save.run(async () => {
            await adminFetch(`/api/admin/films/${film.tmdb_id}`, { method: 'PATCH', body: draft });
            commit(draft);
            await onSaved();
          })
        }
      />
    </Section>
  );
}

function AiSet({ film, onChanged }: { film: AdminFilmDetail; onChanged: () => void | Promise<void> }) {
  const [conflict, setConflict] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const promote = async (replace: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/films/${film.tmdb_id}/promote`, { method: 'POST', body: { replace } });
      setConflict(null);
      await onChanged();
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 409 && film.ai.length > 0) setConflict(err.message);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/films/${film.tmdb_id}/ai`, { method: 'DELETE' });
      await onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const lgnCoversBoth = (['reflect', 'practice'] as const).every((k) => film.lgn.some((p) => p.kind === k));

  return (
    <Section title="AI-generated questions">
      <p className="admin-muted">
        Status: <strong>{AI_LABEL[film.ai_status]}</strong>
        {film.ai_model ? ` · ${film.ai_model}` : ''}. Visitors see these only as a labelled alternative to the universal
        questions, and only for a Reflect or Practice set you haven’t written yourself: once LGN’s own set exists for
        one, that is the only one shown and the AI set is hidden there. Edit anything you like here.
      </p>
      {error && <Alert>{error}</Alert>}
      {conflict && (
        <div className="fa-conflict" role="alert">
          <p>{conflict}</p>
          <button type="button" className="apnl-btn apnl-btn--danger" disabled={busy} onClick={() => void promote(true)}>
            Replace it with the AI set
          </button>
          <button type="button" className="apnl-btn apnl-btn--ghost" onClick={() => setConflict(null)}>Cancel</button>
        </div>
      )}
      {film.ai.length > 0 ? (
        <>
          <div className="apnl-savebar">
            <button type="button" className="apnl-btn apnl-btn--primary" disabled={busy} onClick={() => void promote(false)}>
              Promote to LGN’s set
            </button>
            <span className="apnl-spacer" />
            <DeleteControl
              label="Delete AI set"
              question="Delete it? The next visitor triggers a fresh one."
              busy={busy}
              onConfirm={() => void discard()}
            />
          </div>
          <PromptGroups prompts={film.ai} tmdbId={film.tmdb_id} canAdd={false} onChanged={onChanged} />
        </>
      ) : (
        <>
          <p className="apnl-empty">
            {lgnCoversBoth
              ? 'LGN’s own questions cover both Reflect and Practice, so visitors see only those and no AI set is made for this film.'
              : film.ai_status === 'unavailable'
                ? 'The AI said it doesn’t know this film, so there is no AI option on its page.'
                : 'No AI questions yet. They are made the first time a visitor opens the page, if AI is switched on.'}
          </p>
          {film.ai_status !== 'none' && (
            <button type="button" className="apnl-btn" disabled={busy} onClick={() => void discard()}>
              Reset, so the next visit tries again
            </button>
          )}
        </>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------ universal */

function UniversalPrompts() {
  const [prompts, setPrompts] = useState<AdminPrompt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setPrompts(await adminFetch<AdminPrompt[]>('/api/admin/film-prompts/universal'));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="apnl">
      <PanelHead
        title="Universal questions"
        description="What every film shows until LGN writes its own. Keep the wording film-neutral. These never name a film."
      />
      {error && <Alert>{error}</Alert>}
      {prompts === null && !error ? (
        <p className="admin-muted">Loading…</p>
      ) : (
        <PromptGroups prompts={prompts ?? []} tmdbId={null} canAdd onChanged={load} />
      )}
    </div>
  );
}
