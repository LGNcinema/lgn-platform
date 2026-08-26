import React from 'react';
import type { CapsuleDetail } from '../types';

interface Props {
  capsule: CapsuleDetail;
  onBack: () => void;
}

const PATHWAY_CARDS = [
  {
    title: 'Alternate Pathway Here',
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  },
  {
    title: 'Additional Resource Here',
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  },
  {
    title: 'Related Material Here',
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  },
];

export const CapsulePractice: React.FC<Props> = ({ capsule, onBack }) => {
  const film = capsule.film;

  return (
    <div className="practice-v2-container">
      <h1 className="practice-v2-capsule-heading">{capsule.title}</h1>
      {film && (
        <p className="reflect-film-info">
          SISTERS WITH TRANSISTORS a film by LISA ROVNER narrated by LAURIE ANDERSON. 2020. USA. 86 min. A patchwork portrait of several female electronic music pioneers. GUEST-PROGRAMMED BY CYRUS GOBERVILLE FOR OUR SUMMER MUSIC FESTIVAL.
        </p>
      )}

      <div className="practice-inner-panel">
        <button className="reflect-back-btn" onClick={onBack}>← Back</button>

        <p className="practice-v2-section-label">Practice</p>

        {/* Hero: big text left, image right */}
        <div className="practice-v2-hero">
          <div className="practice-v2-hero-text">
            <h2 className="practice-v2-cta-title">
              Main Call to Action: An Accessible Invitation&nbsp;↗
            </h2>
            <p className="practice-v2-cta-desc">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
          </div>
          <div className="practice-v2-hero-image">
            <img src="/images/practice-image.jpg" alt="Practice visual" />
          </div>
        </div>

        {/* Other Ways to Connect */}
        <div className="practice-v2-pathways">
          <h3 className="practice-v2-pathways-heading">Other ways to connect</h3>
          <div className="practice-v2-cards-grid">
            {PATHWAY_CARDS.map((card, idx) => (
              <div key={idx} className="practice-v2-card">
                <div className="practice-v2-card-image" />
                <h4 className="practice-v2-card-title">{card.title}</h4>
                <p className="practice-v2-card-text">{card.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

