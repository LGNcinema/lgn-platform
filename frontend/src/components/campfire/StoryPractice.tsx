import { useMemo, type ReactNode } from 'react';
import './StoryPractice.css';
import type { CapsuleDetail } from '../../types';
import { splitLines } from '../../filmInfo';
import { DimensionSections } from './DimensionSections';
import { byDimension, type Dimension } from './campfire';

interface Props {
  capsule: CapsuleDetail;
}

/**
 * Right column of Practice. Figma v3: "Campfire—practice" -- the same
 * Self / Neighbor / World rows as Reflect, each opening onto a numbered
 * list of steps.
 */
export function StoryPractice({ capsule }: Props) {
  return (
    <PracticeSections
      resetKey={capsule.id}
      practices={capsule.practices ?? []}
      intro={
        <p className="practice-intro">
          {capsule.practice_title?.trim() ||
            'A weekly exercise in rooting. Three levels on engagement with our core practice. Find one that suits you best, or participate in multiple!'}
        </p>
      }
    />
  );
}

export interface PracticeItem {
  dimension?: Dimension | null;
  steps: string | null;
  tips?: string | null;
}

/** Practice's three circles on plain data, shared by a story and any other film. */
export function PracticeSections({
  resetKey,
  intro,
  practices,
}: {
  resetKey: string | number;
  intro: ReactNode;
  practices: PracticeItem[];
}) {
  const groups = useMemo(() => byDimension(practices), [practices]);

  return (
    <DimensionSections
      variant="practice"
      resetKey={resetKey}
      intro={intro}
      renderBody={(dimension) => {
        // splitLines, not split('\n'): seeded rows have historically stored
        // the separator as a literal backslash-n.
        const steps = groups[dimension].flatMap((p) => splitLines(p.steps ?? ''));
        const tips = groups[dimension].map((p) => p.tips?.trim()).filter(Boolean);
        return steps.length > 0 ? (
          <>
            <ol className="practice-steps">
              {steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            {tips.length > 0 && (
              <div className="practice-tips">
                <p className="lgn-label">Tips</p>
                {tips.map((tip, i) => (
                  <p key={i} className="practice-tips-text">{tip}</p>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="practice-steps-empty">This practice is still being written. Check back soon.</p>
        );
      }}
    />
  );
}
