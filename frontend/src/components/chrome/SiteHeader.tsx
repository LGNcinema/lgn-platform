import { useState } from 'react';
import './SiteHeader.css';

export type SiteView =
  | 'home' | 'campfire' | 'capsule' | 'watch' | 'storyboard'
  | 'timeline' | 'about' | 'invest' | 'contact' | 'submit-film';

export type AboutSubView = 'purpose' | 'mission-vision' | 'board-staff';

interface Props {
  currentView: SiteView;
  theme: 'light' | 'dark';
  onNavigate: (view: SiteView) => void;
  onNavigateAbout: (sub: AboutSubView) => void;
}

/** The views that belong to the Campfire, so its tab reads as active on all of them. */
const CAMPFIRE_VIEWS: SiteView[] = ['campfire', 'capsule', 'storyboard'];

/**
 * Global header. Figma: `Header`, and the top of every [CAMPFIRE] frame.
 *
 * Extracted from App.tsx as-is apart from the redesign's navigation change:
 * the tab that used to open one specific story ("Lightpoles") now opens the
 * Campfire hub, and "Submit a film" replaces "Contact" on the right -- Contact
 * lives in the footer.
 */
export function SiteHeader({ currentView, theme, onNavigate, onNavigateAbout }: Props) {
  const [aboutMenuOpen, setAboutMenuOpen] = useState(false);

  const goAbout = (sub: AboutSubView) => {
    setAboutMenuOpen(false);
    onNavigateAbout(sub);
  };

  return (
    <header className="floating-header-container">
      <div className="header-pill-left">
        <button onClick={() => onNavigate('home')} className={`nav-brand-btn ${currentView === 'home' ? 'active' : ''}`}>
          <img src={theme === 'dark' ? '/images/lgn-icon-white.svg' : '/images/lgn-icon-black.svg'} alt="LGN Icon" />
        </button>

        <div className="nav-dropdown-wrapper" onMouseEnter={() => setAboutMenuOpen(true)} onMouseLeave={() => setAboutMenuOpen(false)}>
          <button className={`nav-link-pill ${currentView === 'about' ? 'active' : ''}`} onClick={() => onNavigate('about')}>About</button>
          {aboutMenuOpen && (
            <div className="dropdown-menu">
              <button className="dropdown-item" onClick={() => goAbout('mission-vision')}>Mission + Vision</button>
              <button className="dropdown-item" onClick={() => goAbout('purpose')}>Purpose</button>
              <button className="dropdown-item" onClick={() => goAbout('board-staff')}>Board + Staff</button>
            </div>
          )}
        </div>

        <button className={`nav-link-pill ${currentView === 'invest' ? 'active' : ''}`} onClick={() => onNavigate('invest')}>Invest</button>
        <button className={`nav-link-pill ${CAMPFIRE_VIEWS.includes(currentView) ? 'active' : ''}`} onClick={() => onNavigate('campfire')}>Campfire</button>
      </div>

      <div className="header-pill-right">
        <button className={`nav-link-pill ${currentView === 'submit-film' ? 'active' : ''}`} onClick={() => onNavigate('submit-film')}>Submit a film</button>
      </div>
    </header>
  );
}
