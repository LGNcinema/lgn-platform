import { useState, type FormEvent } from 'react';
import './SiteFooter.css';
import type { AboutSubView, SiteView } from './SiteHeader';
import { MAILCHIMP_BOT_FIELD, subscribeEmail } from './mailchimp';

type JoinState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; already?: boolean }
  | { kind: 'error'; message: string };

interface Props {
  theme: 'light' | 'dark';
  onNavigate: (view: SiteView) => void;
  /** Opens one of the About pages (FAQs + Credits is one of them). */
  onOpenAbout: (sub: AboutSubView) => void;
}

const CONTACT_EMAIL = 'info@lgncinema.org';

/**
 * Global footer. Figma "FOOTER V3": a 1px rule across the page, then three
 * columns on the 40 / 660 / 1280 lines -- links; contact and address; Join
 * us -- and a bottom row of the wordmark, the EIN and the copyright.
 *
 * Where it deliberately does NOT follow the frame: the frame spells the
 * social link "Youtube"; the brand is "YouTube". "Privacy, terms,
 * accessibility" is plain text until those pages exist.
 */
export function SiteFooter({ theme, onNavigate, onOpenAbout }: Props) {
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

  const link = (label: string, onClick: () => void) => (
    <li>
      <button type="button" className="lgn-link" onClick={onClick}>
        {label}
      </button>
    </li>
  );

  return (
    <footer className="lgn-footer">
      <div className="footer-grid">
        <nav className="footer-col col-nav" aria-label="Footer">
          <ul className="footer-list">
            {link('About', () => onOpenAbout('life-numbers'))}
            {link('Invest', () => onNavigate('invest'))}
            {link('For filmmakers', () => onNavigate('for-filmmakers'))}
            {link('FAQs + Credits', () => onOpenAbout('faqs'))}
          </ul>
          <ul className="footer-list footer-list--gap">
            {link('A witness through time', () => onNavigate('timeline'))}
            <li>
              <a className="lgn-link" href="https://www.youtube.com/@lgncinema" target="_blank" rel="noopener noreferrer">
                YouTube
              </a>
            </li>
          </ul>
        </nav>

        <div className="footer-col col-contact">
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
          <p className="footer-text">Privacy, terms, accessibility</p>
        </div>

        <div className="footer-col col-join">
          <h2 className="footer-heading">Join us</h2>
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
              className="lgn-btn join-form-submit"
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
        </div>

        <img
          className="footer-logo"
          src={theme === 'dark' ? '/images/lgn-logo-registered-white.svg' : '/images/lgn-logo-registered.svg'}
          alt="Life is Greater than Numbers"
        />
        <p className="footer-bottom">501(c)(3) EIN: 33-2376438</p>
        <p className="footer-bottom">&copy;{new Date().getFullYear()} Life is Greater than Numbers, Inc.</p>
      </div>
    </footer>
  );
}
