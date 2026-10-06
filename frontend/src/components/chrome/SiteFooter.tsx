import './SiteFooter.css';
import type { SiteView } from './SiteHeader';

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
          {/* Inert by design: there is no newsletter backend yet. preventDefault
              stops a native GET submit from reloading the page onto "?" and
              dropping the current view. The field keeps its browser validation. */}
          <form className="join-form" onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="Email Address" aria-label="Email address" autoComplete="email" required />
            <button type="submit">Submit</button>
          </form>
          <button type="button" className="footer-bottom-text footer-link" onClick={() => onNavigate('timeline')}>A witness through time</button>
        </div>
      </div>
    </footer>
  );
}
