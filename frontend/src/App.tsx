import { useEffect, useRef, useState } from 'react';

import { GemeTuningPanel } from './components/GemeTuningPanel';
import { SiteHeader, type AboutSubView, type SiteView } from './components/chrome/SiteHeader';
import { AboutPage } from './components/about/AboutPage';
import { InvestPage } from './components/invest/InvestPage';
import { FilmmakersPage } from './components/filmmakers/FilmmakersPage';
import { SiteFooter } from './components/chrome/SiteFooter';
import { CampfireHome } from './components/campfire/CampfireHome';
import { StoryFoot, StoryShell } from './components/campfire/StoryShell';
import { StoryWatch } from './components/campfire/StoryWatch';
import { hasBehindTheScenes, StoryBehind } from './components/campfire/StoryBehind';
import { WatchMode } from './components/campfire/WatchMode';
import { StoryReflect } from './components/campfire/StoryReflect';
import { StoryPractice } from './components/campfire/StoryPractice';
import { Storyboard } from './components/campfire/Storyboard';
import { VALID_STORY_SECTIONS, type StorySection } from './components/campfire/campfire';
import type { CapsuleDetail, CapsuleSummary, GemeTuning } from './types';
import { API_URL } from './api';

interface TimelineQuote {
  period: string;
  source: string;
  tag: string;
  quote: string;
}

// A chronological chorus data representing Figma's "A witness through time"
const TIMELINE_QUOTES: TimelineQuote[] = [
  {
    period: "c. 2000 BCE",
    source: "Ancient Sumerian Proverb",
    tag: "Life > odds",
    quote: "“Although the number of unhappy days is endless, life is better than death.”"
  },
  {
    period: "c. 6th–3rd c. BCE",
    source: "Katha Upanishad",
    tag: "Life > tech",
    quote: "“When the five senses and the mind are still… then begins the highest path.”"
  },
  {
    period: "4th c. BCE",
    source: "Tao Te Ching",
    tag: "Life > Data",
    quote: "“The way that can be told is not the eternal way.”"
  },
  {
    period: "4th c. BCE",
    source: "Aristotle, Metaphysics I.2",
    tag: "Life > Quantifiable",
    quote: "“It is owing to their wonder that men both now begin and at first began to philosophize.”"
  },
  {
    period: "2nd–1st c. BCE",
    source: "Bhagavad Gita",
    tag: "Life > Age",
    quote: "“For the soul there is neither birth nor death at any time.” (2:20)"
  },
  {
    period: "3rd c. BCE",
    source: "Ecclesiastes",
    tag: "Life > Speed",
    quote: "“He has made everything beautiful in its time… He has also set eternity in the human heart…” (3:11)"
  },
  {
    period: "—",
    source: "Proverbs 3:15",
    tag: "Life > money",
    quote: "“She [wisdom] is more precious than rubies; nothing you desire can compare with her.”"
  },
  {
    period: "3rd–1st c. BCE",
    source: "Dhammapada",
    tag: "Life > money",
    quote: "“Health is the greatest gift, contentment the greatest wealth, faithfulness the best relationship.”"
  },
  {
    period: "8th c. BCE",
    source: "Homer, Iliad",
    tag: "Life > Scores",
    quote: "“I would rather be a paid servant in a poor man’s house… than king of kings among the dead.”"
  }
];

const TIMELINE_ERAS = [
  'Before The Common Era',
  '1st-6th Centuries',
  'Medieval & Early Renaissance',
  '17th-18th Centuries (Early Modern)',
  '19th Century',
  'Early-Mid 20th Century',
  'Late 20th Century',
  '21st Century'
];

const formatRecorded = (period: string) => {
  if (period === '—') return '[-]';
  const formatted = period
    .replace(/c\./gi, 'C.')
    .replace(/\bc\b/gi, 'C')
    .replace(/–/g, '-')
    .replace(/bce/gi, 'BCE')
    .replace(/ce/gi, 'CE');
  return `[${formatted}]`;
};

