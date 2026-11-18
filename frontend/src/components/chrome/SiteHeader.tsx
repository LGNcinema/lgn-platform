import { useLayoutEffect, useRef } from 'react';
import './SiteHeader.css';

export type SiteView =
  | 'campfire' | 'capsule' | 'watch' | 'storyboard'
  | 'timeline' | 'about' | 'invest' | 'for-filmmakers';

export type AboutSubView = 'life-numbers' | 'lgn-cinema' | 'people' | 'faqs';

interface Props {
  currentView: SiteView;
  theme: 'light' | 'dark';
  onNavigate: (view: SiteView) => void;
  /** Opens the Storyboard with its form up. */
  onAddToStoryboard: () => void;
}

/**
 * Global header (UX's mock, 2026-11: simplified navigation). The LGN icon on
 * the left margin takes you to the landing page (Go Beyond); on the right
 * margin, two boxed buttons: "Give" (the Invest page) and "Add to
 * Storyboard" (the Storyboard's form). Everything else is in the footer.
 */
export function SiteHeader({ currentView, theme, onNavigate, onAddToStoryboard }: Props) {
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

  return (
    <header ref={headerRef} className="site-header">
      <button type="button" className="site-header-logo" onClick={() => onNavigate('campfire')}>
        <img src={theme === 'dark' ? '/images/lgn-icon-white.svg' : '/images/lgn-icon-black.svg'} alt="LGN home" />
      </button>
      <nav className="site-header-nav" aria-label="Main">
        <button
          type="button"
          className="lgn-btn site-header-btn"
          aria-current={currentView === 'invest' ? 'page' : undefined}
          onClick={() => onNavigate('invest')}
        >
          Give
        </button>
        <button type="button" className="lgn-btn site-header-btn" onClick={onAddToStoryboard}>
          Add to Storyboard
        </button>
      </nav>
    </header>
  );
}
