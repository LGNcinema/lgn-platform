import './CampfireHome.css';
import type { CapsuleSummary } from '../../types';

interface Props {
  /** Published stories only (the public API never returns drafts). */
  stories: CapsuleSummary[];
  onOpenStory: (capsuleId: number) => void;
}

/** The Campfire hub. Figma: [CAMPFIRE]-HOME. */
export function CampfireHome(_props: Props) {
  return <div data-stub="CampfireHome">CampfireHome stub</div>;
}
