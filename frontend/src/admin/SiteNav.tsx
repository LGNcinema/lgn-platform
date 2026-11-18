/**
 * The sidebar's Site pages card, under Storyboard: the pages that aren't a
 * story -- the About pages' text and filmmakers' requests to claim a guide.
 */
export type SitePage = 'about' | 'requests';

interface SiteNavProps {
  active: SitePage | null;
  /** Claim requests waiting for a reply. */
  waitingRequests: number;
  onOpen: (page: SitePage) => void;
}

const PAGES: { id: SitePage; title: string; sub: string }[] = [
  { id: 'about', title: 'About pages', sub: 'Life > Numbers, LGN Cinema, People, FAQs' },
  { id: 'requests', title: 'Filmmaker requests', sub: 'Claims from the For Filmmakers page' },
];

export function SiteNav({ active, waitingRequests, onOpen }: SiteNavProps) {
  return (
    <section className="admin-picker admin-sb-nav" aria-label="Site pages">
      <h2 className="admin-section-title">Site pages</h2>
      {PAGES.map((p) => {
        const count = p.id === 'requests' ? waitingRequests : 0;
        return (
          <button
            key={p.id}
            type="button"
            className={`admin-capsule-row admin-sb-nav-row${active === p.id ? ' is-selected' : ''}`}
            aria-current={active === p.id ? 'page' : undefined}
            onClick={() => onOpen(p.id)}
          >
            <span>
              <span className="admin-sb-nav-title">{p.title}</span>
              <span className="admin-sb-nav-sub">{count > 0 ? `${count} waiting` : p.sub}</span>
            </span>
            {count > 0 && (
              <span className="admin-count" aria-hidden="true">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </section>
  );
}
