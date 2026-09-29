import './WatchMode.css';
import type { CapsuleDetail } from '../../types';

interface Props {
  capsule: CapsuleDetail;
  /** Leave the immersive view and return to the story page. */
  onExit: () => void;
}

/** Immersive, chrome-free viewing: a pre-watch prompt over the dimmed film
 *  still, then the player. The site header and footer are not rendered here.
 *  Figma: [CAMPFIRE]-WATCH. */
export function WatchMode(_props: Props) {
  return <div data-stub="WatchMode">WatchMode stub</div>;
}
