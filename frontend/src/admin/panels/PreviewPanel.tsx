/**
 * PreviewPanel -- the story as the public site will render it.
 *
 * The page itself is `PreviewFrame`, which mounts the *real* public components
 * (header, `StoryShell` and its sections, the immersive `WatchMode`, footer), so
 * what is on screen is the site's own markup and stylesheet -- not a second,
 * drifting copy of it.
 *
 * It runs in an iframe exactly 1920 x 1080, scaled down to fit. The public
 * layout is measured against the window (`--dp` is 100vw / 1920, columns are
 * placed from the page centre), so mounted straight into the admin column it
 * was laid out for the admin's whole window while squeezed into part of it,
 * and came out wrong. In its own 1920-wide window it lays out exactly as on a
 * 1920 x 1080 screen; the scale only shrinks the picture. Expand fills the
 * screen with it for a closer look.
 *
 * The story is posted into the frame rather than fetched there, so it is the
 * draft this tab already holds. Nothing here is a public route: the frame shows
 * nothing unless this tab sends it a story, so an unpublished film (Vimeo id
 * and private hash) is never reachable by link.
 *
 * Pressing the film still opens the real immersive player, and it really plays
 * -- that is how the editor confirms the right film is attached.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { API_URL } from '../../api';
import type { CapsuleSummary } from '../../types';
import { PREVIEW_READY, type PreviewMessage } from '../PreviewFrame';
import { formatLocal, localTimeLabel, parseNaiveUtc, publicationState } from '../publishing';
import { StatusPill } from '../StatusPill';
import { Note, PanelHead } from './Fields';
import type { PanelProps } from './Fields';

/** The screen the preview reproduces: the size the Figma frames are drawn at. */
const FRAME_W = 1920;
const FRAME_H = 1080;

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
  const storyNumber = useStoryNumber(capsule.id, capsule.month);
  const [expanded, setExpanded] = useState(false);
  const [scale, setScale] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Send the story to the frame. Again whenever it is saved, and whenever the
  // frame says it is (re)loaded and listening.
  const post = useCallback(() => {
    const message: PreviewMessage = { type: 'lgn-preview', capsule, storyNumber };
    frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, [capsule, storyNumber]);

  useEffect(post, [post]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      if ((event.data as { type?: string } | undefined)?.type === PREVIEW_READY) post();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [post]);

  // Fit the 1920 x 1080 frame to the space it has: the column's width inline,
  // the whole screen when expanded.
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const fit = () => {
      const cs = getComputedStyle(el);
      const width = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const height = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      setScale(expanded ? Math.min(width / FRAME_W, height / FRAME_H) : width / FRAME_W);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

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
          the <strong>Watch</strong> tab.
        </Note>
      ) : null}

      {/* The same element inline and expanded, so the frame is never reloaded
          and keeps whichever section and scroll position the editor is on. */}
      <figure
        className={`apnl-preview-frame${expanded ? ' is-expanded' : ''}`}
        aria-label="Preview of this story's public page"
      >
        <figcaption className="apnl-preview-chrome">
          <span className="apnl-preview-badge">Preview</span>
          <StatusPill state={state} />
          <span className="apnl-preview-chrome-text">
            {stateLine} Shown as on a {FRAME_W} &times; {FRAME_H} screen
            {scale > 0 ? `, at ${Math.round(scale * 100)}%` : ''}.
          </span>
          <button type="button" className="admin-btn-ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Close (Esc)' : 'Expand'}
          </button>
        </figcaption>

        <div ref={viewportRef} className="apnl-preview-viewport">
          <div
            className="apnl-preview-scaler"
            style={{ width: FRAME_W * scale, height: FRAME_H * scale }}
          >
            <iframe
              ref={frameRef}
              className="apnl-preview-iframe"
              src="/admin/preview-frame"
              title="Public page preview"
              width={FRAME_W}
              height={FRAME_H}
              style={{ transform: `scale(${scale})` }}
            />
          </div>
        </div>
      </figure>
    </div>
  );
}
