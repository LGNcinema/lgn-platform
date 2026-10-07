import { useCallback, useEffect, useId, useRef, useState } from 'react';
import './Storyboard.css';
import type { CapsuleDetail } from '../../types';
import {
  fetchOwnStoryStatus,
  fetchStoryboard,
  shrinkPhoto,
  storyPhotoSrc,
  submitStory,
  type StoryboardStory,
  type StoryStatus,
} from './campfire';

interface Props {
  capsule: CapsuleDetail;
  storyNumber: number;
  onBackToCampfire: () => void;
}

/** The backend's limit on a story's length (StoryboardSubmissionCreate). */
const MAX_STORY_LENGTH = 5000;

/** Read once, like App's other QA params: `?modal=1` opens the terms dialog on
 *  load even for a visitor who already agreed. */
const OPEN_DIALOG_ON_LOAD = (() => {
  const value = new URLSearchParams(window.location.search).get('modal');
  return value === '1' || value === 'true';
})();

/* --------------------------------------------------------------- storage
 * Everything here is per browser -- there are no visitor accounts.
 *   - TERMS_KEY: the visitor agreed to the storyboard terms (any story).
 *   - mineKey:   the stories this browser submitted for one capsule, with the
 *                token that lets it ask the server whether each was approved.
 *                Having one is what opens the board to this visitor.
 * Every access is wrapped: storage throws outright in some privacy modes, and
 * none of this may take the page down.
 * --------------------------------------------------------------------- */

const TERMS_KEY = 'campfire_storyboard_terms_v1';
const mineKey = (capsuleId: number) => `campfire_storyboard_mine_${capsuleId}`;

interface MyStory {
  id: number;
  token: string;
  content: string;
  author_name: string | null;
  author_location: string | null;
  /** The shrunk JPEG data URL, so the visitor sees their own photo while the
   *  story is pending (the public photo URL only works once approved). */
  photo: string | null;
  created_at: string | null;
  status: StoryStatus;
}

function readAgreed(): boolean {
  try {
    return localStorage.getItem(TERMS_KEY) === 'agreed';
  } catch {
    return false;
  }
}

function writeAgreed() {
  try {
    localStorage.setItem(TERMS_KEY, 'agreed');
  } catch {
    // Blocked storage: they agree again next visit.
  }
}

function readMine(capsuleId: number): MyStory[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(mineKey(capsuleId)) ?? '[]');
    return Array.isArray(parsed) ? (parsed as MyStory[]) : [];
  } catch {
    return [];
  }
}

function writeMine(capsuleId: number, mine: MyStory[]) {
  try {
    localStorage.setItem(mineKey(capsuleId), JSON.stringify(mine));
  } catch {
    // Most likely over quota: keep the stories, drop the photo copies.
    try {
      localStorage.setItem(mineKey(capsuleId), JSON.stringify(mine.map((m) => ({ ...m, photo: null }))));
    } catch {
      // Blocked storage: the board just won't remember them next visit.
    }
  }
}

/* ----------------------------------------------------------------- cards */

function Avatar({ name, src }: { name: string | null; src: string | null }) {
  return (
    <span className="storyboard-avatar" aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : name ? name.charAt(0).toUpperCase() : ''}
    </span>
  );
}

const STATUS_LABEL: Record<StoryStatus, string> = {
  pending: 'Yours · waiting for review',
  approved: 'Yours · on the storyboard',
  declined: 'Yours · not added to the storyboard',
};

function StoryCard({
  name,
  location,
  photo,
  content,
  status,
}: {
  name: string | null;
  location: string | null;
  photo: string | null;
  content: string;
  /** Set only on the visitor's own stories. */
  status?: StoryStatus;
}) {
  return (
    <article className={`storyboard-card${status ? ' storyboard-card--mine' : ''}`}>
      <header className="storyboard-card-author">
        <Avatar name={name} src={photo} />
        <span className="storyboard-card-byline">
          <span className="storyboard-card-name">{name ?? 'Anonymous'}</span>
          {name && location && <span className="storyboard-card-location">{location}</span>}
        </span>
      </header>
      {status && <p className="storyboard-card-status">{STATUS_LABEL[status]}</p>}
      <p className="storyboard-card-text">{content}</p>
    </article>
  );
}

