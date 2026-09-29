import type { ReactNode } from 'react';
import './StoryShell.css';
import type { CapsuleDetail } from '../../types';
import { FilmCredit } from './FilmCredit';
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
 * The story page frame shared by Watch, Reflect, Practice and "making of".
 * Figma: [CAMPFIRE]-LIGHTPOLES, -REFLECT, -PRACTICE -- the left column is
 * identical across all three, so it stays mounted and only the right column
 * swaps when the section changes.
 *
 * Layout (measured at 1920): a white card at x=40..1880, y=274, 769 tall.
 * The left column starts 20px in; the right column runs x=660..1856 (1196
 * wide), leaving 24px on the right. That is not quite the page grid (column 3
 * starts at 664) -- the frames win. See StoryShell.css for how the frames'
 * two right edges were reconciled. The right
 * column owns its padding so the section components can simply fill it.
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
  const film = capsule.film;
  const hasMaking = Boolean(film?.bts_text?.trim() || film?.screenplay_text?.trim());

  return (
    <div className="story-shell">
      <button type="button" className="story-shell-crumb" onClick={onBackToCampfire}>
        The Campfire
      </button>

      <div className="story-shell-card">
        <div className="story-shell-left">
          {/* The intro has a minimum height so the section nav sits at the
              same height for every story, however long its credit line
              (the frame's four-line credit is the reference). A longer credit
              pushes the nav down instead of overlapping it. */}
          <div className="story-shell-intro">
            <div className="story-shell-label">Story No. {storyNumber}</div>
            <h1 className="story-shell-title">{capsule.title}</h1>
            {film && <FilmCredit film={film} className="story-shell-credit" />}
            {hasMaking && (
              <button
                type="button"
                className="story-shell-more"
                aria-current={section === 'making' ? 'page' : undefined}
                onClick={() => onSelectSection('making')}
              >
                <span className="story-shell-underline">More on making this film</span>&rarr;
              </button>
            )}
          </div>

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
            <span className="story-shell-underline">Add to Storyboard</span>&rarr;
          </button>
        </div>

        <div className="story-shell-right">
          <div className="story-shell-label story-shell-month">{formatStoryMonth(capsule.month)}</div>
          {children}
        </div>
      </div>
    </div>
  );
}
