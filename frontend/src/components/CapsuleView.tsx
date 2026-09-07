import React from 'react';
import type { CapsuleDetail } from '../types';
import { VideoPlayer } from './VideoPlayer';

interface Props {
  capsule: CapsuleDetail;
  onNavigate: (view: 'reflect' | 'practice' | 'discuss') => void;
}

/**
 * The capsule's default panel: the film itself, plus the three ways into it.
 * The capsule title, credit line and section nav live on the shell around this
 * (see App.tsx) and stay put while this panel is swapped out.
 */
export const CapsuleView: React.FC<Props> = ({ capsule, onNavigate }) => {
  const film = capsule.film;

  return (
    <div className="capsule-shell-panel">
      <div className="capsule-v2-video-wrapper">
        {film ? (
          <VideoPlayer film={film} />
        ) : (
          <div className="no-film-placeholder">No film associated with this capsule yet.</div>
        )}
      </div>

      {film && (
        <a href="#" className="read-about-link">READ ABOUT MAKING THIS FILM &rarr;</a>
      )}

      <div className="capsule-v2-action-row">
        <button className="capsule-v2-action-btn" onClick={() => onNavigate('reflect')}>
          <span className="capsule-v2-action-number">01</span>
          <span className="capsule-v2-action-label">Reflect &nbsp;&#8599;</span>
        </button>
        <button className="capsule-v2-action-btn" onClick={() => onNavigate('discuss')}>
          <span className="capsule-v2-action-number">02</span>
          <span className="capsule-v2-action-label">Discuss &nbsp;&#8599;</span>
        </button>
        <button className="capsule-v2-action-btn" onClick={() => onNavigate('practice')}>
          <span className="capsule-v2-action-number">03</span>
          <span className="capsule-v2-action-label">Practice &nbsp;&#8599;</span>
        </button>
      </div>
    </div>
  );
};
