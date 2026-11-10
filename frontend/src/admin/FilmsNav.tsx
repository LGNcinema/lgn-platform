/** The sidebar card for Go Beyond films, under Stories and Storyboard: one row, like the Storyboard's. */
interface Props {
  /** Somewhere in the films area is open. */
  active: boolean;
  /** Whether visitors can see the feature; null until known. */
  live: boolean | null;
  /** Visitor notes nobody has dealt with yet. */
  inboxNew: number;
  onOpen: () => void;
}

export function FilmsNav({ active, live, inboxNew, onOpen }: Props) {
  const status = live === null ? '' : live ? 'On for visitors' : 'Off for visitors';
  return (
    <section className="admin-picker admin-sb-nav" aria-label="Go Beyond films">
      <h2 className="admin-section-title">Go Beyond films</h2>
      <button
        type="button"
        className={`admin-capsule-row admin-sb-nav-row${active ? ' is-selected' : ''}`}
        aria-current={active ? 'page' : undefined}
        onClick={onOpen}
      >
        <span>
          <span className="admin-sb-nav-title">Films and questions</span>
          <span className="admin-sb-nav-sub">
            {[status, inboxNew > 0 ? `${inboxNew} new` : ''].filter(Boolean).join(' · ') || 'Any film, beyond the stories'}
          </span>
        </span>
        {inboxNew > 0 && (
          <span className="admin-count" aria-hidden="true">
            {inboxNew}
          </span>
        )}
      </button>
    </section>
  );
}
