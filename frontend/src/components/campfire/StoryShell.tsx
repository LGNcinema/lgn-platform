import type { ReactNode } from 'react';
import './StoryShell.css';
import type { CapsuleDetail } from '../../types';
import { buildFilmInfo } from '../../filmInfo';
import { STORY_NAV_SECTIONS, formatStoryMonth, type StorySection } from './campfire';

interface Props {
  capsule: CapsuleDetail;
  storyNumber: number;
  section: StorySection;
  onSelectSection: (section: StorySection) => void;
  onBackToCampfire: () => void;
  onAddToStoryboard: () => void;
  /** The active section's content, rendered in the right column. */
  children: ReactNode;
}

/**
 * The story page frame shared by Watch, Reflect and Practice.
 * Figma: [CAMPFIRE]-LIGHTPOLES, -REFLECT, -PRACTICE -- the left column is
 * identical across all three, so it stays mounted and only the right column
 * swaps when the section changes.
 *
 * Layout: the card sits on the page's 6-column grid. The left column spans
 * columns 1-2 and the right column 3-6.
 *
 * SCAFFOLD: structure and rough proportions only. Owned by the shell agent,
 * who replaces this with a measured match to the frames.
 */
export function StoryShell({
  capsule,
  storyNumber,
  section,
  onSelectSection,
  onBackToCampfire,
  onAddToStoryboard,
  children,
}: Props) {
  const hasMaking = Boolean(capsule.film?.bts_text?.trim() || capsule.film?.screenplay_text?.trim());

  return (
    <div className="story-shell">
      <button type="button" className="story-shell-crumb" onClick={onBackToCampfire}>
        The Campfire
      </button>

      <div className="story-shell-card">
        <div className="story-shell-left">
          <div className="story-shell-label">Story No. {storyNumber}</div>
          <h1 className="story-shell-title">{capsule.title}</h1>
          {capsule.film && <p className="story-shell-film-info">{buildFilmInfo(capsule.film)}</p>}
          {hasMaking && (
            <button type="button" className="story-shell-more" onClick={() => onSelectSection('making')}>
              More on making this film&rarr;
            </button>
          )}

          <nav className="story-shell-nav" aria-label="Story sections">
            {STORY_NAV_SECTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`story-shell-nav-btn${section === key ? ' active' : ''}`}
                aria-current={section === key ? 'page' : undefined}
                onClick={() => onSelectSection(key)}
              >
                {label}
              </button>
            ))}
          </nav>

          <button type="button" className="story-shell-storyboard" onClick={onAddToStoryboard}>
            Add to Storyboard&rarr;
          </button>
        </div>

        <div className="story-shell-right">
          <div className="story-shell-label">{formatStoryMonth(capsule.month)}</div>
          {children}
        </div>
      </div>
    </div>
  );
}