const formatTag = (tag: string) => {
  return tag.replace(/>\s*([a-z])([a-zA-Z]*)/g, (_, p1, p2) => {
    return `> ${p1.toUpperCase()}${p2}`;
  });
};

// Renders inline inset:0 within the current page's own wrapper element (not a separate
// full-page overlay) so its columns/rows always match that wrapper's real box -- whatever
// its actual padding/aspect-ratio/height happens to be -- instead of independently guessing it.
const GridOverlay = ({ cols, rows }: { cols: number; rows: number }) => (
  <div className={`dev-grid-overlay ${cols === 12 ? 'mode-home' : 'mode-internal'}`}>
    <div className="dev-grid-cols-layer">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={`col-${i}`} className={`dev-grid-col col-${i + 1}`}>
          <span className="dev-grid-label">Col {i + 1}</span>
        </div>
      ))}
    </div>
    <div className="dev-grid-rows-layer">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="dev-grid-row">
          <span className="dev-grid-label">R{i + 1}</span>
        </div>
      ))}
    </div>
  </div>
);



// `capsule` is a single story's page; `campfire` is the hub listing them. The
// backend still calls stories capsules, and so does this view name.
const VALID_VIEWS = ['campfire', 'capsule', 'watch', 'storyboard', 'timeline', 'about', 'invest', 'for-filmmakers'] as const;
const VALID_ABOUT_SUBVIEWS = ['life-numbers', 'lgn-cinema', 'people', 'faqs'] as const;

/**
 * Views that open in a theme other than light. Everything absent from this map
 * gets `light`.
 *
 * "A Witness through Time" was designed dark -- see the paired light/dark
 * frames in `design/31_nodes_export`. It is the page's own presentation, not a
 * visitor preference, so it is keyed off the view rather than stored anywhere.
 */
const VIEW_DEFAULT_THEME: Partial<Record<typeof VALID_VIEWS[number], 'light' | 'dark'>> = {
  timeline: 'dark',
};

