/**
 * Form plumbing shared by the admin editor panels: value coercion, dirty
 * tracking, and save state.
 *
 * These live apart from `Fields.tsx` deliberately -- a module that exports both
 * components and plain functions breaks React Fast Refresh (and trips
 * `react/only-export-components`), so the components stay there and everything
 * non-component stays here.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AdminApiError, registerDirty } from '../adminClient';

/* -------------------------------------------------------------- helpers -- */

/** Render a possibly-absent value as a string -- never "undefined"/"null". */
export function str(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/**
 * Empty means "clear this column". Anything else is passed through *verbatim*:
 * no trimming, no whitespace collapsing, because newlines are meaningful in
 * `discuss_prompts`, `steps` and every long-form body field.
 */
export function orNull(value: string): string | null {
  return value === '' ? null : value;
}

/** Parse an integer field. Empty -> null, non-numeric -> undefined (invalid). */
export function intOrNull(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) return undefined;
  return parsed;
}

/** Pull something human-readable out of whatever the client threw. */
export function errorMessage(error: unknown): string {
  if (error instanceof AdminApiError) {
    return error.message || `Request failed (HTTP ${error.status}).`;
  }
  if (error instanceof Error) return error.message || 'Request failed.';
  return 'Something went wrong. Please try again.';
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/* ----------------------------------------------------- dirty registration -- */

/**
 * Publish one form's dirty state into the shared registry in `adminClient`, so
 * the shell can warn before it navigates away and `beforeunload` can warn before
 * the tab closes. The key is a per-instance `useId()`, so several forms on the
 * same screen (every card in a list panel) each get their own slot.
 */
export function useDirtyRegistration(dirty: boolean): void {
  const key = useId();

  useEffect(() => {
    registerDirty(key, dirty);
  }, [key, dirty]);

  // Unmounting always releases the slot, even mid-edit: a form that is gone
  // cannot be saved, and a stale `true` would warn about nothing forever.
  useEffect(
    () => () => {
      registerDirty(key, false);
    },
    [key],
  );
}

/* ---------------------------------------------------------- edit  state -- */

export type DraftValue = string | number | boolean;

export interface EditState<T extends Record<string, DraftValue>> {
  draft: T;
  /** The last known server values. `dirty` is measured against these. */
  baseline: T;
  dirty: boolean;
  set: (key: Extract<keyof T, string>, value: T[Extract<keyof T, string>]) => void;
  /** Apply several keys in one render -- used when one field derives others. */
  setMany: (patch: Partial<T>) => void;
  /** Throw away local edits, back to the last known server values. */
  reset: () => void;
  /** Accept `next` as the new server truth (call after a successful save). */
  commit: (next: T) => void;
}

/**
 * Local edit state with dirty tracking against the values that came from the
 * server.
 *
 * The important behaviour is the refresh rule: when the parent refetches (which
 * is exactly what `onSaved()` triggers) a brand-new `incoming` object arrives.
 * We adopt it only when there is nothing local to lose. If the user has unsaved
 * edits, the incoming values are ignored, so a background refresh can never
 * yank a half-typed field out from under them.
 *
 * That rule is only safe because a panel is remounted (`key={capsule.id}` in the
 * shell) when the *subject* changes. Refusing incoming values is right for a
 * refetch of the same row; it would be catastrophic for a different row, which
 * is why the shell must never reuse a panel instance across capsules.
 */
export function useEditState<T extends Record<string, DraftValue>>(incoming: T): EditState<T> {
  const [baseline, setBaseline] = useState<T>(incoming);
  const [draft, setDraft] = useState<T>(incoming);

  const dirty = !shallowEqual(draft, baseline);
  useDirtyRegistration(dirty);

  const dirtyRef = useRef(dirty);
  const incomingRef = useRef(incoming);
  useEffect(() => {
    dirtyRef.current = dirty;
    incomingRef.current = incoming;
  });

  const signature = JSON.stringify(incoming);
  const seenSignature = useRef(signature);
  useEffect(() => {
    if (seenSignature.current === signature) return;
    seenSignature.current = signature;
    if (dirtyRef.current) return;
    setBaseline(incomingRef.current);
    setDraft(incomingRef.current);
  }, [signature]);

  const set = useCallback<EditState<T>['set']>((key, value) => {
    setDraft((current) => ({ ...current, [key]: value }) as T);
  }, []);

  const setMany = useCallback<EditState<T>['setMany']>((patch) => {
    setDraft((current) => ({ ...current, ...patch }) as T);
  }, []);

  const reset = useCallback(() => setDraft(baseline), [baseline]);

  const commit = useCallback((next: T) => {
    setBaseline(next);
    setDraft(next);
  }, []);

  return { draft, baseline, dirty, set, setMany, reset, commit };
}

/* ---------------------------------------------------------- save  state -- */

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface SaveState {
  status: SaveStatus;
  saving: boolean;
  error: string | null;
  /** Run a save. Resolves true when it succeeded. */
  run: (action: () => Promise<void>) => Promise<boolean>;
  /** Fail locally (client-side validation) without calling the API. */
  fail: (message: string) => void;
  clearError: () => void;
}

/** Pending / success / inline-error state for one save button. */
export function useSaveState(): SaveState {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  const run = useCallback(async (action: () => Promise<void>) => {
    window.clearTimeout(timer.current);
    setError(null);
    setStatus('saving');
    try {
      await action();
      if (!alive.current) return true;
      setStatus('saved');
      timer.current = window.setTimeout(() => {
        if (alive.current) setStatus('idle');
      }, 2600);
      return true;
    } catch (caught) {
      if (!alive.current) return false;
      setError(errorMessage(caught));
      setStatus('error');
      return false;
    }
  }, []);

  const fail = useCallback((message: string) => {
    window.clearTimeout(timer.current);
    setError(message);
    setStatus('error');
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setStatus((current) => (current === 'error' ? 'idle' : current));
  }, []);

  return { status, saving: status === 'saving', error, run, fail, clearError };
}
