import { useEffect, useState, type ReactNode } from 'react';
import './StoryShell.css';
import { API_URL } from '../../api';
import type { CapsuleDetail, GemeTuning } from '../../types';
import { filmFacts } from '../../filmInfo';
import { GemeChat } from '../GemeChat';
import { GUIDE_TIERS, GuidesDialog, tierDots } from './GuidesDialog';
import { CastCrewDialog, ShareDialog, SupportDialog } from './StoryDialogs';
import { STORY_NAV_SECTIONS, type StorySection } from './campfire';

/**
 * Geme's entry point, the icon in the panel's bottom-left corner. Off for the
 * first version of the site: the chat (GemeChat), its API and the dev tuning
 * panel all remain, so turning this back on is the whole change.
 */
const SHOW_GEME = false;

interface Props {
  capsule: CapsuleDetail;
  /** The guide's tier, 1-4 (Universal ... LGN + Filmmaker), shown as dots at
   *  the panel's top left. LGN Presents stories are all 4. */
  tier?: number;
  section: StorySection;
  onSelectSection: (section: StorySection) => void;
  onBackToCampfire: () => void;
  /** "For Filmmakers >" in "How these guides are made". */
  onOpenFilmmakers?: () => void;
  /** Pass-through for the dev-only Geme tuning panel. */
  gemeTuning: GemeTuning | null;
  gemeTuningVersion: number;
  /** Replaces the film credit under the title (the search page's own copy). */
  intro?: ReactNode;
  /** At the foot of the left column (above Geme, when shown): Watch's
   *  "Beyond the Screen" / "Behind the film", or "Add to the storyboard". */
  leftFoot?: ReactNode;
  /** The active section's content, rendered in the right column. */
  children: ReactNode;
}


/**
 * The film page frame shared by Watch, Reflect and Practice. Figma V3:
 * "LGN PRESENTS—FEATURED", "REFLECT", "PRACTICE" (and "SEARCH—WATCH", which
 * reuses it for any film).
 *
 * "<" over an #EDEDED panel (x 40..1880 at 1920). Across its top: the guide's
 * tier as dots ("●●●● LGN + FILMMAKER") at the left, "HOW THESE GUIDES ARE
 * MADE" and "SHARE" from the 660 line, "NEED SUPPORT?" at the right -- each
 * opening its popup. Below: the title, the Watch / Reflect / Practice tabs,
 * the film's details and "+ Cast and Crew" on the left, buttons at its foot;
 * the section on the right (from x = 660).
 */
export function StoryShell({
  capsule,
  tier = 4,
  section,
  onSelectSection,
  onBackToCampfire,
  onOpenFilmmakers,
  gemeTuning,
  gemeTuningVersion,
  intro,
  leftFoot,
  children,
}: Props) {
  const film = capsule.film;
  const [chatOpen, setChatOpen] = useState(false);
  const [popup, setPopup] = useState<'guides' | 'share' | 'support' | 'credits' | null>(null);
  const facts = filmFacts(film);
  const credits = capsule.bts_credits?.trim();
  const tierInfo = GUIDE_TIERS[Math.min(Math.max(tier, 1), 4) - 1];
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
      <button type="button" className="story-shell-back" aria-label="Back to Go Beyond" onClick={onBackToCampfire}>
        &lt;
      </button>

      <div className="story-shell-panel">
        <div className="story-shell-labels lgn-label">
          <span className="story-shell-tier">
            <span className="story-shell-dots" aria-hidden="true">{tierDots(tier)}</span>
            {tierInfo.label}
          </span>
          <span className="story-shell-label-links">
            <button type="button" className="story-shell-label-btn" onClick={() => setPopup('guides')}>
              How these guides are made
            </button>
            <button type="button" className="story-shell-label-btn" onClick={() => setPopup('share')}>
              Share
            </button>
          </span>
          <button type="button" className="story-shell-label-btn story-shell-support" onClick={() => setPopup('support')}>
            Need support?
          </button>
        </div>

        <div className="story-shell-left">
          {/* A minimum height, so the section links sit at the same height
              for every film however long its credit; a longer one pushes
              them down instead of overlapping. */}
          <div className="story-shell-intro">
            <h1 className="story-shell-title">{capsule.title}</h1>
            {intro}
          </div>

          <nav className="story-shell-nav" aria-label="Film sections">
            {STORY_NAV_SECTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`story-shell-tab${section === key ? ' active' : ''}`}
                aria-current={section === key ? 'page' : undefined}
                onClick={() => onSelectSection(key)}
              >
                {label}
              </button>
            ))}
          </nav>

          {(facts.length > 0 || film?.description || credits) && (
            <div className="story-shell-facts">
              {facts.length > 0 && (
                <p>
                  {facts.map((f, i) => (
                    <span key={i}>
                      {i > 0 && <br />}
                      {f}
                    </span>
                  ))}
                </p>
              )}
              {film?.description?.trim() && <p className="story-shell-description">{film.description.trim()}</p>}
              {credits && (
                <button type="button" className="story-shell-cast" onClick={() => setPopup('credits')}>
                  + Cast and Crew
                </button>
              )}
            </div>
          )}

          {leftFoot && <div className="story-shell-foot">{leftFoot}</div>}

          {SHOW_GEME && gemeEnabled && (
            <button type="button" className="story-shell-geme" onClick={() => setChatOpen(true)}>
              <img src="/images/geme.png" alt="Talk with Geme" />
            </button>
          )}
        </div>

        <div className="story-shell-right">{children}</div>
      </div>

      <GuidesDialog open={popup === 'guides'} onClose={() => setPopup(null)} onOpenFilmmakers={onOpenFilmmakers} />
      <ShareDialog open={popup === 'share'} onClose={() => setPopup(null)} title={capsule.title} />
      <SupportDialog open={popup === 'support'} onClose={() => setPopup(null)} />
      {credits && (
        <CastCrewDialog open={popup === 'credits'} onClose={() => setPopup(null)} title={capsule.title} credits={credits} />
      )}

      {chatOpen && (
        // Keyed on the tuning version so an Apply in the dev panel starts a
        // fresh conversation with the new settings from the first word.
        <GemeChat key={gemeTuningVersion} capsule={capsule} onClose={() => setChatOpen(false)} tuning={gemeTuning} />
      )}
    </div>
  );
}

interface StoryFootProps {
  capsule: CapsuleDetail;
  section: StorySection;
  /** "Behind the film >": the story's Behind the Film page. Omit to hide. */
  onOpenMaking?: () => void;
  onAddToStoryboard: () => void;
}

/**
 * The buttons at the foot of the panel's left column. Watch: "Beyond the
 * Screen" (the filmmaker's interview in LGN's YouTube series, when the story
 * has one) over "Behind the film". Reflect and Practice: "Add to the
 * storyboard".
 */
export function StoryFoot({ capsule, section, onOpenMaking, onAddToStoryboard }: StoryFootProps) {
  if (section !== 'watch') {
    return (
      <button type="button" className="lgn-btn" onClick={onAddToStoryboard}>
        Add to the storyboard
      </button>
    );
  }
  const spark = capsule.spark_url?.trim();
  if (!spark && !onOpenMaking) return null;
  return (
    <>
      {spark && (
        <a className="lgn-btn" href={spark} target="_blank" rel="noopener noreferrer">
          Beyond the Screen
        </a>
      )}
      {onOpenMaking && (
        <button type="button" className="lgn-btn" onClick={onOpenMaking}>
          Behind the film
        </button>
      )}
    </>
  );
}
