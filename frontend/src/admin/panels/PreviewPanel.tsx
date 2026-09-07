/**
 * PreviewPanel -- the capsule as the public site will render it.
 *
 * This mounts the *real* public components (`CapsuleView`, `CapsuleReflect`,
 * `CapsuleDiscuss`, `CapsulePractice`) with the draft the admin already fetched,
 * so what is on screen is the site's own markup and the site's own stylesheet --
 * not a second, drifting copy of it. As on the public page, the capsule shell
 * (title + credit line) stays put and only the grey panel inside it is swapped;
 * this panel's own view buttons stand in for the shell's section nav.
 *
 * It lives behind the admin token on purpose. An unpublished capsule's film
 * carries a Vimeo id and private hash, so a public preview URL would hand out an
 * unreleased film to anyone holding the link. There is deliberately no public
 * preview route.
 *
 * The player inside `CapsuleView` is the real one and really plays -- that is
 * how the editor confirms the right film is attached.
 */
import { useState } from 'react';
import { CapsuleDiscuss } from '../../components/CapsuleDiscuss';
import { CapsulePractice } from '../../components/CapsulePractice';
import { CapsuleReflect } from '../../components/CapsuleReflect';
import { CapsuleView } from '../../components/CapsuleView';
import { buildFilmInfo } from '../../filmInfo';
import { formatLocal, localTimeLabel, parseNaiveUtc, publicationState } from '../publishing';
import { StatusPill } from '../StatusPill';
import { Note, PanelHead } from './Fields';
import type { PanelProps } from './Fields';

type PreviewView = 'capsule' | 'reflect' | 'discuss' | 'practice';

const VIEWS: { id: PreviewView; label: string }[] = [
  { id: 'capsule', label: 'Capsule' },
  { id: 'reflect', label: 'Reflect' },
  { id: 'discuss', label: 'Discuss' },
  { id: 'practice', label: 'Practice' },
];

export function PreviewPanel({ capsule }: PanelProps) {
  const [view, setView] = useState<PreviewView>('capsule');

  const state = publicationState(capsule);
  const scheduledAt = parseNaiveUtc(capsule.publish_at);

  const stateLine = (() => {
    switch (state) {
      case 'published':
        return 'Published -- this is what visitors see now.';
      case 'scheduled':
        return scheduledAt
          ? `Scheduled -- not visible on the site until ${formatLocal(scheduledAt)} (${localTimeLabel()}).`
          : 'Scheduled -- not visible on the site yet.';
      case 'due':
        return scheduledAt
          ? `Its scheduled time (${formatLocal(scheduledAt)}) has passed -- the site is already serving this.`
          : 'Its scheduled time has passed -- the site is already serving this.';
      case 'draft':
      default:
        return 'Draft -- not visible on the site.';
    }
  })();

  return (
    <div className="apnl apnl--wide">
      <PanelHead
        title="Preview"
        description="How this capsule will look on the public site, rendered with the site's own components. Nothing here is visible to anyone else until the capsule is published."
      />

      <Note>
        The preview shows the <strong>last saved version</strong> of this capsule. Save your edits on
        the other tabs first, then come back to see them here.
      </Note>

      {!capsule.film ? (
        <Note>
          No film is attached yet, so the player area shows the site's own placeholder. Add one on
          the <strong>Film &amp; Video</strong> tab.
        </Note>
      ) : null}

      <div className="apnl-preview-nav" role="group" aria-label="Preview view">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`apnl-btn apnl-preview-navbtn${view === item.id ? ' is-chosen' : ''}`}
            aria-pressed={view === item.id}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <figure className="apnl-preview-frame" aria-label={`Preview of the ${view} view`}>
        <figcaption className="apnl-preview-chrome">
          <span className="apnl-preview-badge">Preview</span>
          <StatusPill state={state} />
          <span className="apnl-preview-chrome-text">{stateLine}</span>
        </figcaption>

        {/* Everything below this element is public markup under public classes.
            `apnl-preview-stage` resets what the portal's own typography would
            otherwise inherit into it -- see the scoping note in panels.css. */}
        <div className="apnl-preview-stage">
          <div className="capsule-view-wrapper">
            <div className="capsule-content-area">
              <div className="capsule-shell">
                <h1 className="capsule-shell-heading">{capsule.title}</h1>
                {capsule.film && (
                  <p className="capsule-shell-film-info">{buildFilmInfo(capsule.film)}</p>
                )}

                {view === 'capsule' && (
                  <CapsuleView capsule={capsule} onNavigate={(next) => setView(next)} />
                )}
                {view === 'reflect' && <CapsuleReflect capsule={capsule} />}
                {view === 'discuss' && <CapsuleDiscuss capsule={capsule} />}
                {view === 'practice' && <CapsulePractice capsule={capsule} />}
              </div>
            </div>
          </div>
        </div>
      </figure>
    </div>
  );
}
