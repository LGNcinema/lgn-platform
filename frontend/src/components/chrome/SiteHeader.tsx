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
}

/**
 * Global header. Figma V3 (latest export), the top of every frame: the LGN
 * icon on the left margin, back to the landing page (Go Beyond); About,
 * Invest and Storyboard as plain text links ending on the right margin, the
 * current page underlined.
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

  const link = (view: SiteView, label: string) => {
    const active = currentView === view;
    return (
      <button
        type="button"
        className={`lgn-link site-header-link${active ? ' active' : ''}`}
        aria-current={active ? 'page' : undefined}
        onClick={() => onNavigate(view)}
      >
        {label}
      </button>
    );
  };

  return (
    <header ref={headerRef} className="site-header">
      <button type="button" className="site-header-logo" onClick={() => onNavigate('campfire')}>
        <img src={theme === 'dark' ? '/images/lgn-icon-white.svg' : '/images/lgn-icon-black.svg'} alt="LGN home" />
      </button>
      <nav className="site-header-nav" aria-label="Main">
        {link('about', 'About')}
        {link('invest', 'Invest')}
        {link('storyboard', 'Storyboard')}
      </nav>
    </header>
  );
}
