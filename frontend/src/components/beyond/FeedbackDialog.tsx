import { useEffect, useState, type FormEvent } from 'react';
import './FeedbackDialog.css';
import { LgnDialog } from '../LgnDialog';
import type { Dimension } from '../../types';
import { sendFilmFeedback, type PromptKind } from './beyond';

export type FeedbackMode = 'suggestion' | 'something_off' | 'not_found';

interface Props {
  open: boolean;
  onClose: () => void;
  mode: FeedbackMode;
  /** The film on screen (suggestion / something off). */
  film?: { tmdb_id: number; title: string };
  /** For a suggestion: which part of the page they were on. */
  kind?: PromptKind;
  /** For "can't find it": what they had typed in the search box. */
  typed?: string;
}

const COPY: Record<FeedbackMode, { label: string; lead: string; field: string; placeholder: string; done: string }> = {
  suggestion: {
    label: 'Suggest a question',
    lead: 'Suggest a question or action, or tell us what these questions missed. Our team reads every note. Nothing you send here is published, or shared with anyone.',
    field: 'Your suggestion',
    placeholder: 'A question you wish we asked, or what felt missing…',
    done: 'Thank you. Our team will read it.',
  },
  something_off: {
    label: 'Something off',
    lead: 'Is something wrong with this film’s details, or with how it’s shown here? Tell us and we’ll look.',
    field: 'What’s off?',
    placeholder: 'Wrong film, wrong year, a question that doesn’t fit…',
    done: 'Thank you. We’ll take a look.',
  },
  not_found: {
    label: 'Can’t find it?',
    lead: 'Tell us which film you were looking for and we’ll look into adding it.',
    field: 'Anything else we should know?',
    placeholder: 'Optional',
    done: 'Thank you. We’ll look for it.',
  },
};

/**
 * One small form for everything a visitor can tell LGN about a film. It posts
 * to the admin inbox only: never to the AI, never shown to other visitors.
 */
export function FeedbackDialog({ open, onClose, mode, film, kind, typed }: Props) {
  const copy = COPY[mode];
  const [message, setMessage] = useState('');
  const [circle, setCircle] = useState<'' | Dimension>('');
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [email, setEmail] = useState('');
  const [trap, setTrap] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  // A fresh form each time it opens.
  useEffect(() => {
    if (!open) return;
    setMessage('');
    setCircle('');
    setTitle(typed ?? '');
    setYear('');
    setEmail('');
    setTrap('');
    setState('idle');
    setError('');
  }, [open, mode, typed]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('sending');
    try {
      await sendFilmFeedback({
        type: mode,
        tmdb_id: film?.tmdb_id,
        film_title: mode === 'not_found' ? title.trim() : film?.title,
        kind: mode === 'suggestion' ? kind : undefined,
        dimension: mode === 'suggestion' && circle ? circle : undefined,
        message: mode === 'suggestion' ? undefined : message.trim() || undefined,
        suggested_text: mode === 'suggestion' ? message.trim() : undefined,
        film_year_typed: mode === 'not_found' ? year.trim() || undefined : undefined,
        email: email.trim() || undefined,
        website: trap,
      });
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That didn’t send. Please try again.');
      setState('error');
    }
  };

  return (
    <LgnDialog open={open} onClose={onClose} label={copy.label} className="feedback-dialog">
      {state === 'done' ? (
        <div className="feedback-body">
          <p role="status">{copy.done}</p>
          <button type="button" className="lgn-btn" onClick={onClose}>Close</button>
        </div>
      ) : (
        <form className="feedback-body" onSubmit={(e) => void submit(e)}>
          <p>{copy.lead}</p>

          {mode === 'not_found' && (
            <div className="feedback-row">
              <label className="feedback-field">
                <span className="lgn-label">Film title</span>
                <input className="lgn-field" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={300} />
              </label>
              <label className="feedback-field feedback-field--year">
                <span className="lgn-label">Year</span>
                <input className="lgn-field" value={year} onChange={(e) => setYear(e.target.value)} maxLength={16} inputMode="numeric" />
              </label>
            </div>
          )}

          <label className="feedback-field">
            <span className="lgn-label">{copy.field}</span>
            <textarea
              className="lgn-field lgn-field--quiet feedback-text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={copy.placeholder}
              required={mode !== 'not_found'}
              maxLength={2000}
            />
          </label>

          {mode === 'suggestion' && (
            <label className="feedback-field">
              <span className="lgn-label">Which circle? (optional)</span>
              <select className="lgn-field" value={circle} onChange={(e) => setCircle(e.target.value as '' | Dimension)}>
                <option value="">Not sure</option>
                <option value="self">Self</option>
                <option value="neighbor">Neighbor</option>
                <option value="world">World</option>
              </select>
            </label>
          )}

          <label className="feedback-field">
            <span className="lgn-label">Email, if you’d like a reply (optional)</span>
            <input className="lgn-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} />
          </label>

          {/* Bot trap: real visitors never see or fill this. */}
          <div aria-hidden="true" className="feedback-trap">
            <input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
          </div>

          <div className="feedback-actions">
            <button type="submit" className="lgn-btn" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Send'}
            </button>
            {state === 'error' && <span className="feedback-error" role="alert">{error}</span>}
          </div>
        </form>
      )}
    </LgnDialog>
  );
}
