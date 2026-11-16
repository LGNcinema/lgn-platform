/**
 * One film: its questions (the part LGN comes here for) and, tucked away, the
 * settings and the buttons most films never need.
 */
import { useCallback, useEffect, useState } from 'react';
import { filmFacts } from '../../components/beyond/beyond';
import { adminFetch } from '../adminClient';
import { Alert, DeleteControl, Disclosure, SaveBar, SelectField, TextArea } from '../panels/Fields';
import { errorMessage, useEditState, useSaveState } from '../panels/formState';
import { AI_LABEL, HANDLING_LABEL, type AdminFilmDetail, type AdminPrompt, type Handling } from './filmsTypes';
import { QuestionSets } from './QuestionSets';

interface Props {
  tmdbId: number;
  /** The film was removed, or could not be loaded: back to the list. */
  onGone: () => void;
}

export function FilmEditor({ tmdbId, onGone }: Props) {
  const [film, setFilm] = useState<AdminFilmDetail | null>(null);
  const [universal, setUniversal] = useState<AdminPrompt[]>([]);
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
    // The universal questions show as hints in this film's empty boxes.
    adminFetch<AdminPrompt[]>('/api/admin/film-prompts/universal').then(setUniversal, () => undefined);
  }, [load]);

  if (error) {
    return (
      <>
        <Alert>{error}</Alert>
        <button type="button" className="apnl-btn" onClick={onGone}>Back to films</button>
      </>
    );
  }
  if (!film) return <p className="admin-muted">Loading…</p>;

  const title = film.film?.title ?? `Film ${film.tmdb_id}`;

  return (
    <>
      <header className="fa-film-head">
        <h3 className="fa-film-title">{title}</h3>
        <p className="admin-muted">
          {film.film ? filmFacts(film.film) : 'TMDB details unavailable right now.'}
          {' · '}
          <a href={`/?view=film&tmdb=${film.tmdb_id}`} target="_blank" rel="noreferrer">Preview on the site ↗</a>
        </p>
      </header>

      <QuestionSets
        saved={film.lgn}
        ai={film.ai}
        universal={universal}
        endpointFor={(kind) => `/api/admin/films/${film.tmdb_id}/prompts/${kind}`}
        onSaved={load}
      />

      <FilmSettings film={film} onSaved={load} onGone={onGone} />
    </>
  );
}

/** What the selected option does, in the terms the server applies. */
const HANDLING_HELP: Record<Handling, string> = {
  normal: 'LGN’s questions where you’ve written them; the universal ones everywhere else.',
  universal_only: 'Always the universal questions, even if LGN or the AI has written some for this film.',
  held: 'This film has no page: visitors can’t open it, and no AI draft is written.',
};

function FilmSettings({ film, onSaved, onGone }: { film: AdminFilmDetail; onSaved: () => void | Promise<void>; onGone: () => void }) {
  const { draft, dirty, set, reset, commit } = useEditState({
    handling: film.handling as string,
    care_note: film.care_note ?? '',
    logline: film.logline ?? '',
  });
  const save = useSaveState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What is set shows on the closed section, so nothing hides in it.
  const set_ = [
    film.handling !== 'normal' ? HANDLING_LABEL[film.handling] : null,
    film.care_note ? 'care note' : null,
    film.logline ? 'logline' : null,
  ].filter(Boolean);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Disclosure summary={`Film settings${set_.length ? ` · ${set_.join(' · ')}` : ''}`}>
      <SelectField
        label="Handling"
        value={draft.handling as Handling}
        options={(Object.keys(HANDLING_LABEL) as Handling[]).map((h) => ({ value: h, label: HANDLING_LABEL[h] }))}
        onChange={(v) => set('handling', v)}
        help={HANDLING_HELP[draft.handling as Handling]}
      />
      <TextArea
        label="Care note"
        rows={3}
        value={draft.care_note}
        onChange={(v) => set('care_note', v)}
        help="Shown at the top of the film’s page (for example 988 and findahelpline.com), and tells the AI to keep its questions gentle."
      />
      <TextArea
        label="Logline"
        rows={2}
        value={draft.logline}
        onChange={(v) => set('logline', v)}
        help="Optional, and only shown if you write one: TMDB’s own summaries can spoil the film."
      />
      <SaveBar
        dirty={dirty}
        save={save}
        saveLabel="Save settings"
        onReset={() => {
          reset();
          save.clearError();
        }}
        onSave={() =>
          void save.run(async () => {
            await adminFetch(`/api/admin/films/${film.tmdb_id}`, { method: 'PATCH', body: draft });
            commit(draft);
            await onSaved();
          })
        }
      />

      <div className="fa-foot">
        <p className="admin-muted">
          AI draft: {AI_LABEL[film.ai_status]}
          {film.ai_model ? ` (${film.ai_model})` : ''}.{' '}
          {film.ai_status !== 'none' && (
            <button
              type="button"
              className="apnl-btn apnl-btn--link"
              disabled={busy}
              onClick={() => void run(async () => {
                await adminFetch(`/api/admin/films/${film.tmdb_id}/ai`, { method: 'DELETE' });
                await onSaved();
              })}
            >
              Discard it, so the next visit writes a new one
            </button>
          )}
        </p>
        {error && <Alert>{error}</Alert>}
        <DeleteControl
          label="Remove this film"
          question="Delete its settings and every LGN and AI question for it?"
          busy={busy}
          onConfirm={() => void run(async () => {
            await adminFetch(`/api/admin/films/${film.tmdb_id}`, { method: 'DELETE' });
            onGone();
          })}
        />
      </div>
    </Disclosure>
  );
}
