import { useEffect, useState, type ReactNode } from 'react';
import './StoryShell.css';
import { API_URL } from '../../api';
import type { CapsuleDetail, GemeTuning } from '../../types';
import { GemeChat } from '../GemeChat';
import { FilmCredit } from './FilmCredit';
import { STORY_NAV_SECTIONS, type StorySection } from './campfire';

/**
 * Geme's entry point, the icon in the panel's bottom-left corner. Off for the
 * first version of the site: the chat (GemeChat), its API and the dev tuning
 * panel all remain, so turning this back on is the whole change.
 */
const SHOW_GEME = false;

interface Props {
  capsule: CapsuleDetail;
  /** The three small caps labels across the top of the panel, at the left
   *  margin and the two column lines. A story: "LGN", "Story No. 1",
   *  "January 2027". */
  labels: [ReactNode, ReactNode, ReactNode];
  section: StorySection;
  onSelectSection: (section: StorySection) => void;
  onBackToCampfire: () => void;
  /** Pass-through for the dev-only Geme tuning panel. */
  gemeTuning: GemeTuning | null;
  gemeTuningVersion: number;
  /** Replaces the film credit under the title (the search page's own copy). */
  intro?: ReactNode;
  /** At the foot of the left column (above Geme, when shown): Watch's "How this film was
   *  made" button. */
  leftFoot?: ReactNode;
  /** The active section's content, rendered in the right column. */
  children: ReactNode;
}

/**
 * The film page frame shared by Watch, Reflect and Practice. Figma v3:
 * "Campfire—lightpoles", "—reflect", "—practice" (and "—search", which
 * reuses it for any film).
 *
 * "< Campfire" over an #EDEDED panel (x 40..1880, y 274, 877 tall at 1920).
 * Across its top, three small labels at x = 61 / 660 / 1280. Below: the
 * title, credit and section links on the left; the section on the right
 * (from x = 660). Geme, the Campfire's guide, sits in the bottom-left corner
 * on every section.
 */
export function StoryShell({
  capsule,
  labels,
  section,
  onSelectSection,
  onBackToCampfire,
  gemeTuning,
  gemeTuningVersion,
  intro,
  leftFoot,
  children,
}: Props) {
  const film = capsule.film;
  const [chatOpen, setChatOpen] = useState(false);
  // null = still asking. Geme only appears once the server says it can talk.
  const [gemeEnabled, setGemeEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!SHOW_GEME) return;
    let cancelled = false;
    fetch(`${API_URL}/api/geme/status`)
      .then((res) => (res.ok ? res.json() : { enabled: false }))
      .then((data) => {
        if (!cancelled) setGemeEnabled(Boolean(data.enabled));
      })
      .catch(() => {
        if (!cancelled) setGemeEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="story-shell">
      <button type="button" className="story-shell-back" onClick={onBackToCampfire}>
        &lt; Go Beyond
      </button>

      <div className="story-shell-panel">
        <div className="story-shell-labels lgn-label">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
          <span>{labels[2]}</span>
        </div>

        <div className="story-shell-left">
          {/* A minimum height, so the section links sit at the same height
              for every film however long its credit; a longer one pushes
              them down instead of overlapping. */}
          <div className="story-shell-intro">
            <h1 className="story-shell-title">{capsule.title}</h1>
            {intro ?? (film && <FilmCredit film={film} className="story-shell-credit" />)}
          </div>

          <nav className="story-shell-nav" aria-label="Film sections">
            {STORY_NAV_SECTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`lgn-link story-shell-nav-btn${section === key ? ' active' : ''}`}
                aria-current={section === key ? 'page' : undefined}
                onClick={() => onSelectSection(key)}
              >
                {label}
              </button>
            ))}
          </nav>

          {leftFoot && <div className="story-shell-foot">{leftFoot}</div>}

          {SHOW_GEME && gemeEnabled && (
            <button type="button" className="story-shell-geme" onClick={() => setChatOpen(true)}>
              <img src="/images/geme.png" alt="Talk with Geme" />
            </button>
          )}
        </div>

        <div className="story-shell-right">{children}</div>
      </div>

      {chatOpen && (
        // Keyed on the tuning version so an Apply in the dev panel starts a
        // fresh conversation with the new settings from the first word.
        <GemeChat key={gemeTuningVersion} capsule={capsule} onClose={() => setChatOpen(false)} tuning={gemeTuning} />
      )}
    </div>
  );
}
