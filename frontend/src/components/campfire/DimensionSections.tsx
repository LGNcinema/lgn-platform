import { useEffect, useId, useState, type ReactNode } from 'react';
import './DimensionSections.css';
import { DIMENSIONS, type Dimension } from './campfire';

interface Props {
  /** Closes the open section when the film changes. */
  resetKey: number;
  /** The open section's body. */
  renderBody: (dimension: Dimension) => ReactNode;
  /** Practice's list leaves more room under it than Reflect's form. */
  variant: 'reflect' | 'practice';
}

/**
 * Self / Neighbor / World, the layout Reflect and Practice share in V3.
 * Figma: "Campfire—reflect", "Campfire—practice" -- three ruled rows with
 * the names in display type; one is open at a time ("v"), the others show
 * ">". All start closed (UX, 2026-11), and there is no copy above them.
 */
export function DimensionSections({ resetKey, renderBody, variant }: Props) {
  const [open, setOpen] = useState<Dimension | null>(null);
  const ids = useId();

  useEffect(() => setOpen(null), [resetKey]);

  return (
    <div className={`dim dim--${variant}`}>
      <div className="dim-list">
        {DIMENSIONS.map(({ key, label }) => {
          const isOpen = open === key;
          return (
            <section key={key} className={`dim-row${isOpen ? ' open' : ''}`}>
              <h2 className="dim-heading">
                <button
                  type="button"
                  className="dim-toggle"
                  aria-expanded={isOpen}
                  aria-controls={`${ids}-${key}`}
                  onClick={() => setOpen(isOpen ? null : key)}
                >
                  <span>{label}</span>
                  <span className="dim-chevron" aria-hidden="true">{isOpen ? 'v' : '>'}</span>
                </button>
              </h2>
              <div id={`${ids}-${key}`} className="dim-body" hidden={!isOpen}>
                {isOpen && renderBody(key)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
