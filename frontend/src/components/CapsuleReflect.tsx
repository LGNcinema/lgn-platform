import React, { useEffect, useMemo, useState } from 'react';
import type { CapsuleDetail } from '../types';

interface Props {
  capsule: CapsuleDetail;
}

/**
 * Answers are keyed by the reflection's stable database id, not by its position
 * in the list -- reordering or deleting a reflection in the admin must not make
 * a visitor's saved answer reattach to a different question.
 */
const storageKey = (capsuleId: number, reflectionId: number) =>
  `reflect_${capsuleId}_${reflectionId}`;

export const CapsuleReflect: React.FC<Props> = ({ capsule }) => {
  const reflections = useMemo(() => capsule.reflections ?? [], [capsule.reflections]);

  /** Only the first reflection carries the section-level "at your own pace" note. */
  const intro = reflections.find((r) => r.introduction?.trim())?.introduction?.trim();

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});

  // Restore previously saved answers so they survive a reload.
  useEffect(() => {
    const restoredAnswers: Record<number, string> = {};
    const restoredSaved: Record<number, boolean> = {};

    for (const reflection of reflections) {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(storageKey(capsule.id, reflection.id));
      } catch {
        // Storage can be unavailable (private mode, blocked cookies) -- start blank.
        stored = null;
      }
      if (stored !== null) {
        restoredAnswers[reflection.id] = stored;
        restoredSaved[reflection.id] = stored.length > 0;
      }
    }

    setAnswers(restoredAnswers);
    setSaved(restoredSaved);
  }, [capsule.id, reflections]);

  const handleChange = (reflectionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [reflectionId]: value }));
    setSaved((prev) => ({ ...prev, [reflectionId]: false }));
  };

  const handleSave = (reflectionId: number) => {
    try {
      localStorage.setItem(storageKey(capsule.id, reflectionId), answers[reflectionId] || '');
    } catch {
      // Saving is a convenience; a blocked store should not break the page.
    }
    setSaved((prev) => ({ ...prev, [reflectionId]: true }));
  };

  return (
    <div className="capsule-shell-panel">
      <div className="reflect-section-header">
        <h2 className="reflect-section-title">Reflect</h2>
        <p className="reflect-private-notice">Your reflections are private. Only you can see them.</p>
        {intro && <p className="reflect-private-notice">{intro}</p>}
      </div>

      <div className="reflect-questions-list">
        {reflections.length === 0 ? (
          <p className="reflect-private-notice">
            This capsule&rsquo;s reflections are still being written. Check back soon.
          </p>
        ) : (
          reflections.map((reflection) => {
            const question = reflection.content?.trim() || reflection.title?.trim() || '';
            const label = reflection.title?.trim();
            const showLabel = Boolean(label) && label !== question;

            return (
              <div key={reflection.id} className="reflect-question-block">
                {showLabel && <span className="reflect-private-notice">{label}</span>}
                <h3 className="reflect-question-text">{question}</h3>
                <textarea
                  className="reflect-textarea"
                  placeholder="Take your time..."
                  value={answers[reflection.id] || ''}
                  onChange={(e) => handleChange(reflection.id, e.target.value)}
                  aria-label={question || label || 'Reflection'}
                />
                <button
                  className={`reflect-save-btn${saved[reflection.id] ? ' saved' : ''}`}
                  onClick={() => handleSave(reflection.id)}
                >
                  {saved[reflection.id] ? 'Saved' : 'Save'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