/* ----------------------------------------------------------------- page */

type Board = { state: 'idle' } | { state: 'loading' } | { state: 'error' } | { state: 'ready'; stories: StoryboardStory[] };

/**
 * A story's storyboard. Figma: [CAMPFIRE]-STORYBOARD.
 *
 * Flow:
 *   1. Arriving here (from "Add to Storyboard") opens the terms dialog at once,
 *      unless this browser already agreed.
 *   2. "I agree" unlocks the form: the story, and optionally a first name, a
 *      city and a photo of yourself.
 *   3. Saving sends it for review. It is NOT public until an admin approves it.
 *   4. Having shared a story opens the board: everyone's approved stories, plus
 *      the visitor's own, marked with where each stands in review.
 *
 * The board gate (step 4) is a browser-side courtesy -- "share before you
 * read" -- not access control: approved stories are public data.
 *
 * Layout: one three-column grid. The form spans the first two columns of the
 * first row, so the first story lands beside it and the rest continue three to
 * a row. The panel scopes `data-theme="dark"` (the frame draws it dark inside a
 * light page); the dialog follows the page theme, as the frame's does.
 */
export function Storyboard({ capsule, onBackToCampfire }: Props) {
  const [agreed, setAgreed] = useState(readAgreed);
  const [dialogOpen, setDialogOpen] = useState(() => OPEN_DIALOG_ON_LOAD || !readAgreed());
  const [mine, setMine] = useState<MyStory[]>(() => readMine(capsule.id));
  const [board, setBoard] = useState<Board>({ state: 'idle' });

  const [draft, setDraft] = useState('');
  const [name, setName] = useState(() => readMine(capsule.id)[0]?.author_name ?? '');
  const [city, setCity] = useState(() => readMine(capsule.id)[0]?.author_location ?? '');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justShared, setJustShared] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Set by "I agree": once the dialog has closed, put the cursor in the story box. */
  const focusStoryOnClose = useRef(false);
  const ids = useId();
  const textareaId = `${ids}-story`;
  const statusId = `${ids}-status`;

  const hasShared = mine.length > 0;

  // A different capsule (same component instance): load that story's state.
  useEffect(() => {
    const stored = readMine(capsule.id);
    setMine(stored);
    setBoard({ state: 'idle' });
    setJustShared(false);
    setHint(null);
  }, [capsule.id]);

  // The board opens once the visitor has shared something for this story.
  const loadBoard = useCallback(() => {
    let cancelled = false;
    setBoard({ state: 'loading' });
    fetchStoryboard(capsule.id)
      .then((res) => { if (!cancelled) setBoard({ state: 'ready', stories: res.stories }); })
      .catch(() => { if (!cancelled) setBoard({ state: 'error' }); });
    return () => { cancelled = true; };
  }, [capsule.id]);

  useEffect(() => {
    if (!hasShared) return;
    return loadBoard();
  }, [hasShared, loadBoard]);

  // Ask the server where each of the visitor's pending stories stands, once.
  useEffect(() => {
    const pending = readMine(capsule.id).filter((m) => m.status === 'pending');
    if (pending.length === 0) return;
    let cancelled = false;
    Promise.all(pending.map((m) => fetchOwnStoryStatus(m.id, m.token).then((s) => [m.id, s] as const)))
      .then((results) => {
        if (cancelled) return;
        const next = new Map(results.filter(([, s]) => s !== null) as [number, StoryStatus][]);
        if (next.size === 0) return;
        setMine((prev) => {
          const updated = prev.map((m) => (next.has(m.id) ? { ...m, status: next.get(m.id)! } : m));
          writeMine(capsule.id, updated);
          return updated;
        });
      });
    return () => { cancelled = true; };
  }, [capsule.id]);

  // The native <dialog> does the modal work: centred on screen, the page
  // behind made inert, focus moved in and kept there, Escape to close.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialogOpen && !dialog.open) dialog.showModal();
    if (!dialogOpen && dialog.open) dialog.close();
  }, [dialogOpen]);

  const handleAgree = () => {
    writeAgreed();
    setAgreed(true);
    focusStoryOnClose.current = true;
    setDialogOpen(false);
  };

  const handlePhoto = async (file: File | undefined) => {
    setPhotoError(null);
    if (!file) return;
    try {
      setPhoto(await shrinkPhoto(file));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'That photo couldn’t be used.');
    } finally {
      // Let the same file be picked again after "Remove".
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async () => {
    const content = draft.trim();
    if (!content) {
      setHint('Write a few words first, then save.');
      textareaRef.current?.focus();
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    setHint(null);
    try {
      const authorName = name.trim() || undefined;
      const authorCity = city.trim() || undefined;
      const receipt = await submitStory({
        capsule_id: capsule.id,
        content,
        author_name: authorName,
        author_location: authorCity,
        consent_to_share: true,
        photo: photo ?? undefined,
      });
      const entry: MyStory = {
        id: receipt.id,
        token: receipt.token,
        content,
        author_name: authorName ?? null,
        author_location: authorName ? authorCity ?? null : null,
        photo,
        created_at: receipt.created_at,
        status: receipt.status,
      };
      const updated = [entry, ...mine];
      writeMine(capsule.id, updated);
      setMine(updated);
      setDraft('');
      setPhoto(null);
      // A first share opens the board (the effect above loads it). A later one
      // changes nothing public -- the new story is pending -- so no reload.
      setJustShared(true);
    } catch (err) {
      setHint(`${err instanceof Error ? err.message : 'Could not share your story.'} Your words are still here — please try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  // The visitor's own approved stories come back from the server too; show
  // each story once, as theirs.
  const myIds = new Set(mine.map((m) => m.id));
  const others = board.state === 'ready' ? board.stories.filter((s) => !myIds.has(s.id)) : [];

  return (
    <div className="storyboard">
      <button type="button" className="storyboard-crumb" onClick={onBackToCampfire}>
        The Campfire
      </button>

      <section className="storyboard-panel" data-theme="dark">
        <h1 className="storyboard-heading">
          <label htmlFor={textareaId}>Share about your experience</label>
        </h1>
        <div className="storyboard-grid">
          <div className="storyboard-form">
            {agreed && (
              <div className="storyboard-identity">
                <div className="storyboard-photo">
                  <Avatar name={name.trim() || null} src={photo} />
                  <div className="storyboard-photo-actions">
                    <button type="button" className="storyboard-link-btn" onClick={() => fileRef.current?.click()}>
                      {photo ? 'Change photo' : 'Add a photo of yourself'}
                    </button>
                    {photo && (
                      <button type="button" className="storyboard-link-btn" onClick={() => setPhoto(null)}>
                        Remove
                      </button>
                    )}
                    <span className="storyboard-optional">Optional</span>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="storyboard-file"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(e) => void handlePhoto(e.target.files?.[0])}
                  />
                </div>
                <div className="storyboard-fields">
                  <input
                    className="storyboard-input"
                    type="text"
                    placeholder="First name (optional)"
                    aria-label="First name (optional)"
                    autoComplete="given-name"
                    maxLength={60}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <input
                    className="storyboard-input"
                    type="text"
                    placeholder="City (optional)"
                    aria-label="City (optional)"
                    autoComplete="address-level2"
                    maxLength={80}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                {photoError && <p className="storyboard-photo-error" role="alert">{photoError}</p>}
              </div>
            )}

            <textarea
              id={textareaId}
              ref={textareaRef}
              className="storyboard-textarea"
              placeholder={agreed ? 'Take your time...' : 'Agree to the storyboard terms to add your story.'}
              value={draft}
              maxLength={MAX_STORY_LENGTH}
              disabled={!agreed}
              aria-describedby={statusId}
              onChange={(e) => {
                setDraft(e.target.value);
                if (hint) setHint(null);
                if (justShared) setJustShared(false);
              }}
            />
            <div className="storyboard-form-actions">
              {agreed ? (
                <button
                  type="button"
                  className="storyboard-save"
                  onClick={() => void handleSave()}
                  disabled={submitting}
                  aria-busy={submitting || undefined}
                >
                  {submitting ? 'Saving…' : 'Save'}
                </button>
              ) : (
                <button type="button" className="storyboard-save" onClick={() => setDialogOpen(true)}>
                  Add your story
                </button>
              )}
              <p className="storyboard-status" role="status" id={statusId}>
                {hint}
                {!hint && justShared && 'Thank you. Your story is with our team for review — it will join the storyboard once approved.'}
              </p>
            </div>
          </div>

          {!hasShared && (
            <div className="storyboard-note">
              <p>Share your story to see what others have shared.</p>
              <p>Every story is reviewed before it appears here.</p>
            </div>
          )}

          {mine.map((m) => (
            <StoryCard
              key={`mine-${m.id}`}
              name={m.author_name}
              location={m.author_location}
              photo={m.photo}
              content={m.content}
              status={m.status}
            />
          ))}

          {hasShared && board.state === 'loading' && (
            <p className="storyboard-note storyboard-note-quiet">Loading stories&hellip;</p>
          )}
          {hasShared && board.state === 'error' && (
            <p className="storyboard-note">Other stories could not be loaded. Please try again later.</p>
          )}
          {hasShared && board.state === 'ready' && others.length === 0 && (
            <p className="storyboard-note">No one else&rsquo;s story is on this storyboard yet.</p>
          )}
          {others.map((s) => (
            <StoryCard
              key={s.id}
              name={s.author_name}
              location={s.author_location}
              photo={s.photo_url ? storyPhotoSrc(s.photo_url) : null}
              content={s.content}
            />
          ))}
        </div>
      </section>

      {/* Terms. Agreeing is required to post: every story here may be shown
          publicly once approved. Closing it (Escape, "Not now") leaves the
          form locked behind "Add your story". */}
      <dialog
        ref={dialogRef}
        className="storyboard-dialog"
        aria-labelledby={`${ids}-dialog-title`}
        aria-describedby={`${ids}-dialog-body`}
        onClose={() => {
          setDialogOpen(false);
          // The dialog hands focus back to whatever opened it when it closes;
          // after "I agree" the useful place is the now-enabled story box.
          if (focusStoryOnClose.current) {
            focusStoryOnClose.current = false;
            requestAnimationFrame(() => textareaRef.current?.focus());
          }
        }}
      >
        <h2 id={`${ids}-dialog-title`} className="storyboard-modal-label">Add to Storyboard</h2>
        <p id={`${ids}-dialog-body`} className="storyboard-modal-body">
          Share how this story moved you, and see how our stories are shaping a greater one.
        </p>
        <ul className="storyboard-terms">
          <li>Your story &mdash; and your first name, city and photo, if you add them &mdash; may be shown publicly on this storyboard.</li>
          <li>Every story is reviewed by the LGN team before it appears. We may decline any submission.</li>
          <li>Please only share your own experience, and only upload a photo of yourself.</li>
          <li>Want something taken down later? Contact us and we&rsquo;ll remove it.</li>
        </ul>
        <div className="storyboard-dialog-actions">
          <button type="button" className="storyboard-modal-submit" onClick={handleAgree} autoFocus>
            I agree
          </button>
          <button type="button" className="storyboard-link-btn storyboard-link-btn--muted" onClick={() => setDialogOpen(false)}>
            Not now
          </button>
        </div>
      </dialog>
    </div>
  );
}
