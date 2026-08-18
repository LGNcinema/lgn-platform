import React from 'react';
import type { CapsuleDetail } from '../types';

interface Props {
  capsule: CapsuleDetail;
  onBack: () => void;
}

interface DiscussCircle {
  title: string;
  openingRound: string[];
  discuss: string[];
  closingQuestion: string;
}

const CIRCLES: DiscussCircle[] = [
  {
    title: 'Circle 1: Light and Darkness',
    openingRound: [
      'Each person shares the first word that comes to mind when they hear "light," followed by the first word that comes to mind when they hear "darkness."',
    ],
    discuss: [
      'What patterns or differences do you notice?',
      'When can light expose, overwhelm, or harm?',
      'When can darkness offer rest, privacy, mystery, or protection?',
    ],
    closingQuestion: 'What kind of light do you want to bring into the lives around you?',
  },
  {
    title: 'Circle 2: Resilience and Mourning',
    openingRound: [
      'Choose one: share a time when you had to endure, or a time when you allowed yourself to mourn.',
      'What did the experience reveal about what mattered to you?',
    ],
    discuss: [
      'When is resilience life-giving?',
      'When can resilience become a way of avoiding grief?',
      'What can mourning teach us that achievement cannot?',
    ],
    closingQuestion: 'What does the way you respond to difficulty reveal about your values?',
  },
];

const OVERALL_CLOSING_QUESTION = 'Is purpose something we find, choose, receive, or practice?';

export const CapsuleDiscuss: React.FC<Props> = ({ capsule, onBack }) => {
  const film = capsule.film;

  return (
    <div className="discuss-guide-container">
      <h1 className="reflect-capsule-heading">{capsule.title}</h1>
      {film && (
        <p className="reflect-film-info">
          SISTERS WITH TRANSISTORS a film by LISA ROVNER narrated by LAURIE ANDERSON. 2020. USA. 86 min. A patchwork portrait of several female electronic music pioneers. GUEST-PROGRAMMED BY CYRUS GOBERVILLE FOR OUR SUMMER MUSIC FESTIVAL.
        </p>
      )}

      <div className="discuss-guide-inner-panel">
        <button className="reflect-back-btn" onClick={onBack}>← Back</button>

        <h2 className="reflect-section-title">Discuss</h2>
        <p className="discuss-guide-note">
          Note for the circle: Listen without trying to fix one another. Authenticity is crucial. Passing is always welcome.
        </p>

        {CIRCLES.map((circle, idx) => (
          <div key={idx} className="discuss-guide-circle">
            <h3 className="discuss-guide-circle-title">{circle.title}</h3>
            <div className="discuss-guide-columns">
              <div className="discuss-guide-col">
                <span className="discuss-guide-col-label">Opening round</span>
                {circle.openingRound.map((line, i) => (
                  <p key={i} className="discuss-guide-col-text">{line}</p>
                ))}
              </div>
              <div className="discuss-guide-col">
                <span className="discuss-guide-col-label">Discuss:</span>
                {circle.discuss.map((line, i) => (
                  <p key={i} className="discuss-guide-col-text">{line}</p>
                ))}
              </div>
              <div className="discuss-guide-col">
                <span className="discuss-guide-col-label">Closing question:</span>
                <p className="discuss-guide-col-text">{circle.closingQuestion}</p>
              </div>
            </div>
          </div>
        ))}

        <p className="discuss-guide-overall-closing">
          Closing question: {OVERALL_CLOSING_QUESTION}
        </p>
      </div>
    </div>
  );
};
