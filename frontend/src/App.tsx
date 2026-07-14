import { useState, useEffect, useRef } from 'react';

// API interfaces
interface Film {
  id: number;
  capsule_id: number;
  title: string;
  director: string;
  duration?: string;
  video_url: string;
  thumbnail_url?: string;
  description?: string;
}

interface Reflection {
  id: number;
  capsule_id: number;
  title: string;
  content: string;
  author?: string;
  created_at: string;
}

interface Gathering {
  id: number;
  capsule_id: number;
  title: string;
  description?: string;
  date_str: string;
  location: string;
  rsvp_link?: string;
}

interface Practice {
  id: number;
  capsule_id: number;
  title: string;
  description?: string;
  steps: string;
}

interface CapsuleDetail {
  id: number;
  month: string;
  title: string;
  description?: string;
  is_active: boolean;
  film?: Film;
  reflections: Reflection[];
  gatherings: Gathering[];
  practices: Practice[];
}

interface CapsuleSummary {
  id: number;
  month: string;
  title: string;
  is_active: boolean;
}

interface TimelineQuote {
  period: string;
  source: string;
  tag: string;
  quote: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// A chronological chorus data representing Figma's "A witness through time"
const TIMELINE_QUOTES: TimelineQuote[] = [
  {
    period: "c. 2000 BCE",
    source: "Ancient Sumerian Proverb",
    tag: "Life > odds",
    quote: "“Although the number of unhappy days is endless, life is better than death.”"
  },
  {
    period: "8th c. BCE",
    source: "Homer, Iliad",
    tag: "Life > scores",
    quote: "“I would rather be a paid servant in a poor man’s house… than king of kings among the dead.”"
  },
  {
    period: "c. 6th–3rd c. BCE",
    source: "Katha Upanishad",
    tag: "Life > speed",
    quote: "“When the five senses and the mind are still… then begins the highest path.”"
  },
  {
    period: "c. 6th–3rd c. BCE",
    source: "Tao Te Ching",
    tag: "Life > tech",
    quote: "“The way that can be told is not the eternal way.”"
  },
  {
    period: "4th c. BCE",
    source: "Aristotle, Metaphysics I.2",
    tag: "Life > quantifiable",
    quote: "“It is owing to their wonder that men both now begin and at first began to philosophize.”"
  },
  {
    period: "3rd c. BCE",
    source: "Ecclesiastes",
    tag: "Life > time",
    quote: "“He has made everything beautiful in its time… He has also set eternity in the human heart…” (3:11)"
  },
  {
    period: "3rd–1st c. BCE",
    source: "Dhammapada",
    tag: "Life > data",
    quote: "“Health is the greatest gift, contentment the greatest wealth, faithfulness the best relationship.”"
  },
  {
    period: "2nd–1st c. BCE",
    source: "Bhagavad Gita",
    tag: "Life > age",
    quote: "“For the soul there is neither birth nor death at any time.” (2:20)"
  },
  {
    period: "Unknown Period",
    source: "Proverbs 3:15",
    tag: "Life > money",
    quote: "“She [wisdom] is more precious than rubies; nothing you desire can compare with her.”"
  }
];

function App() {
  // Navigation / Router States
  const [currentView, setCurrentView] = useState<'home' | 'capsule' | 'timeline' | 'about' | 'invest' | 'contact' | 'submit-film'>('home');
  const [aboutSubView, setAboutSubView] = useState<'purpose' | 'mission-vision' | 'board-staff'>('mission-vision');

  // Database API States
  const [activeCapsule, setActiveCapsule] = useState<CapsuleDetail | null>(null);
  const [allCapsules, setAllCapsules] = useState<CapsuleSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Tabbed Navigation state for Capsule view
  const [activeTab, setActiveTab] = useState<'reflections' | 'gatherings' | 'practices'>('reflections');

  // Custom Video Player states
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  // Interactive Capsule Forms states
  const [reflectionAnswer, setReflectionAnswer] = useState('');
  const [reflectionEmail, setReflectionEmail] = useState('');
  const [submitReflectionLgn, setSubmitReflectionLgn] = useState(false);
  const [reflectionSuccess, setReflectionSuccess] = useState(false);
  
  const [gatherChecked, setGatherChecked] = useState([false, false, false]);
  const [gatherSuccess, setGatherSuccess] = useState(false);

  const [practiceChecked, setPracticeChecked] = useState([false, false, false, false]);
  const [practiceSuccess, setPracticeSuccess] = useState(false);

  const [aboutMenuOpen, setAboutMenuOpen] = useState(false);

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

  const handlePlayVideo = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
  };

