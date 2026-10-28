import { useLayoutEffect, useRef } from 'react';
import './SiteHeader.css';

export type SiteView =
  | 'home' | 'campfire' | 'capsule' | 'watch' | 'storyboard'
  | 'timeline' | 'about' | 'invest' | 'contact' | 'submit-film';

export type AboutSubView = 'purpose' | 'mission-vision' | 'board-staff';

interface Props {
  currentView: SiteView;
  theme: 'light' | 'dark';
  onNavigate: (view: SiteView) => void;
}

/** The views that belong to the Campfire, so its link reads as current on all of them. */
const CAMPFIRE_VIEWS: SiteView[] = ['campfire', 'capsule'];

/**
 * Global header. Figma v3: the top of every frame.
 *
 * The logo (home) on the left margin; Campfire, About and Invest set at fixed
 * points across the page (x = 660 / 815 / 970 at 1920); Storyboard on the
 * right margin. Plain 20px text, the current page underlined. The About
 * dropdown of V2 is gone: the About page has its own side menu.
 */
export function SiteHeader({ currentView, theme, onNavigate }: Props) {
  const headerRef = useRef<HTMLElement>(null);

  // Publish where this header ends, as --header-bottom, for the pages that
  // have to clear it. offsetTop + offsetHeight rather than a viewport rect:
  // the header is absolutely positioned, and a rect would change with scroll.
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

  const link = (view: SiteView, label: string, active: boolean, className: string) => (
    <button
      type="button"
      className={`lgn-link site-header-link ${className}${active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={() => onNavigate(view)}
    >
      {label}
    </button>
  );

  return (
    <header ref={headerRef} className="site-header">
      <button type="button" className="site-header-logo" onClick={() => onNavigate('home')}>
        <img src={theme === 'dark' ? '/images/lgn-icon-white.svg' : '/images/lgn-icon-black.svg'} alt="LGN home" />
      </button>
      <nav className="site-header-nav" aria-label="Main">
        <div className="site-header-main">
          {link('campfire', 'Go Beyond', CAMPFIRE_VIEWS.includes(currentView), 'site-header-link--campfire')}
          {link('about', 'About', currentView === 'about', 'site-header-link--about')}
          {link('invest', 'Invest', currentView === 'invest', 'site-header-link--invest')}
        </div>
        {link('storyboard', 'Storyboard', currentView === 'storyboard', 'site-header-link--storyboard')}
      </nav>
    </header>
  );
}
