import { useState, type FormEvent } from 'react';
import './FilmmakersPage.css';
import { API_URL } from '../../api';
import type { CapsuleSummary } from '../../types';
import { FilmPicker, type PickedFilm } from '../forms/FilmPicker';

interface Props {
  /** Published stories, for the film search. */
  films: CapsuleSummary[];
}

type Role = 'director' | 'writer' | 'producer' | 'cast-crew';
const ROLES: { key: Role; label: string }[] = [
  { key: 'director', label: 'Director' },
  { key: 'writer', label: 'Writer' },
  { key: 'producer', label: 'Producer' },
  { key: 'cast-crew', label: 'Cast or crew' },
];

type Send = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string };

/**
 * For Filmmakers. Figma "FOR FILMMAKERS" (director, writer or producer) and
 * "—CAST/CREW": on the left, how LGN Presents films are chosen and a photo;
 * on the right, a request to claim a film's guide. The form changes with the
 * role: makers send a link to their work on the film; cast and crew share
 * what they remember. Requests go to the admin's Filmmaker requests.
 */
export function FilmmakersPage({ films }: Props) {
  const [film, setFilm] = useState<PickedFilm | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [send, setSend] = useState<Send>({ kind: 'idle' });
  const castCrew = role === 'cast-crew';

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (!film) return setSend({ kind: 'error', message: 'Identify the film you contributed to.' });
    if (!role) return setSend({ kind: 'error', message: 'Choose your role in this film.' });
    setSend({ kind: 'sending' });
    try {
      const res = await fetch(`${API_URL}/api/submissions/filmmaker-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          film_title: film.title,
          film_year: film.year || null,
          capsule_id: film.capsuleId ?? null,
          role,
          name: String(data.get('name') ?? ''),
          email: String(data.get('email') ?? ''),
          work_link: String(data.get('work_link') ?? '') || null,
          message: String(data.get('message') ?? '') || null,
          website: String(data.get('website') ?? ''),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = typeof body?.detail === 'string' ? body.detail : 'Check the required fields and try again.';
        throw new Error(detail);
      }
      setSend({ kind: 'sent' });
    } catch (err) {
      setSend({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    }
  };

  return (
    <div className="filmmakers">
      <aside className="filmmakers-side">
        <h1 className="filmmakers-title">
          For
          <br />
          Filmmakers
        </h1>
        <div className="filmmakers-side-text">
          <p>LGN Presents is chosen by our team, and we aren’t taking formal submissions yet.</p>
          <p>
            If you’d like us to know about your short film, email{' '}
            <a className="rich-link" href="mailto:films@lgncinema.org">films@lgncinema.org</a>.
          </p>
          <p>We watch what we can, though we can’t promise a reply to everyone.</p>
        </div>
        <img className="filmmakers-photo" src="/images/for-filmmakers.jpg" alt="" />
      </aside>

      <div className="filmmakers-main">
        <p className="filmmakers-intro">
          Every film in the Library has a guide for reflection and practice. If you made one of these films, we would
          love for you to claim its guide and shape it with us. A guide shaped with its makers is the truest one we can
          offer.
        </p>

        {send.kind === 'sent' ? (
          <section className="filmmakers-section">
            <h2 className="filmmakers-heading">Thank you</h2>
            <p className="form-prompt">
              We’ve received your request for {film?.title}. We confirm every request before anything changes, usually by
              reaching out through a public contact for you or the film.
            </p>
          </section>
        ) : (
          <form onSubmit={(e) => void submit(e)} noValidate>
            <section className="filmmakers-section">
              <h2 className="filmmakers-heading">Film</h2>
              <p className="form-prompt">*Identify the film you contributed to.</p>
              {film ? (
                <div className="form-chips">
                  <button type="button" className="lgn-chip is-on" onClick={() => setFilm(null)} aria-label={`Remove ${film.title}`}>
                    {film.title}
                    {film.year ? ` (${film.year})` : ''} [x]
                  </button>
                </div>
              ) : (
                <FilmPicker films={films} onPick={setFilm} />
              )}
            </section>

            <section className="filmmakers-section">
              <h2 className="filmmakers-heading">Your Role</h2>
              <p className="form-prompt">
                *Specify your role in this film. If you had more than one role, choose the first one that applies.
              </p>
              <div className="form-chips" role="radiogroup" aria-label="Your role">
                {ROLES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    role="radio"
                    aria-checked={role === r.key}
                    className={`lgn-chip${role === r.key ? ' is-on' : ''}`}
                    onClick={() => setRole(role === r.key ? null : r.key)}
                  >
                    {r.label}
                    {role === r.key ? ' [x]' : ''}
                  </button>
                ))}
              </div>
            </section>

            {role && (
              <section className="filmmakers-section filmmakers-section--info">
                {castCrew ? (
                  <p className="filmmakers-note">
                    Thank you for your work on this film. Guides are shaped with the director, writer, or producer, but
                    we’d love your view of how it was made. Share what you remember, and we’ll consider adding it to the
                    guide.
                  </p>
                ) : (
                  <h2 className="filmmakers-heading">Information</h2>
                )}
                <p className="form-prompt">*Contact Information</p>
                <div className="form-row">
                  <input className="lgn-field lgn-field--quiet" name="name" placeholder="Name" aria-label="Name" autoComplete="name" required />
                  <input
                    className="lgn-field lgn-field--quiet"
                    name="email"
                    type="email"
                    placeholder="Email"
                    aria-label="Email"
                    autoComplete="email"
                    required
                  />
                </div>
                {castCrew ? (
                  <>
                    <p className="form-prompt filmmakers-gap">*What would you like to share?</p>
                    <textarea
                      className="lgn-field lgn-field--quiet"
                      name="message"
                      rows={5}
                      placeholder="What you remember about how it was made"
                      aria-label="What would you like to share?"
                      required
                    />
                  </>
                ) : (
                  <>
                    <p className="form-prompt filmmakers-gap">*A link to your work on the film</p>
                    <input
                      className="lgn-field lgn-field--quiet filmmakers-link"
                      name="work_link"
                      type="url"
                      placeholder="Website, IMDb, a festival page"
                      aria-label="A link to your work on the film"
                      required
                    />
                    <p className="filmmakers-confirm">
                      We confirm every request before anything changes, usually by reaching out through a public contact
                      for you or the film.
                    </p>
                  </>
                )}
                {/* Bot trap: hidden from people, filled in by bots. */}
                <div aria-hidden="true" className="form-trap">
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </div>
              </section>
            )}

            {send.kind === 'error' && (
              <p className="form-error" role="alert">
                {send.message}
              </p>
            )}
            <button type="submit" className="lgn-btn filmmakers-send" disabled={send.kind === 'sending'}>
              {send.kind === 'sending' ? 'Sending…' : castCrew ? 'Send' : 'Send request'}
            </button>
            <p className="lgn-label form-required">*Required field</p>
          </form>
        )}
      </div>
    </div>
  );
}
