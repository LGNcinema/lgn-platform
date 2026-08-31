import React from 'react';
import type { CapsuleDetail } from '../types';
import { buildFilmInfo, splitLines } from '../filmInfo';

interface Props {
  capsule: CapsuleDetail;
  onBack: () => void;
}

export const CapsulePractice: React.FC<Props> = ({ capsule, onBack }) => {
  const film = capsule.film;
  const filmInfo = film ? buildFilmInfo(film) : '';
  const practices = capsule.practices ?? [];

  /**
   * The hero carries the section framing rather than a single practice. In the
   * real content the first practice's `description` is written about the whole
   * set ("Choose one practice for the month, move through all three, or choose
   * your own."), and the card grid is a three-up that the three practices fill
   * exactly -- promoting one practice into the hero would both leave a gap in
   * the grid and hide that practice's steps, which the hero has no slot for.
   */
  const heroText = practices[0]?.description?.trim() ?? '';

  return (
    <div className="practice-v2-container">
      <h1 className="practice-v2-capsule-heading">{capsule.title}</h1>
      {filmInfo && <p className="reflect-film-info">{filmInfo}</p>}

      <div className="practice-inner-panel">
        <button className="reflect-back-btn" onClick={onBack}>← Back</button>

        <p className="practice-v2-section-label">Practice</p>

        {/* Hero: section framing left, image right */}
        {heroText && (
          <div className="practice-v2-hero">
            <div className="practice-v2-hero-text">
              <h2 className="practice-v2-cta-title">{heroText}</h2>
            </div>
            <div className="practice-v2-hero-image">
              <img src="/images/practice-image.jpg" alt="" />
            </div>
          </div>
        )}

        {/* The practices themselves */}
        <div className="practice-v2-pathways">
          <h3 className="practice-v2-pathways-heading">Ways to practice</h3>
          {practices.length === 0 ? (
            <p className="practice-v2-cta-desc">
              This capsule&rsquo;s practices are still being written. Check back soon.
            </p>
          ) : (
            <div className="practice-v2-cards-grid">
              {practices.map((practice, idx) => {
                const description = practice.description?.trim();
                // The first description is already the hero framing -- don't repeat it.
                const showDescription = Boolean(description) && idx !== 0;
                const steps = splitLines(practice.steps);
                const title = practice.title?.trim();

                return (
                  <div key={practice.id} className="practice-v2-card">
                    <div className="practice-v2-card-image" />
                    {title && <h4 className="practice-v2-card-title">{title}</h4>}
                    {showDescription && <p className="practice-v2-card-text">{description}</p>}
                    {steps.map((step, i) => (
                      <p key={i} className="practice-v2-card-text">{step}</p>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
