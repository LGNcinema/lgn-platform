/**
 * The on/off switch for all of Beyond the Screen, as the admin portal sees it.
 * One instance lives in AdminApp so the sidebar and the switch card agree.
 */
import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '../adminClient';
import { errorMessage } from '../panels/formState';

export interface FlagState {
  enabled: boolean;
  /** "admin": set with this switch. "default": the server's own setting applies. */
  source: 'admin' | 'default';
  default: boolean;
}

export interface BeyondFlag {
  state: FlagState | null;
  busy: boolean;
  error: string | null;
  /** true / false saves the choice; null goes back to the server's default. */
  set: (enabled: boolean | null) => Promise<void>;
}

const PATH = '/api/admin/features/beyond-the-screen';

export function useBeyondFlag(signedIn: boolean): BeyondFlag {
  const [state, setState] = useState<FlagState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    adminFetch<FlagState>(PATH)
      .then((s) => live && setState(s))
      .catch((err) => live && setError(errorMessage(err)));
    return () => {
      live = false;
    };
  }, [signedIn]);

  const set = useCallback(async (enabled: boolean | null) => {
    setBusy(true);
    setError(null);
    try {
      setState(await adminFetch<FlagState>(PATH, { method: 'PUT', body: { enabled } }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, error, set };
}
