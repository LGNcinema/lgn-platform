import './StoryWatch.css';
import type { CapsuleDetail } from '../../types';

interface Props {
  capsule: CapsuleDetail;
  /** Opens the immersive WatchMode. */
  onEnterWatch: () => void;
}

/** Right column of the Watch section: the film still with a play button.
 *  Figma: [CAMPFIRE]-LIGHTPOLES. */
export function StoryWatch(_props: Props) {
  return <div data-stub="StoryWatch">StoryWatch stub</div>;
}
