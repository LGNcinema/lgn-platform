/**
 * "Go Beyond films" in the admin: one header (the title and the on/off switch),
 * three tabs, and whichever page is open.
 *
 *   /admin/films             Films: find or add one, open one
 *   /admin/films/:tmdbId     one film (the Films tab stays lit)
 *   /admin/films/universal   the questions every film shows until LGN writes its own
 *   /admin/films/inbox       what visitors sent
 */
import { useMatch } from 'react-router-dom';
import { FilmEditor } from './FilmEditor';
import { FilmInbox } from './FilmInbox';
import { FilmList } from './FilmList';
import { UniversalQuestions } from './UniversalQuestions';
import { VisitorSwitch } from './VisitorSwitch';
import type { BeyondFlag } from './useBeyondFlag';
import './films.css';

interface Props {
  flag: BeyondFlag;
  /** Notes waiting in the inbox. */
  inboxNew: number;
  /** The inbox badge in the sidebar should re-read. */
  onInboxChanged: () => void;
  /** Go to another page of this area. The shell asks first if there is unsaved work. */
  go: (path: string) => void;
}

export function FilmsAdmin({ flag, inboxNew, onInboxChanged, go }: Props) {
  const which = useMatch('/admin/films/:which')?.params.which;
  const id = Number(which);
  const filmId = which && Number.isInteger(id) && id > 0 ? id : null;
  const page = which === 'inbox' ? 'inbox' : which === 'universal' ? 'universal' : 'films';

  const tabs = [
    { id: 'films', label: 'Films', path: '/admin/films' },
    { id: 'universal', label: 'Universal questions', path: '/admin/films/universal' },
    { id: 'inbox', label: inboxNew > 0 ? `Inbox (${inboxNew})` : 'Inbox', path: '/admin/films/inbox' },
  ];

  return (
    <div className="apnl fa">
      <header className="fa-head">
        <h2 className="fa-title">Films and questions</h2>
        <VisitorSwitch flag={flag} />
      </header>
      {flag.state && !flag.state.enabled && (
        <p className="fa-head-note">Visitors can’t see any of this yet. Before you turn it on, TMDB must have approved LGN’s use in writing.</p>
      )}

      <nav className="admin-tabs fa-tabs" aria-label="Go Beyond films">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={page === t.id ? 'page' : undefined}
            className={`admin-tab${page === t.id ? ' is-active' : ''}`}
            onClick={() => go(t.path)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {page === 'inbox' ? (
        <FilmInbox onChanged={onInboxChanged} onOpenFilm={(tmdbId) => go(`/admin/films/${tmdbId}`)} />
      ) : page === 'universal' ? (
        <UniversalQuestions />
      ) : filmId ? (
        <FilmEditor key={filmId} tmdbId={filmId} onGone={() => go('/admin/films')} />
      ) : (
        <FilmList onOpen={(tmdbId) => go(`/admin/films/${tmdbId}`)} />
      )}
    </div>
  );
}