function App() {
  // Navigation / Router States
  // The page lives in the URL: ?view= (page), ?sub= (About tab), ?story= (which
  // story) and ?section= (its tab). They are read here on load, and kept in
  // sync below, so a refresh reopens the same page and Back/Forward work.
  const [currentView, setCurrentView] = useState<SiteView>(() => {
    const viewParam = new URLSearchParams(window.location.search).get('view');
    return (VALID_VIEWS as readonly string[]).includes(viewParam || '') ? (viewParam as typeof VALID_VIEWS[number]) : 'campfire';
  });
  const [aboutSubView, setAboutSubView] = useState<AboutSubView>(() => {
    const subParam = new URLSearchParams(window.location.search).get('sub');
    return (VALID_ABOUT_SUBVIEWS as readonly string[]).includes(subParam || '') ? (subParam as typeof VALID_ABOUT_SUBVIEWS[number]) : 'life-numbers';
  });

  // Database API States
  const [activeCapsule, setActiveCapsule] = useState<CapsuleDetail | null>(null);
  const activeCapsuleIdRef = useRef<number | null>(null);
  activeCapsuleIdRef.current = activeCapsule?.id ?? null;
  const [allCapsules, setAllCapsules] = useState<CapsuleSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Determine if we are in a development environment or debugging mode
  const isDev = import.meta.env.DEV ||
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                new URLSearchParams(window.location.search).get('debug') === 'true' ||
                new URLSearchParams(window.location.search).get('dev') === 'true';

  // Tabbed Navigation state for Capsule view is managed in parent/components

  const [activeTimelineEra, setActiveTimelineEra] = useState<string>('Before The Common Era');
  // Which section of a story page is showing. ?section= sets it for QA; the old
  // ?action= is still read, and its retired values (discuss, gather) fall back
  // to Watch rather than to a section that no longer exists.
  const [storySection, setStorySection] = useState<StorySection>(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('section') || params.get('action');
    return (VALID_STORY_SECTIONS as readonly string[]).includes(raw || '') ? (raw as StorySection) : 'watch';
  });
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(() => {
    const gridParam = new URLSearchParams(window.location.search).get('grid');
    return gridParam === 'true' || gridParam === '1';
  });

  // Geme tuning (dev only). The panel edits Geme's persona and parameters for the
  // next conversation; the server only honours them where GEME_DEBUG is on, which
  // is also what gates the toggle appearing at all. Drafts are kept in
  // localStorage so a page reload doesn't lose wording someone was working on.
  const [gemeDebugAvailable, setGemeDebugAvailable] = useState(false);
  const [gemeTuningOpen, setGemeTuningOpen] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('geme') === 'tuning' || params.get('tune') === 'geme';
  });
  const [gemeTuning, setGemeTuning] = useState<GemeTuning | null>(() => {
    try {
      const saved = localStorage.getItem('lgn_geme_tuning');
      return saved ? (JSON.parse(saved) as GemeTuning) : null;
    } catch {
      return null;
    }
  });
  const [gemeTuningVersion, setGemeTuningVersion] = useState(0);

  useEffect(() => {
    fetch(`${API_URL}/api/geme/status`)
      .then((res) => (res.ok ? res.json() : { debug: false }))
      .then((data) => setGemeDebugAvailable(Boolean(data.debug)))
      .catch(() => setGemeDebugAvailable(false));
  }, []);

  const handleApplyGemeTuning = (tuning: GemeTuning | null) => {
    setGemeTuning(tuning);
    setGemeTuningVersion((v) => v + 1);
    if (tuning) localStorage.setItem('lgn_geme_tuning', JSON.stringify(tuning));
    else localStorage.removeItem('lgn_geme_tuning');
  };

  // Theme. The view decides (VIEW_DEFAULT_THEME above) unless something has
  // explicitly asked for one: ?theme=dark / ?dark=true, or the dev toggle.
  //
  // The override is deliberately NOT persisted. It used to be written to
  // localStorage on every render, which meant a stored value could never be
  // told apart from the default -- so any browser that had ever loaded the site
  // carried a "preference" it had never expressed, and that would now suppress
  // the timeline's dark default forever. Since the only way to set it is a
  // dev-only button, per-session is the honest lifetime; `?theme=` survives a
  // reload on its own by living in the URL.
  const [themeOverride, setThemeOverride] = useState<'light' | 'dark' | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const themeParam = params.get('theme') || (params.get('dark') === 'true' || params.get('dark') === '1' ? 'dark' : null);
    if (themeParam === 'dark') return 'dark';
    if (themeParam === 'light') return 'light';
    return null;
  });

  const theme: 'light' | 'dark' = themeOverride ?? VIEW_DEFAULT_THEME[currentView] ?? 'light';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Views are swapped in place rather than routed, so the browser has no
  // navigation to hang a scroll reset on and simply keeps the offset from the
  // page you left. Every footer link is by definition at the bottom of a
  // scrolled page, so following one used to drop you into the middle of the
  // next view. Reset on every view change instead.
  //
  // Scoped to `currentView` on purpose: the About sub-views and the capsule
  // sections are tabs within a page, and yanking the page to the top when
  // someone switches tab is its own annoyance.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentView]);

  // Toggle Grid Overlay keyboard shortcut (Ctrl+G or Alt+G)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.altKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setShowGridOverlay(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  // Fetch active capsule and all capsules
  const fetchData = async (capsuleId?: number) => {
    setLoading(true);
    setError(null);
    try {
      const capsuleEndpoint = capsuleId
        ? `${API_URL}/api/capsules/${capsuleId}`
        : `${API_URL}/api/capsules/active`;

      let capsuleRes = await fetch(capsuleEndpoint);
      // A ?story= that no longer exists (or isn't published) falls back to the
      // current story rather than an error page.
      if (!capsuleRes.ok && capsuleId) capsuleRes = await fetch(`${API_URL}/api/capsules/active`);
      if (!capsuleRes.ok) {
        throw new Error(`Failed to fetch capsule detail: ${capsuleRes.statusText}`);
      }
      const capsuleData = await capsuleRes.json();
      setActiveCapsule(capsuleData);

      const listRes = await fetch(`${API_URL}/api/capsules`);
      if (listRes.ok) {
        const listData = await listRes.json();
        setAllCapsules(listData);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading application data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const story = Number(new URLSearchParams(window.location.search).get('story'));
    fetchData(Number.isInteger(story) && story > 0 ? story : undefined);
  }, []);

  /* ---- the URL <-> page sync ----
   * Every navigation writes the page into the address bar, so a refresh
   * reopens it and Back/Forward step through pages. Only our own keys are
   * touched; testing params (?theme=, ?grid=, ?modal=, ...) are left as-is. */
  const NAV_KEYS = ['view', 'sub', 'story', 'section', 'action'];
  const navSearch = (() => {
    const params = new URLSearchParams(window.location.search);
    // While a story is still loading, keep the ?story= already in the URL --
    // dropping it for a moment would add a stray step to the history.
    const pendingStory = params.get('story');
    NAV_KEYS.forEach((k) => params.delete(k));
    // The landing page (Go Beyond) is the bare URL.
    if (currentView !== 'campfire') params.set('view', currentView);
    if (currentView === 'about') params.set('sub', aboutSubView);
    if (['capsule', 'watch', 'storyboard'].includes(currentView)) {
      const story = activeCapsule ? String(activeCapsule.id) : pendingStory;
      if (story) params.set('story', story);
    }
    if (currentView === 'capsule') params.set('section', storySection);
    const query = params.toString();
    return query ? `?${query}` : '';
  })();
  const firstNavSync = useRef(true);
  const restoringFromHistory = useRef(false);

  useEffect(() => {
    if (navSearch === window.location.search) return;
    const url = `${window.location.pathname}${navSearch}${window.location.hash}`;
    // The first write only fills in what the load implied (e.g. ?story=);
    // the page restored by Back/Forward must not push a new entry either.
    if (firstNavSync.current || restoringFromHistory.current) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    firstNavSync.current = false;
    restoringFromHistory.current = false;
  }, [navSearch]);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view') || 'campfire';
      const sub = params.get('sub');
      const section = params.get('section');
      const story = Number(params.get('story'));
      restoringFromHistory.current = true;
      setCurrentView((VALID_VIEWS as readonly string[]).includes(view) ? (view as SiteView) : 'campfire');
      if ((VALID_ABOUT_SUBVIEWS as readonly string[]).includes(sub || '')) {
        setAboutSubView(sub as typeof VALID_ABOUT_SUBVIEWS[number]);
      }
      if ((VALID_STORY_SECTIONS as readonly string[]).includes(section || '')) {
        setStorySection(section as StorySection);
      }
      if (Number.isInteger(story) && story > 0 && story !== activeCapsuleIdRef.current) fetchData(story);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // "Add to the storyboard" (Reflect and Practice) opens the
  // Storyboard with its form already up; any other way onto the Storyboard
  // opens it plain. Each request remounts the board, so it also works when
  // the visitor is already on it.
  const [storyboardWithForm, setStoryboardWithForm] = useState(false);
  const [storyboardFormRequest, setStoryboardFormRequest] = useState(0);
  useEffect(() => {
    if (currentView !== 'storyboard') setStoryboardWithForm(false);
  }, [currentView]);
  const openStoryboardForm = () => {
    setStoryboardWithForm(true);
    setStoryboardFormRequest((n) => n + 1);
    setCurrentView('storyboard');
  };

  const handleCapsuleSelect = (id: number) => {
    fetchData(id);
  };

  /** Open one story's page, loading it first if it isn't the one on screen. */
  const openStory = (id: number, section: StorySection = 'watch') => {
    if (activeCapsule?.id !== id) handleCapsuleSelect(id);
    setStorySection(section);
    setCurrentView('capsule');
  };






  const renderActiveView = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading platform...</p>
        </div>
      );
    }

    if (error || !activeCapsule) {
      return (
        <div className="error-container">
          <h2 className="error-title">Unable to load LGN Platform</h2>
          <p className="error-msg">{error || 'No active capsule was found in the database.'}</p>
          <button className="lgn-btn" onClick={() => fetchData()}>
            Try Again
          </button>
        </div>
      );
    }

    switch (currentView) {
      case 'campfire':
        return (
          <CampfireHome
            stories={allCapsules}
            theme={theme}
            onOpenStory={(id) => openStory(id)}
            onOpenFilmmakers={() => setCurrentView('for-filmmakers')}
            onOpenAboutCinema={() => {
              setAboutSubView('lgn-cinema');
              setCurrentView('about');
            }}
          />
        );

      case 'capsule': {
        if (storySection === 'making') {
          return <StoryBehind capsule={activeCapsule} onBack={() => setStorySection('watch')} />;
        }
        return (
          <StoryShell
            capsule={activeCapsule}
            section={storySection}
            onSelectSection={setStorySection}
            onBackToCampfire={() => setCurrentView('campfire')}
            gemeTuning={gemeTuning}
            gemeTuningVersion={gemeTuningVersion}
            onOpenFilmmakers={() => setCurrentView('for-filmmakers')}
            leftFoot={
              <StoryFoot
                capsule={activeCapsule}
                section={storySection}
                onOpenMaking={hasBehindTheScenes(activeCapsule) ? () => setStorySection('making') : undefined}
                onAddToStoryboard={openStoryboardForm}
              />
            }
          >
            {storySection === 'watch' && (
              <StoryWatch capsule={activeCapsule} onEnterWatch={() => setCurrentView('watch')} />
            )}
            {storySection === 'reflect' && <StoryReflect capsule={activeCapsule} />}
            {storySection === 'practice' && <StoryPractice capsule={activeCapsule} />}
          </StoryShell>
        );
      }

      case 'watch':
        return <WatchMode capsule={activeCapsule} onExit={() => setCurrentView('capsule')} />;

      case 'storyboard':
        return (
          <Storyboard
            key={storyboardFormRequest}
            capsule={activeCapsule}
            films={allCapsules}
            onOpenFilm={(id) => openStory(id)}
            startWithForm={storyboardWithForm}
          />
        );

      case 'timeline': {
        const activeEraIdx = TIMELINE_ERAS.indexOf(activeTimelineEra);
        const erasBefore = activeEraIdx !== -1 ? TIMELINE_ERAS.slice(0, activeEraIdx) : [];
        const erasAfter = activeEraIdx !== -1 ? TIMELINE_ERAS.slice(activeEraIdx + 1) : TIMELINE_ERAS;
        const activeQuotes = TIMELINE_QUOTES.filter(q => {
          if (activeTimelineEra === 'Before The Common Era') {
            return q.period.includes('BCE') || q.period === '—';
          }
          return false;
        });

        return (
          <div className="timeline-view-wrapper">
            <div className="timeline-header-grid">
              <h1 className="timeline-title-col">
                A Witness Through Time
              </h1>
              <div className="timeline-desc-col">
                A chronological chorus affirming that<br />
                Life &gt; Numbers
              </div>
            </div>

            <div className="timeline-table-container">
              <table className="timeline-table">
                <thead>
                  <tr>
                    <th className="col-period">[Period]</th>
                    <th className="col-source">[Source]</th>
                    <th className="col-recorded">[Recorded]</th>
                    <th className="col-witness">[Witness]</th>
                    <th className="col-tag">[Tag]</th>
                  </tr>
                </thead>
                <tbody>
                  {erasBefore.map(era => (
                    <tr key={era} className="era-nav-row">
                      <td className="col-period">
                        <button className="timeline-era-nav-btn" onClick={() => setActiveTimelineEra(era)}>
                          {era}
                        </button>
                      </td>
                      <td colSpan={4}></td>
                    </tr>
                  ))}

                  {erasBefore.length > 0 && (
                    <tr className="timeline-spacer-row">
                      <td colSpan={5}></td>
                    </tr>
                  )}

                  {activeQuotes.length > 0 ? (
                    activeQuotes.map((q, idx) => (
                      <tr key={idx} className="quote-row">
                        {idx === 0 ? (
                          <td className="col-period active-era-cell">
                            <span className="active-era-name">{activeTimelineEra}</span>
                          </td>
                        ) : (
                          <td className="col-period"></td>
                        )}
                        <td className="col-source">{q.source}</td>
                        <td className="col-recorded">{formatRecorded(q.period)}</td>
                        <td className="col-witness">{q.quote}</td>
                        <td className="col-tag">{formatTag(q.tag)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="quote-row empty-era-row">
                      <td className="col-period active-era-cell">
                        <span className="active-era-name">{activeTimelineEra}</span>
                      </td>
                      <td colSpan={4} className="col-empty-message">
                        No quotes recorded for this era yet.
                      </td>
                    </tr>
                  )}

                  {erasAfter.length > 0 && (
                    <tr className="timeline-spacer-row">
                      <td colSpan={5}></td>
                    </tr>
                  )}

                  {erasAfter.map(era => (
                    <tr key={era} className="era-nav-row">
                      <td className="col-period">
                        <button className="timeline-era-nav-btn" onClick={() => setActiveTimelineEra(era)}>
                          {era}
                        </button>
                      </td>
                      <td colSpan={4}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case 'for-filmmakers':
        return <FilmmakersPage films={allCapsules} />;

      case 'about':
        return <AboutPage sub={aboutSubView} onSelect={setAboutSubView} theme={theme} />;

      case 'invest':
        return (
          <InvestPage
            onOpenStoryboard={() => setCurrentView('storyboard')}
            onOpenFilmmakers={() => setCurrentView('for-filmmakers')}
          />
        );
    }
  };

  return (
    <>
      {/* Watch is immersive: no site chrome at all. */}
      {currentView !== 'watch' && (
        <SiteHeader
          currentView={currentView}
          theme={theme}
          onNavigate={setCurrentView}
        />
      )}

      <div className="page-body" style={{ position: 'relative', flexGrow: 1 }}>
      <main className={['campfire', 'capsule', 'watch', 'storyboard', 'invest', 'timeline', 'about', 'for-filmmakers'].includes(currentView) ? '' : 'container'}>
        {renderActiveView()}
      </main>

      <SiteFooter
        theme={theme}
        onNavigate={setCurrentView}
        onOpenAbout={(sub) => {
          setAboutSubView(sub);
          setCurrentView('about');
        }}
      />

      {showGridOverlay && <GridOverlay cols={6} rows={3} />}
      </div>

      {isDev && (
        <>
          <button
            className="grid-toggle-btn"
            style={{ bottom: '76px' }}
            onClick={() => setThemeOverride(theme === 'light' ? 'dark' : 'light')}
            title="Toggle Light / Dark Theme"
          >
            <span>{theme === 'light' ? '☀️' : '🌙'}</span>
            <span>Theme: {theme === 'light' ? 'Light' : 'Dark'}</span>
          </button>

          <button
            className={`grid-toggle-btn${showGridOverlay ? ' active' : ''}`}
            onClick={() => setShowGridOverlay(!showGridOverlay)}
            title="Toggle 6-Column Grid Overlay (Ctrl+G)"
          >
            <span>🌐</span>
            <span>Grid Overlay {showGridOverlay ? 'ON' : 'OFF'}</span>
          </button>

          {/* Only where the server accepts tuning overrides -- i.e. GEME_DEBUG,
              which is set for local development and nowhere else. */}
          {gemeDebugAvailable && (
            <button
              className={`grid-toggle-btn${gemeTuning ? ' active' : ''}`}
              style={{ bottom: '152px' }}
              onClick={() => setGemeTuningOpen(true)}
              title="Edit Geme's persona and parameters, then test them live"
            >
              <span>🧪</span>
              <span>Geme Tuning{gemeTuning ? ' •' : ''}</span>
            </button>
          )}
        </>
      )}

      {gemeTuningOpen && gemeDebugAvailable && (
        <GemeTuningPanel
          capsuleId={activeCapsule?.id}
          tuning={gemeTuning}
          onApply={handleApplyGemeTuning}
          onClose={() => setGemeTuningOpen(false)}
        />
      )}
    </>
  );
}

export default App;
