import React, { useState } from 'react';
import type { CapsuleDetail } from '../types';

interface Props {
  capsule: CapsuleDetail;
  onBack: () => void;
}

// Placeholder community responses
const COMMUNITY_RESPONSES = [
  {
    id: 1,
    user: "User No.1",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    featured: true,
  },
  {
    id: 2,
    user: "User No.1",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    featured: false,
  },
  {
    id: 3,
    user: "User No.1",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    featured: false,
  },
  {
    id: 4,
    user: "User No.1",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    featured: false,
  },
];

export const CapsuleDiscuss: React.FC<Props> = ({ capsule, onBack }) => {
  const [experience, setExperience] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem(`discuss_${capsule.id}`, experience);
    setSaved(true);
  };

  const featuredResponse = COMMUNITY_RESPONSES.find(r => r.featured);
  const otherResponses = COMMUNITY_RESPONSES.filter(r => !r.featured);

  return (
    <div className="discuss-v2-container">
      <button className="reflect-back-btn" onClick={onBack}>← Back</button>

      <h1 className="discuss-v2-heading">Share about your experience</h1>

      {/* Top two-col: textarea left, featured community card right */}
      <div className="discuss-v2-top-grid">
        <div className="discuss-v2-input-col">
          <textarea
            className="discuss-v2-textarea"
            placeholder="Take your time..."
            value={experience}
            onChange={(e) => { setExperience(e.target.value); setSaved(false); }}
            aria-label="Share your experience"
          />
          <button
            className={`reflect-save-btn${saved ? ' saved' : ''}`}
            onClick={handleSave}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>

        {featuredResponse && (
          <div className="discuss-community-card featured">
            <div className="discuss-card-user">
              <div className="discuss-avatar" />
              <span className="discuss-username">{featuredResponse.user}</span>
            </div>
            <p className="discuss-card-text">{featuredResponse.text}</p>
          </div>
        )}
      </div>

      {/* Bottom row: 3 community cards */}
      <div className="discuss-v2-cards-row">
        {otherResponses.map((resp) => (
          <div key={resp.id} className="discuss-community-card">
            <div className="discuss-card-user">
              <div className="discuss-avatar" />
              <span className="discuss-username">{resp.user}</span>
            </div>
            <p className="discuss-card-text">{resp.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
