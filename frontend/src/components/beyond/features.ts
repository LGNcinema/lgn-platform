/**
 * Which optional features the site should show. LGN flips them in the admin
 * portal (Go Beyond films); the server answers at /api/features.
 *
 * Fails closed: if the answer cannot be read, the feature is treated as off, so
 * a hiccup never exposes something that was switched off.
 */
import { API_URL } from '../../api';

export interface Features {
  beyondTheScreen: boolean;
}

export async function fetchFeatures(signal?: AbortSignal): Promise<Features> {
  try {
    const res = await fetch(`${API_URL}/api/features`, { signal, cache: 'no-store' });
    if (!res.ok) return { beyondTheScreen: false };
    const body = (await res.json()) as { beyond_the_screen?: boolean };
    return { beyondTheScreen: body.beyond_the_screen === true };
  } catch {
    return { beyondTheScreen: false };
  }
}
