import { useLayoutEffect, useRef, useState } from 'react';
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
  const headerRef = useRef<HTMLElement>(null);

  // Publish where this header actually ends, as --header-bottom, for the pages
  // that have to clear it (the story shell, the Campfire hub, the home tagline).
  //
  // index.css has a formula for it -- header top + a fixed pill height -- and
  // that is only true while the header is one row. It is not always one row:
  // below the compact breakpoint "Submit a film" wraps to its own line, and a
  // formula can only guess that height. A guess drifts out of date the moment
  // the header's type or padding changes, and content ends up underneath it.
  // Measuring makes every consumer right at every width. The formula stays in
  // index.css as the value used before this runs and when the header is not
  // mounted (immersive Watch).
  //
  // offsetTop + offsetHeight rather than getBoundingClientRect: the header is
  // absolutely positioned in #root, and a viewport rect would change with
  // scroll, so measuring a scrolled page would publish the wrong edge.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--header-bottom', `${Math.ceil(el.offsetTop + el.offsetHeight)}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--header-bottom');
    };
  }, []);

  const goAbout = (sub: AboutSubView) => {
    setAboutMenuOpen(false);
    onNavigateAbout(sub);
  };

  return (
    <header ref={headerRef} className="floating-header-container">
      <nav className="header-pill-left" aria-label="Main">
        <button onClick={() => onNavigate('home')} className={`nav-brand-btn ${currentView === 'home' ? 'active' : ''}`}>
          <img src={theme === 'dark' ? '/images/lgn-icon-white.svg' : '/images/lgn-icon-black.svg'} alt="LGN home" />
        </button>

        {/* Opens on hover, and also on keyboard focus so the three About pages
            are reachable without a mouse. Focus leaving the wrapper, or Escape,
            closes it; moving between About and its items does not. */}
        <div
          className="nav-dropdown-wrapper"
          onMouseEnter={() => setAboutMenuOpen(true)}
          onMouseLeave={() => setAboutMenuOpen(false)}
          onFocus={() => setAboutMenuOpen(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAboutMenuOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setAboutMenuOpen(false);
          }}
        >
          <button
            className={`nav-link-pill ${currentView === 'about' ? 'active' : ''}`}
            aria-haspopup="true"
            aria-expanded={aboutMenuOpen}
            onClick={() => onNavigate('about')}
          >
            About
          </button>
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
      </nav>

      <div className="header-pill-right">
        <button className={`nav-link-pill ${currentView === 'submit-film' ? 'active' : ''}`} onClick={() => onNavigate('submit-film')}>Submit a film</button>
      </div>
    </header>
  );
}
