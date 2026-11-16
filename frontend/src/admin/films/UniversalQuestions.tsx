/** The questions every film shows until LGN writes its own. */
import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '../adminClient';
import { Alert } from '../panels/Fields';
import { errorMessage } from '../panels/formState';
import type { AdminPrompt } from './filmsTypes';
import { QuestionSets } from './QuestionSets';

export function UniversalQuestions() {
  const [rows, setRows] = useState<AdminPrompt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRows(await adminFetch<AdminPrompt[]>('/api/admin/film-prompts/universal'));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Alert>{error}</Alert>;
  if (rows === null) return <p className="admin-muted">Loading…</p>;

  return (
    <>
      <p className="admin-muted">Keep the wording film-neutral: these never name a film.</p>
      <QuestionSets
        saved={rows}
        endpointFor={(kind) => `/api/admin/film-prompts/universal/${kind}`}
        isUniversal
        onSaved={load}
      />
    </>
  );
}
