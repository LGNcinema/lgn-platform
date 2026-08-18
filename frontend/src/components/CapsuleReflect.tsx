import React, { useState } from 'react';
import type { CapsuleDetail } from '../types';

interface Props {
  capsule: CapsuleDetail;
  onBack: () => void;
}

const REFLECT_QUESTIONS = [
  "What moment in the film stayed with you the longest?",
  "Is there a grief or loss you've been walking with?",
  "What does it mean to you to keep going when the light is dim?",
];

export const CapsuleReflect: React.FC<Props> = ({ capsule, onBack }) => {
  const film = capsule.film;
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});

  const handleChange = (idx: number, value: string) => {
    setAnswers(prev => ({ ...prev, [idx]: value }));
    setSaved(prev => ({ ...prev, [idx]: false }));
  };

  const handleSave = (idx: number) => {
    const key = `reflect_${capsule.id}_${idx}`;
    localStorage.setItem(key, answers[idx] || '');
    setSaved(prev => ({ ...prev, [idx]: true }));
  };

  return (
    <div className="reflect-v2-container">
      <h1 className="reflect-capsule-heading">{capsule.title}</h1>
      {film && (
        <p className="reflect-film-info">
          SISTERS WITH TRANSISTORS a film by LISA ROVNER narrated by LAURIE ANDERSON. 2020. USA. 86 min. A patchwork portrait of several female electronic music pioneers. GUEST-PROGRAMMED BY CYRUS GOBERVILLE FOR OUR SUMMER MUSIC FESTIVAL.
        </p>
      )}

      <div className="reflect-inner-panel">
        <button className="reflect-back-btn" onClick={onBack}>← Back</button>

        <div className="reflect-section-header">
          <h2 className="reflect-section-title">Reflect</h2>
          <p className="reflect-private-notice">Your reflections are private. Only you can see them.</p>
        </div>

        <div className="reflect-questions-list">
          {REFLECT_QUESTIONS.map((question, idx) => (
            <div key={idx} className="reflect-question-block">
              <h3 className="reflect-question-text">{question}</h3>
              <textarea
                className="reflect-textarea"
                placeholder="Take your time..."
                value={answers[idx] || ''}
                onChange={(e) => handleChange(idx, e.target.value)}
                aria-label={question}
              />
              <button
                className={`reflect-save-btn${saved[idx] ? ' saved' : ''}`}
                onClick={() => handleSave(idx)}
              >
                {saved[idx] ? 'Saved' : 'Save'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
