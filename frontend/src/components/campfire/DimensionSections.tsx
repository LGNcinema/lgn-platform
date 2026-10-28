import { useEffect, useId, useState, type ReactNode } from 'react';
import './DimensionSections.css';
import { DIMENSIONS, type Dimension } from './campfire';

interface Props {
  /** Resets the open section when the film changes. */
  resetKey: number;
  /** The copy above the three sections. */
  intro: ReactNode;
  /** The open section's body. */
  renderBody: (dimension: Dimension) => ReactNode;
  /** Practice's list leaves more room under it than Reflect's form. */
  variant: 'reflect' | 'practice';
}

/**
 * Self / Neighbor / World, the layout Reflect and Practice share in V3.
 * Figma: "Campfire—reflect", "Campfire—practice" -- intro copy, then three
 * ruled rows with 48px names; one is open at a time ("v"), the others show
 * ">". Self is open to start.
 */
export function DimensionSections({ resetKey, intro, renderBody, variant }: Props) {
  const [open, setOpen] = useState<Dimension | null>('self');
  const ids = useId();

  useEffect(() => setOpen('self'), [resetKey]);

  return (
    <div className={`dim dim--${variant}`}>
      <div className="dim-intro">{intro}</div>
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
