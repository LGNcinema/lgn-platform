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

const CONTACT_EMAIL = 'info@lgncinema.org';

/**
 * Global footer. Figma v3: the bottom of every frame -- a 1px rule across the
 * page, then four columns: the logo, Navigate, Contact and Join, with a
 * bottom row of small print under them.
 *
 * Where it deliberately does NOT follow the frame: the frame spells the
 * social link "Youtube"; the brand is "YouTube".
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

  const nav = (view: SiteView, label: string) => (
    <li>
      <button type="button" className="lgn-link" onClick={() => onNavigate(view)}>
        {label}
      </button>
    </li>
  );

  return (
    <footer className="lgn-footer">
      <div className="footer-grid">
        <div className="footer-col col-logo">
          <img
            className="footer-logo"
            src={theme === 'dark' ? '/images/lgn-logo-registered-white.svg' : '/images/lgn-logo-registered.svg'}
            alt="Life is Greater than Numbers"
          />
          <p className="footer-bottom">501(c)(3) EIN: 33-2376438</p>
        </div>

        <nav className="footer-col col-nav" aria-labelledby="footer-nav-heading">
          <h2 id="footer-nav-heading" className="footer-heading">Navigate</h2>
          <ul className="footer-list">
            {nav('campfire', 'Go Beyond')}
            {nav('invest', 'Invest')}
            {nav('about', 'About')}
            {nav('storyboard', 'Storyboard')}
            {nav('submit-film', 'Submit a film')}
          </ul>
          <p className="footer-bottom">
            <button type="button" className="lgn-link" onClick={() => onNavigate('timeline')}>
              A witness through time
            </button>
          </p>
        </nav>

        <div className="footer-col col-contact">
          <h2 className="footer-heading">Contact</h2>
          <p className="footer-text">
            <a className="lgn-link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
          <address className="footer-text">
            Life is Greater than Numbers, Inc.
            <br />
            1950 W Corporate Way, STE 31556
            <br />
            Anaheim, CA 92801
          </address>
          <p className="footer-bottom">
            <a className="lgn-link" href="https://www.youtube.com/@lgncinema" target="_blank" rel="noopener noreferrer">
              YouTube
            </a>
          </p>
        </div>

        <div className="footer-col col-join">
          <h2 className="footer-heading">Join</h2>
          {/* Mailchimp signup in our own markup, sent in the background (see
              mailchimp.ts) with the result shown here. The hidden field is
              Mailchimp's bot trap. */}
          <form className="join-form" onSubmit={(e) => void handleJoin(e)}>
            <input
              className="lgn-field join-form-field"
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
            <button
              type="submit"
              className="lgn-link join-form-submit"
              disabled={join.kind === 'sending'}
              aria-busy={join.kind === 'sending' || undefined}
            >
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
          <p className="footer-bottom">&copy;{new Date().getFullYear()} Life is Greater than Numbers, Inc.</p>
        </div>
      </div>
    </footer>
  );
}
