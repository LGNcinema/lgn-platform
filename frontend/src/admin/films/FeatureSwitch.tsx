import { Alert, Section } from '../panels/Fields';
import type { BeyondFlag } from './useBeyondFlag';

/**
 * The on/off switch for the whole feature. Off hides, for visitors: the film
 * search on the Go Beyond page, every film page, and TMDB's credit. This portal
 * keeps working either way, so questions can be prepared before it goes live.
 */
export function FeatureSwitch({ flag }: { flag: BeyondFlag }) {
  const { state, busy, error, set } = flag;
  if (!state) {
    return error ? (
      <Section title="Visitor access">
        <Alert>{error}</Alert>
      </Section>
    ) : null;
  }

  const on = state.enabled;
  return (
    <Section title="Visitor access">
      <div className="fa-switch">
        <p className="fa-switch-state" role="status">
          <span className={`fa-dot${on ? ' is-on' : ''}`} aria-hidden="true" />
          {on ? 'On: visitors can search any film.' : 'Off: visitors cannot see this feature.'}
        </p>
        <button
          type="button"
          className={`apnl-btn${on ? '' : ' apnl-btn--primary'}`}
          disabled={busy}
          onClick={() => void set(!on)}
        >
          {busy ? 'Saving…' : on ? 'Turn off' : 'Turn on'}
        </button>
      </div>
      <p className="apnl-note">
        {state.source === 'admin' ? (
          <>
            Set here. The server&rsquo;s own setting is {state.default ? 'on' : 'off'}.{' '}
            <button type="button" className="apnl-btn apnl-btn--link" disabled={busy} onClick={() => void set(null)}>
              Use the server&rsquo;s setting
            </button>
          </>
        ) : (
          <>Not set here yet, so this follows the server&rsquo;s own setting ({state.default ? 'on' : 'off'}).</>
        )}{' '}
        This switch belongs to this site&rsquo;s own database, so a test site and the live site keep separate
        settings.
        {!on && <> Before turning it on for the live site, TMDB must have approved LGN&rsquo;s use in writing.</>}
      </p>
      {error && <Alert>{error}</Alert>}
    </Section>
  );
}
