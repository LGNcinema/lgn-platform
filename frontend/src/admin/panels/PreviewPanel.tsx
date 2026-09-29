/**
 * PreviewPanel -- the story as the public site will render it.
 *
 * This mounts the *real* public Campfire components (`StoryShell` with
 * `StoryWatch`, `StoryReflect`, `StoryPractice`, `StoryMaking`, and the
 * immersive `WatchMode`) with the draft the admin already fetched, so what is on
 * screen is the site's own markup and the site's own stylesheet -- not a second,
 * drifting copy of it. It used to mount the pre-Campfire capsule components, and
 * went on showing staff that old design after the public site had moved on; the
 * point of mounting the real components is that this cannot happen, so it has
 * to follow the site whenever the site's components change.
 *
 * The shell's own Watch / Reflect / Practice nav drives the preview, exactly as
 * it does for visitors. Its "The Campfire" crumb and "Add to Storyboard" link
 * lead to pages that don't exist inside a single-story preview, so they do
 * nothing here.
 *
 * It lives behind the admin token on purpose. An unpublished capsule's film
 * carries a Vimeo id and private hash, so a public preview URL would hand out an
 * unreleased film to anyone holding the link. There is deliberately no public
 * preview route.
 *
 * Pressing the film still opens the real immersive player, and it really plays
 * -- that is how the editor confirms the right film is attached.
 */
import { useEffect, useState } from 'react';
import { API_URL } from '../../api';
import { StoryMaking } from '../../components/campfire/StoryMaking';
import { StoryPractice } from '../../components/campfire/StoryPractice';
import { StoryReflect } from '../../components/campfire/StoryReflect';
import { StoryShell } from '../../components/campfire/StoryShell';
import { StoryWatch } from '../../components/campfire/StoryWatch';
import { WatchMode } from '../../components/campfire/WatchMode';
import type { StorySection } from '../../components/campfire/campfire';
import type { CapsuleSummary } from '../../types';
import { formatLocal, localTimeLabel, parseNaiveUtc, publicationState } from '../publishing';
import { StatusPill } from '../StatusPill';
import { Note, PanelHead } from './Fields';
import type { PanelProps } from './Fields';

const noop = () => {};

/**
 * The "Story No." this capsule will carry on the public site.
 *
 * The site numbers stories by their place among PUBLISHED stories in month
 * order. For a published capsule that is exact. For a draft or scheduled one it
 * is the number it will get when it goes live, assuming nothing earlier is
 * published first -- which is the useful answer for a preview.
 */
function useStoryNumber(capsuleId: number, month: string): number {
  const [number, setNumber] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/api/capsules`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<CapsuleSummary[]>) : []))
      .then((published) => {
        const earlier = published.filter((c) => c.id !== capsuleId && c.month < month).length;
        setNumber(earlier + 1);
      })
      .catch(() => {
        // Aborted, or offline: keep the fallback. A wrong story number is a
        // cosmetic miss in a preview, not worth an error on the panel.
      });
    return () => controller.abort();
  }, [capsuleId, month]);

  return number;
}

export function PreviewPanel({ capsule }: PanelProps) {
  const [section, setSection] = useState<StorySection>('watch');
  const [watching, setWatching] = useState(false);
  const storyNumber = useStoryNumber(capsule.id, capsule.month);

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
        description="How this story will look on the public site, rendered with the site's own components. Nothing here is visible to anyone else until the story is published."
      />

      <Note>
        The preview shows the <strong>last saved version</strong> of this story. Save your edits on
        the other tabs first, then come back to see them here.
      </Note>

      {!capsule.film ? (
        <Note>
          No film is attached yet, so the Watch section shows the site's own placeholder. Add one on
          the <strong>Film &amp; Video</strong> tab.
        </Note>
      ) : null}

      {capsule.discussion_circles.length > 0 ? (
        <Note>
          This story has discussion circles. They are kept here for reference, but the public site no
          longer shows a Discuss section, so they don't appear in the preview.
        </Note>
      ) : null}

      <figure className="apnl-preview-frame" aria-label="Preview of this story's public page">
        <figcaption className="apnl-preview-chrome">
          <span className="apnl-preview-badge">Preview</span>
          <StatusPill state={state} />
          <span className="apnl-preview-chrome-text">{stateLine}</span>
        </figcaption>

        {/* Everything below this element is public markup under public classes.
            `apnl-preview-stage` resets what the portal's own typography would
            otherwise inherit into it -- see the scoping note in panels.css. */}
        <div className="apnl-preview-stage">
          {watching ? (
            <WatchMode capsule={capsule} onExit={() => setWatching(false)} />
          ) : (
            <StoryShell
              capsule={capsule}
              storyNumber={storyNumber}
              section={section}
              onSelectSection={setSection}
              onBackToCampfire={noop}
              onAddToStoryboard={noop}
            >
              {section === 'watch' && <StoryWatch capsule={capsule} onEnterWatch={() => setWatching(true)} />}
              {section === 'reflect' && <StoryReflect capsule={capsule} />}
              {section === 'practice' && (
                <StoryPractice capsule={capsule} gemeTuning={null} gemeTuningVersion={0} />
              )}
              {section === 'making' && <StoryMaking capsule={capsule} />}
            </StoryShell>
          )}
        </div>
      </figure>
    </div>
  );
}
