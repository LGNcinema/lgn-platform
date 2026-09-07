import React from 'react';
import type { CapsuleDetail } from '../types';
import { splitLines } from '../filmInfo';

interface Props {
  capsule: CapsuleDetail;
}

export const CapsuleDiscuss: React.FC<Props> = ({ capsule }) => {
  const circles = capsule.discussion_circles ?? [];

  return (
    <div className="capsule-shell-panel">
      <h2 className="reflect-section-title">Discuss</h2>
      <p className="discuss-guide-note">
        Note for the circle: Listen without trying to fix one another. Authenticity is crucial. Passing is always welcome.
      </p>

      {circles.length === 0 ? (
        <div className="discuss-guide-circle">
          <p className="discuss-guide-col-text">
            This capsule&rsquo;s discussion circles are still being written. Check back soon.
          </p>
        </div>
      ) : (
        circles.map((circle) => {
          const openingRound = circle.opening_round?.trim();
          const prompts = splitLines(circle.discuss_prompts);
          const closingQuestion = circle.closing_question?.trim();
          const title = circle.title?.trim();

          return (
            <div key={circle.id} className="discuss-guide-circle">
              {title && <h3 className="discuss-guide-circle-title">{title}</h3>}
              <div className="discuss-guide-columns">
                {openingRound && (
                  <div className="discuss-guide-col">
                    <span className="discuss-guide-col-label">Opening round</span>
                    <p className="discuss-guide-col-text">{openingRound}</p>
                  </div>
                )}
                {prompts.length > 0 && (
                  <div className="discuss-guide-col">
                    <span className="discuss-guide-col-label">Discuss:</span>
                    {prompts.map((prompt, i) => (
                      <p key={i} className="discuss-guide-col-text">{prompt}</p>
                    ))}
                  </div>
                )}
                {closingQuestion && (
                  <div className="discuss-guide-col">
                    <span className="discuss-guide-col-label">Closing question:</span>
                    <p className="discuss-guide-col-text">{closingQuestion}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
