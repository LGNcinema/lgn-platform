import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import './WatchMode.css';
import type { CapsuleDetail } from '../../types';
import { VideoPlayer } from '../VideoPlayer';
import { posterCandidates, resolveVideoSource } from '../../videoSource';

interface Props {
  capsule: CapsuleDetail;
  /** Leave the immersive view and return to the story page. */
  onExit: () => void;
}

/** The frame's prompt, used when the capsule has none of its own. */
const FALLBACK_PROMPT = 'Before you press play, take a breath—';

/** "16 / 9", "1.85", "2.39:1" -> a number; anything unparseable -> 16/9. The
 *  stage letterboxes the player inside the frame, which needs the ratio as a
 *  number for CSS arithmetic rather than the string VideoPlayer accepts. */
function parseAspectRatio(raw: string | undefined): number {
  const parts = (raw ?? '').split(/[/:]/).map((p) => Number(p.trim()));
  const ratio = parts.length === 2 ? parts[0] / parts[1] : parts[0];
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 16 / 9;
}

/** Immersive, chrome-free viewing: a pre-watch prompt over the dimmed film
 *  still, then the player. The site header and footer are not rendered here.
 *  Figma: [CAMPFIRE]-WATCH.
 *
 *  The frame is 1920x1500 with the still at 1840x1035 (16:9, width-filled).
 *  Here the still fills the viewport minus the page margin on every side
 *  instead, so at 1920x1080 the whole composition is on screen with nothing to
 *  scroll -- a pause before a film should not start with a scrollbar. The
 *  still is cropped with object-fit: cover to whatever shape that leaves. */
export function WatchMode({ capsule, onExit }: Props) {
  const film = capsule.film;
  const [watching, setWatching] = useState(false);
  const [posterIndex, setPosterIndex] = useState(0);
  const watchButtonRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const posters = useMemo(
    () => (film ? posterCandidates(film, resolveVideoSource(film)) : []),
    [film],
  );
  const still = posters[posterIndex] ?? null;
  const prompt = capsule.pre_watch_prompt?.trim() || FALLBACK_PROMPT;
  const supporting = capsule.pre_watch_supporting_text?.trim();

  // A different story resets to its own pre-watch pause.
  useEffect(() => {
    setWatching(false);
    setPosterIndex(0);
  }, [capsule.id]);

  // Land on the one thing this screen asks of the viewer.
  useEffect(() => {
    if (!watching) watchButtonRef.current?.focus();
  }, [watching, capsule.id]);

  // The viewer has already said "Watch", so VideoPlayer is told to start
  // (autoStart) rather than showing its own play button for a second click.
  // That Watch click is still this document's user activation, which the
  // browser's autoplay policy honours for the embed (allow="autoplay").
  // Move focus into the stage so Escape and Tab keep working even though the
  // Watch button that held focus has just unmounted.
  useEffect(() => {
    if (watching) stageRef.current?.focus();
  }, [watching]);

  // Escape leaves. Keystrokes inside a cross-origin player iframe never reach
  // this document, so the visible Back control is the guaranteed way out.
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onExit();
    },
    [onExit],
  );
  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  const stageStyle = {
    '--watch-ratio': parseAspectRatio(film?.video_aspect_ratio),
  } as CSSProperties;

  return (
    <div className="watch-mode">
      {/* Not in the frame: a chrome-free page still needs a way out. It sits in
          the top page margin, in the card's small-label style, so the framed
          composition itself is untouched. */}
      <button type="button" className="watch-mode-back" onClick={onExit}>
        <span aria-hidden="true">&larr;</span> Back
      </button>

      {watching && film ? (
        <div
          ref={stageRef}
          className="watch-mode-frame watch-mode-stage"
          style={stageStyle}
          tabIndex={-1}
          role="region"
          aria-label={`${capsule.title} -- now playing`}
        >
          <VideoPlayer film={film} className="watch-mode-player" autoStart />
        </div>
      ) : (
        <section className="watch-mode-frame" aria-labelledby="watch-mode-prompt">
          {still && (
            <img
              className="watch-mode-still"
              src={still}
              alt=""
              decoding="async"
              onError={() => setPosterIndex((i) => i + 1)}
            />
          )}
          <div className="watch-mode-card">
            <p className="watch-mode-label">{capsule.title}</p>
            <h1 id="watch-mode-prompt" className="watch-mode-prompt">{prompt}</h1>
            {supporting && <p className="watch-mode-supporting">{supporting}</p>}
            {film && (
              <button
                ref={watchButtonRef}
                type="button"
                className="watch-mode-watch"
                onClick={() => setWatching(true)}
              >
                Watch
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
