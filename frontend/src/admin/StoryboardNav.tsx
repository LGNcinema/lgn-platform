/**
 * The sidebar's Storyboard card, under Stories: the way into the Storyboard
 * page, where every story's submissions are reviewed in one place. Shows how
 * many are waiting across all stories.
 */
interface StoryboardNavProps {
  /** The Storyboard page is the one open. */
  active: boolean;
  /** Submissions waiting for review, across every story. */
  waiting: number;
  onOpen: () => void;
}

export function StoryboardNav({ active, waiting, onOpen }: StoryboardNavProps) {
  return (
    <section className="admin-picker admin-sb-nav" aria-label="Storyboard">
      <h2 className="admin-section-title">Storyboard</h2>
      <button
        type="button"
        className={`admin-capsule-row admin-sb-nav-row${active ? ' is-selected' : ''}`}
        aria-current={active ? 'page' : undefined}
        onClick={onOpen}
      >
        <span>
          <span className="admin-sb-nav-title">All submissions</span>
          <span className="admin-sb-nav-sub">
            {waiting > 0 ? `${waiting} waiting for review` : 'Nothing waiting for review'}
          </span>
        </span>
        {waiting > 0 && (
          <span className="admin-count" aria-hidden="true">
            {waiting}
          </span>
        )}
      </button>
    </section>
  );
}
