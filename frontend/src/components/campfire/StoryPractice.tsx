import { useMemo } from 'react';
import './StoryPractice.css';
import type { CapsuleDetail } from '../../types';
import { splitLines } from '../../filmInfo';
import { DimensionSections } from './DimensionSections';
import { byDimension } from './campfire';

interface Props {
  capsule: CapsuleDetail;
}

/**
 * Right column of Practice. Figma v3: "Campfire—practice" -- the same
 * Self / Neighbor / World rows as Reflect, each opening onto a numbered
 * list of steps.
 */
export function StoryPractice({ capsule }: Props) {
  const groups = useMemo(() => byDimension(capsule.practices ?? []), [capsule.practices]);

  return (
    <DimensionSections
      variant="practice"
      resetKey={capsule.id}
      intro={
        <p className="practice-intro">
          {capsule.practice_title?.trim() ||
            'A weekly exercise in rooting. Three levels on engagement with our core practice. Find one that suits you best, or participate in multiple!'}
        </p>
      }
      renderBody={(dimension) => {
        // splitLines, not split('\n'): seeded rows have historically stored
        // the separator as a literal backslash-n.
        const steps = groups[dimension].flatMap((p) => splitLines(p.steps));
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
