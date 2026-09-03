import React, { useEffect, useState } from 'react';
import type { CapsuleDetail, GemeTuning } from '../types';
import { GemeChat } from './GemeChat';
import { API_URL } from '../api';

interface Props {
  capsule: CapsuleDetail;
  onBack: () => void;
  // Dev tuning panel overrides. `tuningVersion` bumps on each Apply so the chat
  // remounts and the new settings are heard from the first word.
  gemeTuning?: GemeTuning | null;
  gemeTuningVersion?: number;
}

// Stand-in copy for capsules that don't have a practice written into the CMS yet.
// Mirrors the hand-picked Lightpoles exercise: one epigraph, one invitation, a few
// questions to sit with.
const FALLBACK_PRACTICE = {
  title: 'Notice What You Can Offer',
  epigraph:
    'Jon looks at the lightpole in daylight and says: “Takes dark to know what it’s for.”',
  description:
    'Bring one person in your life to mind. Set a timer for three minutes and give them your full attention.',
  steps: [
    'What might they need right now?',
    'What has one of your own difficult seasons helped you develop — patience, courage, understanding, humor, or simply the ability to be present?',
    'Choose one small way to offer that to them this week.',
  ],
};

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

export const CapsulePractice: React.FC<Props> = ({
  capsule, onBack, gemeTuning, gemeTuningVersion = 0,
}) => {
  const film = capsule.film;
  const [chatOpen, setChatOpen] = useState(false);
  const [gemeEnabled, setGemeEnabled] = useState<boolean | null>(null);
  const [savedStep, setSavedStep] = useState<string | null>(null);

  const stepStorageKey = `geme_next_step_${capsule.id}`;

  // The Geme card stays on the page either way, but the button only invites a
  // conversation the server can actually hold.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/geme/status`)
      .then((res) => (res.ok ? res.json() : { enabled: false }))
      .then((data) => {
        if (!cancelled) setGemeEnabled(Boolean(data.enabled));
      })
      .catch(() => {
        if (!cancelled) setGemeEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A step kept from an earlier conversation lives in this browser only.
  useEffect(() => {
    if (chatOpen) return;
    setSavedStep(localStorage.getItem(stepStorageKey));
  }, [chatOpen, stepStorageKey]);

  const practice = capsule.practices?.[0];
  const practiceTitle = practice?.title || FALLBACK_PRACTICE.title;
  const practiceDescription = practice?.description || FALLBACK_PRACTICE.description;
  const practiceSteps = practice?.steps
    ? practice.steps.split('\n').map((step) => step.trim()).filter(Boolean)
    : FALLBACK_PRACTICE.steps;

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

        {/* This capsule's hand-picked exercise: text left, image right */}
        <div className="practice-v2-hero">
          <div className="practice-v2-hero-text">
            <h2 className="practice-v2-cta-title">{practiceTitle}</h2>
            {!practice && (
              <p className="practice-v2-epigraph">{FALLBACK_PRACTICE.epigraph}</p>
            )}
            <p className="practice-v2-cta-desc">{practiceDescription}</p>
            <ul className="practice-v2-steps">
              {practiceSteps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ul>
          </div>
          <div className="practice-v2-hero-image">
            <img src="/images/practice-image.jpg" alt="Practice visual" />
          </div>
        </div>

        {/* Keep Exploring: inward with Geme, outward with SAWA */}
        <div className="practice-explore">
          <h3 className="practice-explore-heading">Keep Exploring</h3>
          <div className="practice-explore-grid">

            <div className="practice-explore-card">
              <span className="practice-explore-label">Take It Inward</span>
              <div className="practice-explore-card-head">
                <img className="practice-explore-avatar" src="/images/geme.png" alt="Geme" />
                <h4 className="practice-explore-title">Talk It Through with Geme</h4>
              </div>
              <p className="practice-explore-text">
                Explore what this film and this practice stirred in you. Geme will ask a few
                thoughtful questions, help you notice what matters to you, and help you name one
                small next step.
              </p>

              {savedStep && (
                <div className="practice-saved-step">
                  <span className="practice-saved-step-label">Your last step</span>
                  <p className="practice-saved-step-text">{savedStep}</p>
                </div>
              )}

              {gemeEnabled === false ? (
                <p className="practice-explore-unavailable">
                  Geme isn’t available right now. Check back soon.
                </p>
              ) : (
                <button
                  className="practice-explore-btn"
                  onClick={() => setChatOpen(true)}
                  disabled={gemeEnabled === null}
                >
                  Talk with Geme &nbsp;&#8599;
                </button>
              )}
            </div>

            <div className="practice-explore-card">
              <span className="practice-explore-label">Take It Outward</span>
              <div className="practice-explore-card-head">
                <div className="practice-explore-avatar placeholder" aria-hidden="true" />
                <h4 className="practice-explore-title">Find a Way to Serve with SAWA</h4>
              </div>
              <p className="practice-explore-text">
                Find a volunteer opportunity connected to what you care about, the time you have,
                and the community around you.
              </p>
              {/* Placeholder until the SAWA integration lands */}
              <button className="practice-explore-btn" disabled>
                Explore with SAWA &nbsp;&#8599;
              </button>
              <span className="practice-explore-soon">Coming soon</span>
            </div>

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

      {chatOpen && (
        <GemeChat
          key={gemeTuningVersion}
          capsule={capsule}
          onClose={() => setChatOpen(false)}
          tuning={gemeTuning}
        />
      )}
    </div>
  );
};
