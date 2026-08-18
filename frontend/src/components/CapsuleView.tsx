import React, { useRef, useState } from 'react';
import type { CapsuleDetail } from '../types';

interface Props {
  capsule: CapsuleDetail;
  onNavigate: (view: 'reflect' | 'practice' | 'discuss') => void;
}

export const CapsuleView: React.FC<Props> = ({ capsule, onNavigate }) => {
  const film = capsule.film;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayVideo = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
  };

  return (
    <div className="capsule-v2-container">
      <h1 className="capsule-v2-main-heading">{capsule.title}</h1>

      {film && (
        <div className="capsule-v2-film-info">
          SISTERS WITH TRANSISTORS a film by LISA ROVNER narrated by LAURIE ANDERSON. 2020. USA. 86 min. A patchwork portrait of several female electronic music pioneers. GUEST-PROGRAMMED BY CYRUS GOBERVILLE FOR OUR SUMMER MUSIC FESTIVAL.
        </div>
      )}

      <div className="capsule-v2-inner-panel">
        <div className="capsule-v2-video-wrapper">
          {film ? (
            <div className="video-wrapper">
              {!isPlaying && (
                <div
                  className="video-poster-overlay"
                  style={{ backgroundImage: `url('/images/sisters-thumbnail.jpg')` }}
                >
                  <button className="play-trigger-btn" onClick={handlePlayVideo} aria-label="Play Film">
                    <svg viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                  </button>
                </div>
              )}
              <video
                ref={videoRef}
                className="screen-video"
                src={film.video_url}
                controls={isPlaying}
                onPause={handleVideoPause}
                onEnded={handleVideoPause}
                playsInline
              />
            </div>
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
