import './Storyboard.css';
import type { CapsuleDetail } from '../../types';

interface Props {
  capsule: CapsuleDetail;
  storyNumber: number;
  onBackToCampfire: () => void;
}

/** A story's storyboard: add your story (with explicit consent), and -- once
 *  the story's month has ended -- the stories others agreed to share.
 *  Figma: [CAMPFIRE]-STORYBOARD. */
export function Storyboard(_props: Props) {
  return <div data-stub="Storyboard">Storyboard stub</div>;
}