  const handleCapsuleSelect = (id: number) => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.load();
    }
    setReflectionAnswer('');
    setReflectionSuccess(false);
    setGatherChecked([false, false, false]);
    setGatherSuccess(false);
    setPracticeChecked([false, false, false, false]);
    setPracticeSuccess(false);
    fetchData(id);
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

  const handleReflectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reflectionAnswer || !activeCapsule) return;
    try {
      const res = await fetch(`${API_URL}/api/submissions/reflection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capsule_id: activeCapsule.id,
          email: reflectionEmail || null,
          answers: reflectionAnswer,
          submitted_to_lgn: submitReflectionLgn,
        }),
      });
      if (res.ok) {
        setReflectionSuccess(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatMonth = (monthStr: string) => {
    try {
      const [year, month] = monthStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    } catch {
      return monthStr.toUpperCase();
    }
  };

  const navigateToAbout = (subView: 'purpose' | 'mission-vision' | 'board-staff') => {
    setCurrentView('about');
    setAboutSubView(subView);
    setAboutMenuOpen(false);
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

    const film = activeCapsule.film;
    const currentReflection = activeCapsule.reflections[0];
    const currentGathering = activeCapsule.gatherings[0];
    const currentPractice = activeCapsule.practices[0];

    switch (currentView) {
      case 'home':
        return (
          <div className="home-view-wrapper">
            <div className="home-definition-block">
              LGN (n.) A community platform that offers one short film each month as common ground for reflection, discussion, and practice.
            </div>
            
            <div className="home-hero-center">
              <img src="/images/lgn-logo-registered-white.svg" alt="Life is Greater than Numbers" style={{ width: 'auto', height: '180px', maxWidth: '90%', marginBottom: '32px' }} />
              <p className="home-hero-subtitle">Great stories for greater living.</p>
              <button className="home-hero-btn" onClick={() => setCurrentView('capsule')}>Lightpoles</button>
            </div>
          </div>
        );

      case 'capsule':
        return (
          <div className="capsule-view-wrapper">
            <div className="capsule-tabs-header">
              {allCapsules.map((cap) => (
                <button
                  key={cap.id}
                  className={`capsule-month-tab ${activeCapsule.id === cap.id ? 'active' : ''}`}
                  onClick={() => handleCapsuleSelect(cap.id)}
                >
                  {formatMonth(cap.month).replace(' ', '—')}
                </button>
              ))}
            </div>

            <div className="capsule-content-area">
              <div className="capsule-title-row">
                <h1 className="capsule-main-title">{film ? film.title : 'Lorem Ipsum Title'}</h1>
                <div className="capsule-title-pills">
                  <button className="capsule-pill active">The Story</button>
                  <button className="capsule-pill">Storyboard</button>
                </div>
              </div>

              <div className="capsule-video-player">
                {film ? (
                  <>
                    {!isPlaying && (
                      <div 
                        className="video-poster-overlay"
                        style={{ backgroundImage: `url(${film.thumbnail_url || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80'})` }}
                      >
                        <button className="play-trigger-btn" onClick={handlePlayVideo} aria-label="Play Film" id="btn-play-video">
                          <svg viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
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
                  </>
                ) : (
                  <div className="no-film-placeholder">No film associated with this capsule yet.</div>
                )}
              </div>

              <div className="capsule-three-col-grid">
                {/* Column 1: Reflect */}
                <div className="capsule-col">
                  <h2>Reflect</h2>
                  <ul className="capsule-list">
                    <li>A small set of reflection questions</li>
                    <li>Space to write privately</li>
                    <li>Option to email/text reflections to oneself</li>
                    <li>Optional submission to LGN (for review)</li>
                  </ul>
                  <button className="capsule-btn">Button</button>
                </div>

                {/* Column 2: Gather */}
                <div className="capsule-col">
                  <h2>Gather</h2>
                  <ul className="capsule-list">
                    <li>Discussion guide/resources (not downloadable just on the web)</li>
                    <li>Option to share discussion takeaways with LGN Community</li>
                    <li>Tell us you gathered</li>
                    <li>Share a glimpse of your gathering</li>
                    <li>Let us know where the story traveled</li>
                  </ul>
                  <button className="capsule-btn">Button</button>
                </div>

                {/* Column 3: Practice */}
                <div className="capsule-col">
                  <h2>Practice</h2>
                  <ul className="capsule-list">
                    <li>A shared monthly practice: One accessible invitation connected to the capsule.</li>
                    <li>Further pathways: Additional ways to learn, serve, create, connect, or continue.</li>
                    <li>One clear practice invitation</li>
                    <li>A few alternate pathways for different people or contexts</li>
                    <li>Related organizations, readings, or resources</li>
                    <li>A way to privately choose a next step</li>
                    <li>Option to share what happened afterward with LGN Community</li>
                  </ul>
                  <button className="capsule-btn">Button</button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'timeline':
        return (
          <div className="timeline-view-wrapper">
            <div className="timeline-header-area">
              <span className="panel-category">Chronological Chorus</span>
              <h1 className="timeline-main-title">A Witness through Time</h1>
              <p className="timeline-subtitle">
                Affirming the foundational tenet: <strong>Life is Greater than Numbers</strong> (<code>Life &gt; Numbers</code>). A chorus of humanity protesting numerical reductionism across the millennia.
              </p>
            </div>

            <div className="vertical-timeline-container">
              {TIMELINE_QUOTES.map((q, idx) => (
                <div className="timeline-card-item" key={idx}>
                  <div className="timeline-dot-connector">
                    <div className="timeline-pulsing-dot"></div>
                  </div>
                  <div className="timeline-card-content">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <span className="timeline-period-badge">{q.period}</span>
                      <span className="timeline-tag-badge">{q.tag}</span>
                    </div>
                    <blockquote className="timeline-quote-text">{q.quote}</blockquote>
                    <cite className="timeline-quote-source">— {q.source}</cite>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

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
                  <div style={{ marginBottom: '80px' }}>
                    <div className="about-mv-label">Mission</div>
                    <h2 className="about-mv-text">To equip short films with pathways for reflection, discussion, and practice.</h2>
                  </div>
                  <div>
                    <div className="about-mv-label">Vision</div>
                    <h2 className="about-mv-text">A culture of common ground, where life is greater than numbers.</h2>
                  </div>
                </div>
              )}

              {aboutSubView === 'purpose' && (
                <div className="animate-fade">
                  <div className="about-mv-label" style={{ marginBottom: '40px' }}>Purpose</div>
                  <p className="about-purpose-text">LGN stands for Life &gt; Numbers—a reminder that people are more than metrics, outcomes, opinions, identities, and categories.</p>
                  <p className="about-purpose-text">We gather people around great stories that help us see life more fully.</p>
                  <p className="about-purpose-text">Each month, LGN offers one film as common ground, with simple pathways for reflection, discussion, and practice that help the story move beyond the screen and into greater living.</p>
                </div>
              )}

              {aboutSubView === 'board-staff' && (
                <div className="animate-fade">
                  <div className="team-section">
                    <h2 className="team-label">Staff</h2>
                    <div className="team-grid">
                      <div className="person-card">
                        <h3 className="person-name">Karson Utzinger</h3>
                        <p className="person-title">Founder and Executive Director</p>
                        <p className="person-bio">I love jo. She's my love.</p>
                      </div>
                      <div className="person-card">
                        <h3 className="person-name">Stephen Brown</h3>
                        <p className="person-title">Pipeline Producer</p>
                        <p className="person-bio">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque vitae consequat lectus. Morbi pulvinar mauris nec leo ultricies rutrum.</p>
                      </div>
                      <div className="person-card">
                        <h3 className="person-name">Joëlle Utzinger</h3>
                        <p className="person-title">Brand Designer</p>
                        <p className="person-bio">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque vitae consequat lectus. Morbi pulvinar mauris nec leo ultricies rutrum.</p>
                      </div>
                    </div>
                  </div>

                  <div className="team-section">
                    <h2 className="team-label">Board</h2>
                    <div className="team-grid">
                      <div className="person-card">
                        <h3 className="person-name">Kirk Utzinger</h3>
                        <p className="person-title">Board Chair</p>
                        <p className="person-bio">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque vitae consequat lectus. Morbi pulvinar mauris nec leo ultricies rutrum.</p>
                      </div>
                      <div className="person-card">
                        <h3 className="person-name">Lorem Ipsum</h3>
                        <p className="person-title">Secretary</p>
                        <p className="person-bio">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque vitae consequat lectus. Morbi pulvinar mauris nec leo ultricies rutrum.</p>
                      </div>
                      <div className="person-card">
                        <h3 className="person-name">Dean Kato</h3>
                        <p className="person-title">Director of Board Development</p>
                        <p className="person-bio">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque vitae consequat lectus. Morbi pulvinar mauris nec leo ultricies rutrum.</p>
                      </div>
                      <div className="person-card">
                        <h3 className="person-name">Lorem Ipsum</h3>
                        <p className="person-title">Director of Community Engagement</p>
                        <p className="person-bio">Bio: </p>
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
            <div className="invest-header-row">
              <h1 className="invest-title">How you can invest in this vision:</h1>
              <p className="invest-disclaimer">
                As a registered 501(c)(3), donations to Life is Greater than Numbers, Inc. are tax-deductible to the fullest extent allowed by law. Charitable disclosure & state registration info will be added here as we complete our national registration process. This page is not intended as a solicitation in jurisdictions where Life is Greater than Numbers, Inc. is not yet registered or exempt from registration.
              </p>
            </div>
            
            <ul className="invest-list">
              <li>— Share this vision with your network</li>
              <li>— Join the LGN discourse (in beta)</li>
              <li>— Partner with us to kickstart a peer-to-peer fundraising campaign</li>
            </ul>

            <div className="invest-grid">
              <div className="invest-option">
                <div className="invest-option-header">
                  <span>Time</span>
                  <button className="invest-option-btn">+</button>
                </div>
              </div>
              <div className="invest-option">
                <div className="invest-option-header">
                  <span>Talent</span>
                  <button className="invest-option-btn">+</button>
                </div>
              </div>
              <div className="invest-option">
                <div className="invest-option-header">
                  <span>Treasure</span>
                  <button className="invest-option-btn">+</button>
                </div>
              </div>
            </div>
          </div>
        );


      case 'contact':
        return (
          <div className="form-view-wrapper animate-fade">
            <span className="panel-category">Reach Out</span>
            <h1 className="about-title" style={{ marginTop: '8px' }}>Contact LGN Cinema</h1>
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
                <button type="submit" className="rsvp-button full-width" style={{ marginTop: '8px' }} disabled={contactSubmitting} id="btn-submit-contact">
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
      <header className="floating-header-container">
        <div className="header-pill-left">
          <button onClick={() => setCurrentView('home')} className="nav-brand-btn">
            <img src="/images/lgn-icon-white.svg" alt="LGN Icon" style={{ width: '24px', height: '24px' }} />
          </button>
          
          <div className="nav-dropdown-wrapper" onMouseEnter={() => setAboutMenuOpen(true)} onMouseLeave={() => setAboutMenuOpen(false)}>
            <button className={`nav-link-pill ${currentView === 'about' ? 'active' : ''}`} onClick={() => setCurrentView('about')}>About</button>
            {aboutMenuOpen && (
              <div className="dropdown-menu">
                <button className="dropdown-item" onClick={() => navigateToAbout('mission-vision')}>Mission + Vision</button>
                <button className="dropdown-item" onClick={() => navigateToAbout('purpose')}>Purpose</button>
                <button className="dropdown-item" onClick={() => navigateToAbout('board-staff')}>Board + Staff</button>
              </div>
            )}
          </div>
          
          <button className={`nav-link-pill ${currentView === 'invest' ? 'active' : ''}`} onClick={() => setCurrentView('invest')}>Invest</button>
          <button className={`nav-link-pill ${currentView === 'capsule' ? 'active' : ''}`} onClick={() => setCurrentView('capsule')}>Lightpoles</button>
        </div>

        <div className="header-pill-right">
          <button className={`nav-link-pill ${currentView === 'contact' ? 'active' : ''}`} onClick={() => setCurrentView('contact')}>Contact</button>
        </div>
      </header>

      <main className="container" style={{ flexGrow: 1, paddingBottom: '60px' }}>
        {renderActiveView()}
      </main>

      <footer className="lgn-footer">
        <div className="footer-grid">
          {/* Column 1: Logo & Copyright */}
          <div className="footer-col col-logo">
            <img src="/images/lgn-logo-registered-white.svg" alt="Life is Greater than Numbers" style={{ width: '200px', marginBottom: '24px' }} />
            <div className="footer-bottom-text">&copy;{new Date().getFullYear()} Life is Greater than Numbers, Inc.</div>
          </div>

          {/* Column 2: Navigation */}
          <div className="footer-col col-nav">
            <nav className="footer-nav">
              <button onClick={() => setCurrentView('capsule')}>Lightpoles</button>
              <button onClick={() => setCurrentView('about')}>About</button>
              <button onClick={() => { setCurrentView('about'); setAboutSubView('invest'); }}>Invest</button>
              <button onClick={() => setCurrentView('submit-film')}>Submit a film</button>
              <button onClick={() => setCurrentView('contact')}>Contact</button>
            </nav>
            <div className="footer-bottom-text">501(c)(3) EIN: 33-2376438</div>
          </div>

          {/* Column 3: Mailing & Social */}
          <div className="footer-col col-mailing">
            <h3>Mailing</h3>
            <p>Life is Greater than Numbers, Inc.<br/>1950 W Corporate Way, STE 31556<br/>Anaheim, CA 92801</p>
            <div className="footer-bottom-text social-links">
              <a href="#">YT</a>
              <a href="#">Vimeo</a>
            </div>
          </div>

          {/* Column 4: Join */}
          <div className="footer-col col-join">
            <h3>Join</h3>
            <form className="join-form">
              <input type="email" placeholder="Email Address" required />
              <button type="submit">Submit</button>
            </form>
            <div className="footer-bottom-text">A witness through time</div>
          </div>
        </div>
      </footer>
    </>
  );
}

export default App;
