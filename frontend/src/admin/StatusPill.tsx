/**
 * The one publication badge the portal uses -- sidebar row, capsule heading and
 * preview frame all render this, so the three states can never drift apart in
 * wording or colour between them.
 */
import { STATE_LABEL } from './publishing';
import type { PublicationState } from './publishing';

/** Why each state looks the way it does, for the badge's `title`. */
const STATE_HINT: Record<PublicationState, string> = {
  published: 'Visible on the public site.',
  scheduled: 'Not visible yet -- it goes live at its scheduled time.',
  due: 'Its scheduled time has passed, so the site is already serving it. Reload to refresh this view.',
  draft: 'Not visible on the public site.',
};

export function StatusPill({ state }: { state: PublicationState }) {
  return (
    <span className={`admin-status-pill is-${state}`} title={STATE_HINT[state]}>
      <span className="admin-status-dot" aria-hidden="true" />
      {STATE_LABEL[state]}
    </span>
  );
}

export default StatusPill;
