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
 * - The frame's social link says "Youtube". Films are hosted on Vimeo and the
 *   live link is Vimeo, so it stays until someone confirms the change.
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
          <nav className="footer-nav">
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
          <div className="footer-bottom-text" style={{ cursor: 'pointer' }} onClick={() => onNavigate('timeline')}>A witness through time</div>
        </div>
      </div>
    </footer>
  );
}
