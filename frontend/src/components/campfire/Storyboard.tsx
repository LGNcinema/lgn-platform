import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import './Storyboard.css';
import type { CapsuleDetail } from '../../types';
import { fetchStoryboard, submitStory, type StoryboardResponse, type StoryboardStory } from './campfire';

interface Props {
  capsule: CapsuleDetail;
  storyNumber: number;
  onBackToCampfire: () => void;
}

/** The backend's limit on a story's length (StoryboardSubmissionCreate). */
const MAX_STORY_LENGTH = 5000;

/** Read once, like App's other QA params: `?modal=1` opens the consent modal
 *  on load, which is the state the Figma frame shows. */
const OPEN_MODAL_ON_LOAD = (() => {
  const value = new URLSearchParams(window.location.search).get('modal');
  return value === '1' || value === 'true';
})();

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

type Load =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; board: StoryboardResponse };

/** What the last submission did, for the confirmation under the form. The two
 *  outcomes are worded differently because they ARE different: only a
 *  consented story can ever be published. */
type Sent = 'shared' | 'private' | null;

/** `reveals_at` is naive UTC and always the first instant of a month, so it is
 *  formatted in UTC -- in a US time zone the local rendering would name the
 *  last day of the story's own month. */
function formatRevealDate(revealsAt: string | null): string | null {
  if (!revealsAt) return null;
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(revealsAt) ? revealsAt : `${revealsAt}Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
}

function StoryCard({ story }: { story: StoryboardStory }) {
  const name = story.author_name?.trim() || null;
  return (
    <article className="storyboard-card">
      <header className="storyboard-card-author">
        {/* No photos exist for authors; the circle is the frame's avatar
            placeholder. It carries the name's initial, or stays blank for an
            anonymous author rather than inventing a letter. */}
        <span className="storyboard-avatar" aria-hidden="true">
          {name ? name.charAt(0).toUpperCase() : ''}
        </span>
        <span className="storyboard-card-byline">
          <span className="storyboard-card-name">{name ?? 'Anonymous'}</span>
          {name && story.author_location && (
            <span className="storyboard-card-location">{story.author_location}</span>
          )}
        </span>
      </header>
      <p className="storyboard-card-text">{story.content}</p>
    </article>
  );
}

/** A story's storyboard: add your story (with explicit consent), and -- once
 *  the story's month has ended -- the stories others agreed to share.
 *  Figma: [CAMPFIRE]-STORYBOARD.
 *
 *  Layout: one three-column grid. The form spans the first two columns of the
 *  first row, so the first story lands beside it and the rest continue three to
 *  a row -- the frame's "one beside the form, three below" with no special
 *  case for the first four.
 *
 *  The frame draws the panel in the dark palette inside an otherwise light
 *  page, so the panel scopes `data-theme="dark"` and its tokens resolve to the
 *  dark values (#242424 panel, black cards, #454545 avatars). The modal sits
 *  outside that scope and follows the page theme, as the frame's light modal
 *  does. */
export function Storyboard({ capsule, onBackToCampfire }: Props) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [draft, setDraft] = useState('');
  const [draftHint, setDraftHint] = useState(false);
  const [modalOpen, setModalOpen] = useState(OPEN_MODAL_ON_LOAD);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const ids = useId();
  const textareaId = `${ids}-story`;
  const modalTitleId = `${ids}-modal-title`;
  const modalDescId = `${ids}-modal-desc`;
  const consentId = `${ids}-consent`;
  const consentNoteId = `${ids}-consent-note`;

  useEffect(() => {
    let cancelled = false;
    setLoad({ state: 'loading' });
    fetchStoryboard(capsule.id)
      .then((board) => { if (!cancelled) setLoad({ state: 'ready', board }); })
      .catch(() => { if (!cancelled) setLoad({ state: 'error' }); });
    return () => { cancelled = true; };
  }, [capsule.id]);

  const closeModal = useCallback(() => {
    if (submitting) return; // don't strand a request whose outcome we'd never show
    setModalOpen(false);
    setSubmitError(null);
    // Focus goes back to what opened the modal. requestAnimationFrame because
    // the panel is still `inert` until this render commits.
    requestAnimationFrame(() => saveRef.current?.focus());
  }, [submitting]);

  // Focus moves into the modal on open -- to the consent checkbox, the one
  // decision the modal exists to ask for.
  useEffect(() => {
    if (!modalOpen) return;
    const first = modalRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
  }, [modalOpen]);

  const handleSave = () => {
    if (!draft.trim()) {
      // Save stays enabled (the frame shows it live over an empty textarea);
      // an empty story just gets a nudge instead of a modal.
      setDraftHint(true);
      textareaRef.current?.focus();
      return;
    }
    setSent(null);
    setSubmitError(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const content = draft.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // The frame has no name field, so every story is anonymous for now.
      await submitStory({ capsule_id: capsule.id, content, consent_to_share: consent, is_anonymous: true });
      setSent(consent ? 'shared' : 'private');
      setDraft('');
      setConsent(false);
      setModalOpen(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not share your story.');
    } finally {
      setSubmitting(false);
    }
  };

  // Escape closes; Tab is kept inside the modal. The rest of the panel is
  // `inert` while the modal is open, but the site header and footer are outside
  // this component, so the wrap is what actually keeps focus in.
  const handleModalKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeModal();
      return;
    }
    if (e.key !== 'Tab' || !modalRef.current) return;
    const focusable = [...modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const board = load.state === 'ready' ? load.board : null;
  const revealDate = board ? formatRevealDate(board.reveals_at) : null;

  return (
    <div className="storyboard">
      <button type="button" className="storyboard-crumb" onClick={onBackToCampfire}>
        The Campfire
      </button>

      <div className="storyboard-stage">
        <section className="storyboard-panel" data-theme="dark" inert={modalOpen}>
          {/* The heading is the textarea's label. It sits above the grid, not
              inside the form's column, because the first story card starts
              level with the textarea, below the heading. */}
          <h1 className="storyboard-heading">
            <label htmlFor={textareaId}>Share about your experience</label>
          </h1>
          <div className="storyboard-grid">
            <div className="storyboard-form">
              <textarea
                id={textareaId}
                ref={textareaRef}
                className="storyboard-textarea"
                placeholder="Take your time..."
                value={draft}
                maxLength={MAX_STORY_LENGTH}
                aria-describedby={draftHint ? `${textareaId}-hint` : undefined}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (draftHint) setDraftHint(false);
                  if (sent) setSent(null);
                }}
              />
              <div className="storyboard-form-actions">
                <button type="button" ref={saveRef} className="storyboard-save" onClick={handleSave}>
                  Save
                </button>
                {/* One live region for both the empty-draft nudge and the
                    confirmation, so a screen reader hears whichever applies. */}
                <p className="storyboard-status" role="status" id={`${textareaId}-hint`}>
                  {draftHint && 'Write a few words first, then save.'}
                  {sent === 'shared' && 'Thank you. Your story will join the storyboard once it has been reviewed.'}
                  {sent === 'private' && 'Thank you. Your story has been kept privately and will not be shown publicly.'}
                </p>
              </div>
            </div>

            {load.state === 'loading' && <p className="storyboard-note storyboard-note-quiet">Loading stories…</p>}

            {load.state === 'error' && (
              <p className="storyboard-note">The storyboard could not be loaded. Please try again later.</p>
            )}

            {board && !board.revealed && (
              <div className="storyboard-note">
                <p>
                  This storyboard opens at month&rsquo;s end
                  {revealDate ? <>, on <time dateTime={board.reveals_at ?? undefined}>{revealDate}</time>.</> : '.'}
                </p>
                <p>Until then, the stories people share stay sealed.</p>
              </div>
            )}

            {board?.revealed && board.stories.length === 0 && (
              <p className="storyboard-note">No stories have been shared on this storyboard yet.</p>
            )}

            {board?.revealed && board.stories.map((story) => <StoryCard key={story.id} story={story} />)}
          </div>
        </section>

        {modalOpen && (
          <>
            <div className="storyboard-scrim" onClick={closeModal} aria-hidden="true" />
            <div
              ref={modalRef}
              className="storyboard-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby={modalTitleId}
              aria-describedby={modalDescId}
              onKeyDown={handleModalKeyDown}
            >
              <h2 id={modalTitleId} className="storyboard-modal-label">Add to Storyboard</h2>
              <p id={modalDescId} className="storyboard-modal-body">
                Share how this story moved you. At month&rsquo;s end, we&rsquo;ll see how our stories are shaping a greater one.
              </p>
              <div className="storyboard-consent">
                <input
                  id={consentId}
                  type="checkbox"
                  className="storyboard-consent-box"
                  checked={consent}
                  aria-describedby={consentNoteId}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <label htmlFor={consentId}>I consent to letting my response be shared on our public forum...</label>
              </div>
              {/* The button works either way; this line says what each choice
                  means, so "Share" never implies publication by itself. */}
              <p id={consentNoteId} className="storyboard-consent-note">
                {consent
                  ? 'Shared stories are reviewed before they appear.'
                  : 'Without consent, your story stays private.'}
              </p>
              {submitError && (
                <p className="storyboard-modal-error" role="alert">{submitError} Your words are still here — please try again.</p>
              )}
              <button
                type="button"
                className="storyboard-modal-submit"
                onClick={handleSubmit}
                disabled={submitting}
                aria-busy={submitting || undefined}
              >
                {submitting ? 'Sharing…' : 'Share your Experience'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
