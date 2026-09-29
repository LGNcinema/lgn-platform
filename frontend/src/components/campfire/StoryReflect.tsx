import './StoryReflect.css';
import type { CapsuleDetail } from '../../types';

interface Props {
  capsule: CapsuleDetail;
}

/** Right column of the Reflect section. PRIVATE: nothing is sent to the
 *  server; "Keep a copy" gives the visitor their own text.
 *  Figma: [CAMPFIRE]-REFLECT. */
export function StoryReflect(_props: Props) {
  return <div data-stub="StoryReflect">StoryReflect stub</div>;
}
