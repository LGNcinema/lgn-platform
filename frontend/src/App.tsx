import { useState, useEffect } from 'react';

import { GemeTuningPanel } from './components/GemeTuningPanel';
import { SiteHeader, type SiteView } from './components/chrome/SiteHeader';
import { SiteFooter } from './components/chrome/SiteFooter';
import { CampfireHome } from './components/campfire/CampfireHome';
import { StoryShell } from './components/campfire/StoryShell';
import { StoryWatch } from './components/campfire/StoryWatch';
import { StoryMaking } from './components/campfire/StoryMaking';
import { WatchMode } from './components/campfire/WatchMode';
import { StoryReflect } from './components/campfire/StoryReflect';
import { StoryPractice } from './components/campfire/StoryPractice';
import { Storyboard } from './components/campfire/Storyboard';
import { VALID_STORY_SECTIONS, storyNumber, type StorySection } from './components/campfire/campfire';
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


// Invest accordion +/- glyph. Drawn rather than typed so its weight and size
// can match the frame's glyphs exactly: both marks are 17px across with a
// ~2.25px stroke (--invest-rule-weight). The frame's minus is a text dash,
// which sits higher and a little left of the plus's centre, so it is drawn
// there too rather than through the plus's middle.
const AccordionIcon = ({ expanded }: { expanded: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {expanded ? (
      <line x1="1" y1="8.75" x2="18.5" y2="8.75" />
    ) : (
      <>
        <line x1="3.5" y1="14.5" x2="20.5" y2="14.5" />
        <line x1="12" y1="6" x2="12" y2="23" />
      </>
    )}
  </svg>
);

// `capsule` is a single story's page; `campfire` is the hub listing them. The
// backend still calls stories capsules, and so does this view name.
const VALID_VIEWS = ['home', 'campfire', 'capsule', 'watch', 'storyboard', 'timeline', 'about', 'invest', 'contact', 'submit-film'] as const;
const VALID_ABOUT_SUBVIEWS = ['purpose', 'mission-vision', 'board-staff'] as const;

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
  // Initial view/sub-view/action can be set via ?view=, ?sub=, ?action= URL params for debugging/QA
  // (mirrors the existing ?theme= / ?debug= param pattern below).
  const [currentView, setCurrentView] = useState<SiteView>(() => {
    const viewParam = new URLSearchParams(window.location.search).get('view');
    return (VALID_VIEWS as readonly string[]).includes(viewParam || '') ? (viewParam as typeof VALID_VIEWS[number]) : 'home';
  });
  const [aboutSubView, setAboutSubView] = useState<'purpose' | 'mission-vision' | 'board-staff'>(() => {
    const subParam = new URLSearchParams(window.location.search).get('sub');
    return (VALID_ABOUT_SUBVIEWS as readonly string[]).includes(subParam || '') ? (subParam as typeof VALID_ABOUT_SUBVIEWS[number]) : 'mission-vision';
  });

  // Database API States
  const [activeCapsule, setActiveCapsule] = useState<CapsuleDetail | null>(null);
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

  // Form states
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactSubmitting, setContactSubmitting] = useState(false);

  const [filmTitle, setFilmTitle] = useState('');
  const [filmDirector, setFilmDirector] = useState('');
  const [filmDuration, setFilmDuration] = useState('');
  const [filmLink, setFilmLink] = useState('');
  const [filmSynopsis, setFilmSynopsis] = useState('');
  const [filmEmail, setFilmEmail] = useState('');
  const [filmSuccess, setFilmSuccess] = useState(false);
  const [filmSubmitting, setFilmSubmitting] = useState(false);

  const [activeTimelineEra, setActiveTimelineEra] = useState<string>('Before The Common Era');
  const [investExpandedRow, setInvestExpandedRow] = useState<string | null>('time');
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

      const capsuleRes = await fetch(capsuleEndpoint);
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
    fetchData();
  }, []);

  const handleCapsuleSelect = (id: number) => {
    fetchData(id);
  };

  /** Open one story's page, loading it first if it isn't the one on screen. */
  const openStory = (id: number, section: StorySection = 'watch') => {
    if (activeCapsule?.id !== id) handleCapsuleSelect(id);
    setStorySection(section);
    setCurrentView('capsule');
  };

  // Submissions handlers
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactMessage) return;
    setContactSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/submissions/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          message: contactMessage,
        }),
      });
      if (res.ok) {
        setContactSuccess(true);
        setContactName('');
        setContactEmail('');
        setContactMessage('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleFilmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filmTitle || !filmDirector || !filmLink || !filmEmail) return;
    setFilmSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/submissions/film`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: filmTitle,
          director: filmDirector,
          duration: filmDuration || null,
          link: filmLink,
          synopsis: filmSynopsis || null,
          email: filmEmail,
        }),
      });
      if (res.ok) {
        setFilmSuccess(true);
        setFilmTitle('');
        setFilmDirector('');
        setFilmDuration('');
        setFilmLink('');
        setFilmSynopsis('');
        setFilmEmail('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFilmSubmitting(false);
    }
  };





  const navigateToAbout = (subView: 'purpose' | 'mission-vision' | 'board-staff') => {
    setCurrentView('about');
    setAboutSubView(subView);
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
          <button className="retry-btn" onClick={() => fetchData()}>
            Try Again
          </button>
        </div>
      );
    }

    switch (currentView) {
      case 'home':
        return (
          <div className="home-view-wrapper">
            <div className="home-definition-block">
              LGN (n.)&nbsp; A community platform that offers one short film each month as common ground for reflection, discussion, and practice.
            </div>

            <div className="home-hero-logo-row">
              <img className="home-hero-logo" src={theme === 'dark' ? '/images/lgn-logo-registered-white.svg' : '/images/lgn-logo-registered.svg'} alt="Life is Greater than Numbers" />
            </div>
            
            <div className="home-hero-subtitle-row">
              <p className="home-hero-subtitle">Great stories for greater living.</p>
            </div>
            
            <div className="home-hero-btn-row">
              <button className="home-hero-btn" onClick={() => setCurrentView('campfire')}>Campfire</button>
            </div>
          </div>
        );

      case 'campfire':
        return <CampfireHome stories={allCapsules} onOpenStory={(id) => openStory(id)} />;

      case 'capsule': {
        const number = storyNumber(activeCapsule.id, allCapsules);
        return (
          <StoryShell
            capsule={activeCapsule}
            storyNumber={number}
            section={storySection}
            onSelectSection={setStorySection}
            onBackToCampfire={() => setCurrentView('campfire')}
            onAddToStoryboard={() => setCurrentView('storyboard')}
          >
            {storySection === 'watch' && (
              <StoryWatch capsule={activeCapsule} onEnterWatch={() => setCurrentView('watch')} />
            )}
            {storySection === 'reflect' && <StoryReflect capsule={activeCapsule} />}
            {storySection === 'practice' && (
              <StoryPractice
                capsule={activeCapsule}
                gemeTuning={gemeTuning}
                gemeTuningVersion={gemeTuningVersion}
              />
            )}
            {storySection === 'making' && <StoryMaking capsule={activeCapsule} />}
          </StoryShell>
        );
      }

      case 'watch':
        return <WatchMode capsule={activeCapsule} onExit={() => setCurrentView('capsule')} />;

      case 'storyboard':
        return (
          <Storyboard
            capsule={activeCapsule}
            storyNumber={storyNumber(activeCapsule.id, allCapsules)}
            onBackToCampfire={() => setCurrentView('campfire')}
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
              <div className="timeline-title-col">
                A Witness through<br />Time
              </div>
              <div className="timeline-desc-col">
                A chronological chorus affirming the<br />
                Life &gt; Numbers Tenet.
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

      case 'about':
        return (
          <div className="about-container animate-fade">
            <div className="about-sidebar">
              <button className={`about-nav-btn ${aboutSubView === 'mission-vision' ? 'active' : ''}`} onClick={() => setAboutSubView('mission-vision')}>
                Mission + Vision
              </button>
              <button className={`about-nav-btn ${aboutSubView === 'purpose' ? 'active' : ''}`} onClick={() => setAboutSubView('purpose')}>
                Purpose
              </button>
              <button className={`about-nav-btn ${aboutSubView === 'board-staff' ? 'active' : ''}`} onClick={() => setAboutSubView('board-staff')}>
                Board + Staff
              </button>
            </div>

            <div className="about-content">
              {aboutSubView === 'mission-vision' && (
                <div className="about-mv-section animate-fade">
                  <div className="about-mv-block">
                    <div className="about-mv-label">Mission</div>
                    <h2 className="about-mv-text">To equip short films with pathways for reflection, discussion, and practice.</h2>
                  </div>
                  <div className="about-mv-block">
                    <div className="about-mv-label">Vision</div>
                    <h2 className="about-mv-text">A culture of common ground, where life is greater than numbers.</h2>
                  </div>
                </div>
              )}

              {aboutSubView === 'purpose' && (
                <div className="animate-fade">
                  <div className="about-mv-label">Purpose</div>
                  <p className="about-purpose-text">LGN stands for Life &gt; Numbers—a reminder that people are more than metrics, outcomes, opinions, identities, and categories.</p>
                  <p className="about-purpose-text">We gather people around great stories that help us see life more fully. Each month, LGN offers one film as common ground, with simple pathways for reflection, discussion, and practice that help the story move beyond the screen and into greater living.</p>
                </div>
              )}

              {aboutSubView === 'board-staff' && (
                <div className="animate-fade">
                  <div className="team-section">
                    <h2 className="team-label">Board</h2>
                    <div className="team-list-layout">
                      <div className="team-list-item">
                        <h3 className="person-name">Kirk Utzinger</h3>
                        <p className="person-title">Board Chair</p>
                        <p className="person-bio">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque vitae consequat lectus. Morbi pulvinar mauris nec leo ultricies rutrum.</p>
                      </div>
                      <div className="team-list-item">
                        <h3 className="person-name">Lorem Ipsum</h3>
                        <p className="person-title">Secretary</p>
                        <p className="person-bio">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque vitae consequat lectus. Morbi pulvinar mauris nec leo ultricies rutrum.</p>
                      </div>
                      <div className="team-list-item">
                        <h3 className="person-name">Dean Kato</h3>
                        <p className="person-title">Director of Board Development</p>
                        <p className="person-bio">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque vitae consequat lectus. Morbi pulvinar mauris nec leo ultricies rutrum.</p>
                      </div>
                      <div className="team-list-item">
                        <h3 className="person-name">Lorem Ipsum</h3>
                        <p className="person-title">Director of Community Engagement</p>
                        <p className="person-bio">Bio: </p>
                      </div>
                    </div>
                  </div>

                  <div className="team-section">
                    <h2 className="team-label">Staff</h2>
                    <div className="team-list-layout">
                      <div className="team-list-item">
                        <h3 className="person-name">Karson Utzinger</h3>
                        <p className="person-title">Founder and Executive Director</p>
                        <p className="person-bio">I love jo. She's my love.</p>
                      </div>
                      <div className="team-list-item">
                        <h3 className="person-name">Stephen Brown</h3>
                        <p className="person-title">Pipeline Producer</p>
                        <p className="person-bio">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque vitae consequat lectus. Morbi pulvinar mauris nec leo ultricies rutrum.</p>
                      </div>
                      <div className="team-list-item">
                        <h3 className="person-name">Joëlle Utzinger</h3>
                        <p className="person-title">Brand Designer</p>
                        <p className="person-bio">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque vitae consequat lectus. Morbi pulvinar mauris nec leo ultricies rutrum.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'invest':
        return (
          <div className="invest-container animate-fade">
            {/* Figma Invest LIGHT: the heading sits in the left column, on two lines. */}
            <div className="invest-sidebar-placeholder">
              <h1 className="invest-title">How you can invest<br />in this vision</h1>
            </div>
            <div className="invest-content">

              <div className="invest-accordion">
                <div className="invest-accordion-row" onClick={() => setInvestExpandedRow(investExpandedRow === 'time' ? null : 'time')}>
                  <div className="invest-row-title">Time</div>
                  <div className="invest-row-content">
                    {investExpandedRow === 'time' && (
                      <ul className="invest-bullet-list">
                        <li>Share this vision with your network</li>
                        <li>Join the LGN discourse (in beta)</li>
                        <li>Partner with us to kickstart a peer-to-peer fundraising campaign</li>
                      </ul>
                    )}
                  </div>
                  <div className="invest-row-icon">
                    <AccordionIcon expanded={investExpandedRow === 'time'} />
                  </div>
                </div>

                <div className="invest-accordion-row" onClick={() => setInvestExpandedRow(investExpandedRow === 'talent' ? null : 'talent')}>
                  <div className="invest-row-title">Talent</div>
                  <div className="invest-row-content">
                    {investExpandedRow === 'talent' && (
                      <p className="invest-row-text">Contribute your skills to our platform. We are currently seeking volunteers with experience in web development, design, and content writing.</p>
                    )}
                  </div>
                  <div className="invest-row-icon">
                    <AccordionIcon expanded={investExpandedRow === 'talent'} />
                  </div>
                </div>

                <div className="invest-accordion-row" onClick={() => setInvestExpandedRow(investExpandedRow === 'treasure' ? null : 'treasure')}>
                  <div className="invest-row-title">Treasure</div>
                  <div className="invest-row-content">
                    {investExpandedRow === 'treasure' && (
                      <p className="invest-row-text">Your financial support helps us license great films, maintain the platform, and grow the community.</p>
                    )}
                  </div>
                  <div className="invest-row-icon">
                    <AccordionIcon expanded={investExpandedRow === 'treasure'} />
                  </div>
                </div>
              </div>

              {/* Stripe-hosted donation page, in a new tab so the visitor keeps their place here. */}
              <a className="invest-give-btn" id="btn-give-treasure" href="https://donate.stripe.com/cNi9AT2g6fxc6j1bs4cjS00" target="_blank" rel="noopener noreferrer">Give Here</a>

              <div className="invest-footer-info">
                <p>As a registered 501(c)(3), donations to Life is Greater than Numbers, Inc. are tax-deductible to the fullest extent allowed by law. Charitable disclosure & state registration info will be added here as we complete our national registration process. This page is not intended as a solicitation in jurisdictions where Life is Greater than Numbers, Inc. is not yet registered or exempt from registration.</p>
              </div>
            </div>
          </div>
        );


      case 'contact':
        return (
          <div className="form-view-wrapper animate-fade">
            <h1 className="about-title">Contact LGN Cinema</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', maxWidth: '600px' }}>
              Have questions, ideas, or feedback? Send us a message and our team will get back to you shortly.
            </p>

            {contactSuccess ? (
              <div className="form-success-card">
                <h3>✓ Message Sent</h3>
                <p>Thank you for reaching out. We have logged your submission successfully.</p>
                <button className="retry-btn" onClick={() => setContactSuccess(false)} style={{ marginTop: '16px' }}>
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="interactive-form-grid">
                <div className="form-group">
                  <label htmlFor="contact-name">Name</label>
                  <input
                    id="contact-name"
                    type="text"
                    className="form-input"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                    placeholder="Enter your name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="contact-email">Email</label>
                  <input
                    id="contact-email"
                    type="email"
                    className="form-input"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                  />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="contact-message">Message</label>
                  <textarea
                    id="contact-message"
                    className="form-input"
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    required
                    placeholder="Write your message here..."
                    style={{ minHeight: '150px' }}
                  />
                </div>
                <button type="submit" className="rsvp-button" style={{ marginTop: '8px' }} disabled={contactSubmitting} id="btn-submit-contact">
                  {contactSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        );

      case 'submit-film':
        return (
          <div className="form-view-wrapper animate-fade">
            <span className="panel-category">Share Your Story</span>
            <h1 className="about-title" style={{ marginTop: '8px' }}>Submit a Short Film</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', maxWidth: '600px' }}>
              We curate independent short films (typically under 20 minutes) that inspire reflection, conversation, and physical action. Submit your story.
            </p>

            {filmSuccess ? (
              <div className="form-success-card">
                <h3>✓ Film Submitted Successfully</h3>
                <p>We have received your submission details. Our curation panel reviews all films for the monthly highlights slot.</p>
                <button className="retry-btn" onClick={() => setFilmSuccess(false)} style={{ marginTop: '16px' }}>
                  Submit Another Film
                </button>
              </div>
            ) : (
              <form onSubmit={handleFilmSubmit} className="interactive-form-grid">
                <div className="form-group">
                  <label htmlFor="film-title">Film Title</label>
                  <input
                    id="film-title"
                    type="text"
                    className="form-input"
                    value={filmTitle}
                    onChange={(e) => setFilmTitle(e.target.value)}
                    required
                    placeholder="Title of the short film"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="film-director">Director</label>
                  <input
                    id="film-director"
                    type="text"
                    className="form-input"
                    value={filmDirector}
                    onChange={(e) => setFilmDirector(e.target.value)}
                    required
                    placeholder="Director's name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="film-duration">Duration (e.g. 15 mins)</label>
                  <input
                    id="film-duration"
                    type="text"
                    className="form-input"
                    value={filmDuration}
                    onChange={(e) => setFilmDuration(e.target.value)}
                    placeholder="Runtime duration"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="film-link">Video Link (Vimeo / YouTube / GDrive)</label>
                  <input
                    id="film-link"
                    type="url"
                    className="form-input"
                    value={filmLink}
                    onChange={(e) => setFilmLink(e.target.value)}
                    required
                    placeholder="https://vimeo.com/..."
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="film-email">Contact Email</label>
                  <input
                    id="film-email"
                    type="email"
                    className="form-input"
                    value={filmEmail}
                    onChange={(e) => setFilmEmail(e.target.value)}
                    required
                    placeholder="filmmaker@example.com"
                  />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="film-synopsis">Brief Synopsis</label>
                  <textarea
                    id="film-synopsis"
                    className="form-input"
                    value={filmSynopsis}
                    onChange={(e) => setFilmSynopsis(e.target.value)}
                    placeholder="Provide a short summary and credits..."
                    style={{ minHeight: '100px' }}
                  />
                </div>
                <button type="submit" className="rsvp-button full-width" style={{ marginTop: '8px' }} disabled={filmSubmitting} id="btn-submit-film">
                  {filmSubmitting ? 'Submitting...' : 'Submit Film Details'}
                </button>
              </form>
            )}
          </div>
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
          onNavigateAbout={navigateToAbout}
        />
      )}

      <div className="page-body" style={{ position: 'relative', flexGrow: 1 }}>
      <main className={['home', 'campfire', 'capsule', 'watch', 'storyboard', 'invest', 'timeline', 'about'].includes(currentView) ? '' : 'container'}>
        {renderActiveView()}
      </main>

      {currentView !== 'watch' && <SiteFooter theme={theme} onNavigate={setCurrentView} />}

      {showGridOverlay && <GridOverlay cols={currentView === 'home' ? 12 : 6} rows={currentView === 'home' ? 6 : 3} />}
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
