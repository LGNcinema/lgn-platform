import { useState, type FormEvent } from 'react';
import './SiteFooter.css';
import type { SiteView } from './SiteHeader';
import { MAILCHIMP_BOT_FIELD, subscribeEmail } from './mailchimp';

type JoinState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; already?: boolean }
  | { kind: 'error'; message: string };

interface Props {
  theme: 'light' | 'dark';
  onNavigate: (view: SiteView) => void;
}

/**
 * Global footer. Figma: `Footer`, and the bottom of every [CAMPFIRE] frame.
 *
 * Extracted from App.tsx as-is apart from "Lightpoles" -> "Campfire" in the
 * nav column, matching the header.
 *
 * Two places the Figma frame differs and this deliberately does NOT follow it:
 * - The frame reads "5501(c)(3)". The designation is 501(c)(3); the extra 5 is
 *   a typo in the frame, and this is a legal/tax identifier.
 *
 * The social link is YouTube, spelled properly (the frame has "Youtube").
 */
export function SiteFooter({ theme, onNavigate }: Props) {
  const [join, setJoin] = useState<JoinState>({ kind: 'idle' });

  const handleJoin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    // A filled-in trap field means a bot: look successful, send nothing.
    if (String(data.get(MAILCHIMP_BOT_FIELD) ?? '')) {
      setJoin({ kind: 'done' });
      return;
    }
    setJoin({ kind: 'sending' });
    const result = await subscribeEmail(String(data.get('EMAIL') ?? '').trim());
    if (result.ok) {
      form.reset();
      setJoin({ kind: 'done', already: result.alreadySubscribed });
    } else {
      setJoin({ kind: 'error', message: result.message });
    }
  };

  return (
    <footer className="lgn-footer">
      <div className="footer-grid">
        {/* Column 1: Logo & Copyright */}
        <div className="footer-col col-logo">
          <img className="footer-logo" src={theme === 'dark' ? '/images/lgn-logo-registered-white.svg' : '/images/lgn-logo-registered.svg'} alt="Life is Greater than Numbers" />
          <div className="footer-bottom-text">&copy;{new Date().getFullYear()} Life is Greater than Numbers, Inc.</div>
        </div>

        {/* Column 2: Navigation */}
        <div className="footer-col col-nav">
          <nav className="footer-nav" aria-label="Footer">
            <button onClick={() => onNavigate('campfire')}>Campfire</button>
            <button onClick={() => onNavigate('about')}>About</button>
            <button onClick={() => onNavigate('invest')}>Invest</button>
            <button onClick={() => onNavigate('submit-film')}>Submit a film</button>
            <button onClick={() => onNavigate('contact')}>Contact</button>
          </nav>
          <div className="footer-bottom-text">501(c)(3) EIN: 33-2376438</div>
        </div>

        {/* Column 3: Mailing & Social */}
        <div className="footer-col col-mailing">
          <h3>Mailing</h3>
          <p>Life is Greater than Numbers, Inc.<br />1950 W Corporate Way, STE 31556<br />Anaheim, CA 92801</p>
          <div className="footer-bottom-text social-links">
            <a href="https://www.youtube.com/@lgncinema" target="_blank" rel="noopener noreferrer">YouTube</a>
          </div>
        </div>

        {/* Column 4: Join */}
        <div className="footer-col col-join">
          <h3>Join</h3>
          {/* Mailchimp signup in our own markup, sent in the background (see
              mailchimp.ts) with the result shown here -- no Mailchimp page or
              branding. The hidden field is Mailchimp's bot trap. */}
          <form className="join-form" onSubmit={(e) => void handleJoin(e)}>
            <input
              type="email"
              name="EMAIL"
              placeholder="Email Address"
              aria-label="Email address"
              autoComplete="email"
              required
              onChange={() => {
                if (join.kind === 'done' || join.kind === 'error') setJoin({ kind: 'idle' });
              }}
            />
            <div aria-hidden="true" className="join-form-trap">
              <input type="text" name={MAILCHIMP_BOT_FIELD} tabIndex={-1} defaultValue="" autoComplete="off" />
            </div>
            <button type="submit" disabled={join.kind === 'sending'} aria-busy={join.kind === 'sending' || undefined}>
              {join.kind === 'sending' ? 'Sending…' : 'Submit'}
            </button>
            <p className={`join-form-status${join.kind === 'error' ? ' is-error' : ''}`} role="status">
              {join.kind === 'done' &&
                (join.already
                  ? 'You’re already on the list — thank you!'
                  : 'Thank you! Check your inbox to confirm.')}
              {join.kind === 'error' && join.message}
            </p>
          </form>
          <button type="button" className="footer-bottom-text footer-link" onClick={() => onNavigate('timeline')}>A witness through time</button>
        </div>
      </div>
    </footer>
  );
}
