import { Alert } from '../panels/Fields';
import type { BeyondFlag } from './useBeyondFlag';

/**
 * The on/off switch for all of Beyond the Screen, as one line in the page header.
 * Off hides, for visitors: the film search on the Go Beyond page, every film page
 * and the Credits tab. This portal keeps working either way, so questions can be
 * written before it goes live.
 */
export function VisitorSwitch({ flag }: { flag: BeyondFlag }) {
  const { state, busy, error, set } = flag;
  if (!state) return error ? <Alert>{error}</Alert> : null;

  const on = state.enabled;
  return (
    <div className="fa-switch">
      <span className="fa-switch-state" role="status">
        <span className={`fa-dot${on ? ' is-on' : ''}`} aria-hidden="true" />
        {on ? 'On for visitors' : 'Off for visitors'}
      </span>
      <button
        type="button"
        className={`apnl-btn${on ? '' : ' apnl-btn--primary'}`}
        disabled={busy}
        onClick={() => void set(!on)}
      >
        {busy ? 'Saving…' : on ? 'Turn off' : 'Turn on'}
      </button>
      {state.source === 'admin' && (
        // Only shown once someone has used the switch here: until then it already follows the server.
        <button type="button" className="apnl-btn apnl-btn--link" disabled={busy} onClick={() => void set(null)}>
          Use the server’s setting ({state.default ? 'on' : 'off'})
        </button>
      )}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
