import React from 'react';
import type { CapsuleDetail } from '../types';
import { buildFilmInfo } from '../filmInfo';
import { VideoPlayer } from './VideoPlayer';

interface Props {
  capsule: CapsuleDetail;
  onNavigate: (view: 'reflect' | 'practice' | 'discuss') => void;
}

export const CapsuleView: React.FC<Props> = ({ capsule, onNavigate }) => {
  const film = capsule.film;
  const filmInfo = film ? buildFilmInfo(film) : '';

  return (
    <div className="capsule-v2-container">
      <h1 className="capsule-v2-main-heading">{capsule.title}</h1>

      {filmInfo && <div className="capsule-v2-film-info">{filmInfo}</div>}

      <div className="capsule-v2-inner-panel">
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
    </div>
  );
};
