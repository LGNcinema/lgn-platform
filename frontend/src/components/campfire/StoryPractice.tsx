import { useMemo, useState } from 'react';
import './StoryPractice.css';
import type { CapsuleDetail } from '../../types';
import { splitLines } from '../../filmInfo';
import { DimensionSections } from './DimensionSections';
import { byDimension, DIMENSIONS, type Dimension } from './campfire';
import { CalendarDialog } from './StoryDialogs';

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
  // The circle whose "Add to Calendar" popup is open.
  const [calendarFor, setCalendarFor] = useState<Dimension | null>(null);
  const calendarSteps = calendarFor ? groups[calendarFor].flatMap((p) => splitLines(p.steps)) : [];

  return (
    <>
      <DimensionSections
        variant="practice"
        resetKey={capsule.id}
        renderBody={(dimension) => {
          // splitLines, not split('\n'): seeded rows have historically stored
          // the separator as a literal backslash-n.
          const steps = groups[dimension].flatMap((p) => splitLines(p.steps));
          const tips = groups[dimension].map((p) => p.tips?.trim()).filter(Boolean);
          return steps.length > 0 ? (
            <>
              {/* Figma "PRACTICE": the instruction in black, then the grey
                  "For example:" options, lettered. Until the practice model
                  settles (UX), the first line is the instruction and the
                  rest are the options. */}
              <p className="practice-instruction">{steps[0]}</p>
              {steps.length > 1 && (
                <div className="practice-examples">
                  <p>For example:</p>
                  <ol type="a">
                    {steps.slice(1).map((step, i) => (
                      <li key={i}>{step.replace(/^for example[,:]?\s*/i, '')}</li>
                    ))}
                  </ol>
                </div>
              )}
              {tips.length > 0 && (
                <div className="practice-tips">
                  <p className="lgn-label">Tips</p>
                  {tips.map((tip, i) => (
                    <p key={i} className="practice-tips-text">
                      {tip}
                    </p>
                  ))}
                </div>
              )}
              <button type="button" className="lgn-btn practice-calendar" onClick={() => setCalendarFor(dimension)}>
                Add to Calendar
              </button>
            </>
          ) : (
            <p className="practice-steps-empty">This practice is still being written. Check back soon.</p>
          );
        }}
      />
      <CalendarDialog
        open={calendarFor !== null}
        onClose={() => setCalendarFor(null)}
        title={capsule.title}
        circle={DIMENSIONS.find((d) => d.key === calendarFor)?.label ?? ''}
        note={calendarSteps.join('\n')}
      />
    </>
  );
}
