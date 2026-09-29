import './StoryPractice.css';
import type { CapsuleDetail, GemeTuning } from '../../types';

interface Props {
  capsule: CapsuleDetail;
  /** Pass-through for the dev-only Geme tuning panel. */
  gemeTuning: GemeTuning | null;
  gemeTuningVersion: number;
}

/** Right column of the Practice section: three engagement levels, then Geme.
 *  Figma: [CAMPFIRE]-PRACTICE. */
export function StoryPractice(_props: Props) {
  return <div data-stub="StoryPractice">StoryPractice stub</div>;
}
