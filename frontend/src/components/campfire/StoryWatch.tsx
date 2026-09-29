import './StoryWatch.css';
import type { CapsuleDetail } from '../../types';

interface Props {
  capsule: CapsuleDetail;
  /** Opens the immersive WatchMode. */
  onEnterWatch: () => void;
}

/** The frame's play mark: a 91px circle of 25% white with a solid white
 *  triangle, drawn at the frame's own coordinates. The triangle is centred on
 *  its centroid rather than its bounding box, so it looks centred. */
function PlayMark() {
  return (
    <svg className="story-watch-play" viewBox="0 0 91 91" aria-hidden="true" focusable="false">
      <circle cx="45.5" cy="45.5" r="45.5" fill="#fff" fillOpacity="0.25" />
      <path d="M73 45.5 31.75 68.45V22.55Z" fill="#fff" />
    </svg>
  );
}

/**
 * Right column of the Watch section: the film still with a centred play
 * button. Figma: [CAMPFIRE]-LIGHTPOLES (1187 x 667 at x=660, y=342, 5px
 * corners -- i.e. the full width of the shell's right column).
 *
 * The whole still is one <button>: clicking anywhere on it opens WatchMode.
 * The player itself is not mounted here, so the page never loads a Vimeo
 * iframe just to show a poster.
 */
export function StoryWatch({ capsule, onEnterWatch }: Props) {
  const film = capsule.film;
  // The still takes the film's own shape so WatchMode opens onto the same
  // frame; `video_aspect_ratio` is a CSS aspect-ratio string.
  const aspectRatio = film?.video_aspect_ratio?.trim() || '16 / 9';

  // No film yet: a neutral panel of the same shape, with nothing to press.
  if (!film) {
    return (
      <div className="story-watch story-watch-empty" style={{ aspectRatio }}>
        <span className="story-watch-empty-text">The film for this story is coming soon.</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`story-watch${film.thumbnail_url ? '' : ' story-watch-no-still'}`}
      style={{ aspectRatio }}
      onClick={onEnterWatch}
      aria-label={film.title ? `Watch ${film.title}` : 'Watch the film'}
    >
      {film.thumbnail_url && (
        // Decorative: the button's label already names the film.
        <img className="story-watch-still" src={film.thumbnail_url} alt="" />
      )}
      <PlayMark />
    </button>
  );
}
