/** The sidebar card for Go Beyond films, under Stories and Storyboard. */
interface Props {
  /** Which page of the films area is open, or null when elsewhere. */
  active: 'list' | 'universal' | 'inbox' | null;
  inboxNew: number;
  /** Whether visitors can see the feature; null until known. */
  live: boolean | null;
  onOpen: (path: string) => void;
}

export function FilmsNav({ active, inboxNew, live, onOpen }: Props) {
  const row = (id: 'list' | 'universal' | 'inbox', path: string, title: string, sub: string, count = 0) => (
    <button
      type="button"
      className={`admin-capsule-row admin-sb-nav-row${active === id ? ' is-selected' : ''}`}
      aria-current={active === id ? 'page' : undefined}
      onClick={() => onOpen(path)}
    >
      <span>
        <span className="admin-sb-nav-title">{title}</span>
        <span className="admin-sb-nav-sub">{sub}</span>
      </span>
      {count > 0 && (
        <span className="admin-count" aria-hidden="true">
          {count}
        </span>
      )}
    </button>
  );

  return (
    <section className="admin-picker admin-sb-nav" aria-label="Go Beyond films">
      <h2 className="admin-section-title">Go Beyond films</h2>
      {row(
        'list',
        '/admin/films',
        'Films',
        live === null ? 'Any film, outside the monthly stories' : live ? 'On for visitors' : 'Off for visitors',
      )}
      {row('universal', '/admin/films/universal', 'Universal questions', 'Shown for every film by default')}
      {row('inbox', '/admin/films/inbox', 'Inbox', inboxNew > 0 ? `${inboxNew} new` : 'Nothing new', inboxNew)}
    </section>
  );
}
