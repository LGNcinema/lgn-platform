import { useEffect, useId, useMemo, useRef, useState } from 'react';
import './Storyboard.css';
import type { CapsuleDetail, CapsuleSummary, Dimension } from '../../types';
import { LgnDialog } from '../LgnDialog';
import { subscribeEmail } from '../chrome/mailchimp';
import {
  DIMENSIONS,
  fetchOwnStoryStatus,
  fetchStoryboard,
  shrinkPhoto,
  storiesInOrder,
  storyPhotoSrc,
  submitStory,
  type StoryboardStory,
  type StoryStatus,
} from './campfire';

interface Props {
  /** The film the visitor came from: the form's film to start with. */
  capsule: CapsuleDetail;
  /** Every published film. The board gathers stories from all of them. */
  films: CapsuleSummary[];
  /** "Watch with us": open a film's page. */
  onOpenFilm: (capsuleId: number) => void;
}

/** The form's limit ("UP TO 500 WORDS"); the server's own cap is 5,000 characters. */
const MAX_WORDS = 500;
const MAX_STORY_LENGTH = 5000;
/** One row of cards per month, paged. Figma: three cards and "1 2 3 >". */
const PAGE_SIZE = 3;

/** `?modal=1` opens the form on load (QA). */
const OPEN_FORM_ON_LOAD = (() => {
  const value = new URLSearchParams(window.location.search).get('modal');
  return value === '1' || value === 'true';
})();

/* --------------------------------------------------------------- storage
 * Per browser -- there are no visitor accounts. mineKey holds the stories
 * this browser submitted for one film, with the token that lets it ask the
 * server whether each was approved. Every access is wrapped: storage throws
 * outright in some privacy modes, and none of this may take the page down.
 * --------------------------------------------------------------------- */

const mineKey = (capsuleId: number) => `campfire_storyboard_mine_${capsuleId}`;

interface MyStory {
  id: number;
  token: string;
  content: string;
  author_name: string | null;
  author_location: string | null;
  /** The shrunk JPEG data URL, so the visitor sees their photo while pending. */
  photo: string | null;
  created_at: string | null;
  status: StoryStatus;
  /** Removed from their own view (a declined story). */
  dismissed?: boolean;
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

/* ----------------------------------------------------------------- data */

/** A story on the board, from any film, the visitor's own included. */
interface BoardStory {
  key: string;
  id: number;
  capsuleId: number;
  filmTitle: string;
  content: string;
  author_name: string | null;
  author_location: string | null;
  photo: string | null;
  created_at: string | null;
  dimension: Dimension | null;
  /** Set on the visitor's own stories only. */
  status?: StoryStatus;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 'YYYY-MM' of a story's date (local time), or '' when it has none. */
function monthOf(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return y && m ? `${MONTHS[m - 1]} ${y}` : 'Earlier';
}

/** "02.15.2027" */
function dotDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}.${d.getFullYear()}`;
}

/** "HANA, IRVINE" / "ANONYMOUS" (set in caps by CSS). */
function byline(s: Pick<BoardStory, 'author_name' | 'author_location'>): string {
  if (!s.author_name) return 'Anonymous';
  return s.author_location ? `${s.author_name}, ${s.author_location}` : s.author_name;
}

function tagLine(s: BoardStory): string {
  const dim = DIMENSIONS.find((d) => d.key === s.dimension)?.label;
  return dim ? `${s.filmTitle}, ${dim}` : s.filmTitle;
}

const STATUS_LABEL: Record<StoryStatus, string> = {
  pending: 'Yours · waiting for review',
  approved: 'Yours · on the storyboard',
  declined: 'Yours · not added to the storyboard',
};

const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** "Hana, Irvine" -> name "Hana", city "Irvine". The frame asks for both in one
 *  field; the server keeps them apart. */
function splitNameCity(value: string): { name?: string; city?: string } {
  const [name, ...rest] = value.split(',');
  const city = rest.join(',').trim();
  return { name: name.trim() || undefined, city: city || undefined };
}

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; stories: BoardStory[] };

/* ----------------------------------------------------------------- page */

/**
 * The Storyboard. Figma v3: "Storyboard", "Storyboard—add",
 * "Storyboard—read".
 *
 * Everyone's approved stories, from every film, newest month first, a row
 * of three per month. Filters: a film search, Self / Neighbor / World, and
 * the sort. A card opens the story in a side panel; "Add to the Storyboard"
 * opens the form. Every story waits for the LGN team's approval before it
 * appears; the visitor's own show in the meantime, marked with where they
 * stand.
 */
export function Storyboard({ capsule, films, onOpenFilm }: Props) {
  const ordered = useMemo(() => storiesInOrder(films), [films]);
  const filmIds = ordered.map((f) => f.id).join(',');
  const titleOf = useMemo(() => new Map(ordered.map((f) => [f.id, f.title])), [ordered]);

  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [mine, setMine] = useState<Record<number, MyStory[]>>({});
  const [query, setQuery] = useState('');
  const [dimension, setDimension] = useState<Dimension | 'all'>('all');
  const [newestFirst, setNewestFirst] = useState(true);
  const [pages, setPages] = useState<Record<string, number>>({});
  const [reading, setReading] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(OPEN_FORM_ON_LOAD);
  const [formFilm, setFormFilm] = useState(capsule.id);
  const [thanks, setThanks] = useState(false);

  // Everyone's approved stories, for every film.
  useEffect(() => {
    let cancelled = false;
    const ids = filmIds ? filmIds.split(',').map(Number) : [];
    setLoad({ state: 'loading' });
    Promise.allSettled(ids.map((id) => fetchStoryboard(id)))
      .then((results) => {
        if (cancelled) return;
        if (results.length > 0 && results.every((r) => r.status === 'rejected')) {
          setLoad({ state: 'error' });
          return;
        }
        const stories = results.flatMap((r) =>
          r.status === 'fulfilled'
            ? r.value.stories.map((s: StoryboardStory & { dimension?: Dimension | null }) => ({
                key: `s-${s.id}`,
                id: s.id,
                capsuleId: r.value.capsule_id,
                filmTitle: titleOf.get(r.value.capsule_id) ?? '',
                content: s.content,
                author_name: s.author_name,
                author_location: s.author_location,
                photo: s.photo_url ? storyPhotoSrc(s.photo_url) : null,
                created_at: s.created_at,
                dimension: s.dimension ?? null,
              }))
            : [],
        );
        setLoad({ state: 'ready', stories });
      });
    return () => {
      cancelled = true;
    };
  }, [filmIds, titleOf]);

  // The visitor's own stories, and where each pending one stands now.
  useEffect(() => {
    const ids = filmIds ? filmIds.split(',').map(Number) : [];
    const stored = Object.fromEntries(ids.map((id) => [id, readMine(id)]));
    setMine(stored);
    let cancelled = false;
    for (const id of ids) {
      const pending = stored[id].filter((m) => m.status === 'pending');
      if (pending.length === 0) continue;
      Promise.all(pending.map((m) => fetchOwnStoryStatus(m.id, m.token).then((s) => [m.id, s] as const))).then(
        (results) => {
          if (cancelled) return;
          const next = new Map(results.filter(([, s]) => s !== null) as [number, StoryStatus][]);
          if (next.size === 0) return;
          setMine((prev) => {
            const updated = (prev[id] ?? []).map((m) => (next.has(m.id) ? { ...m, status: next.get(m.id)! } : m));
            writeMine(id, updated);
            return { ...prev, [id]: updated };
          });
        },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [filmIds]);

  const removeMine = (capsuleId: number, id: number) => {
    setMine((prev) => {
      const updated = (prev[capsuleId] ?? []).map((m) => (m.id === id ? { ...m, dismissed: true } : m));
      writeMine(capsuleId, updated);
      return { ...prev, [capsuleId]: updated };
    });
  };

  // Approved stories plus the visitor's own (each once: an approved one of
  // theirs comes back from the server too, and shows as theirs).
  const all: BoardStory[] = useMemo(() => {
    const own = Object.entries(mine).flatMap(([capsuleId, list]) =>
      list
        .filter((m) => !m.dismissed)
        .map<BoardStory>((m) => ({
          key: `m-${m.id}`,
          id: m.id,
          capsuleId: Number(capsuleId),
          filmTitle: titleOf.get(Number(capsuleId)) ?? '',
          content: m.content,
          author_name: m.author_name,
          author_location: m.author_location,
          photo: m.photo,
          created_at: m.created_at,
          dimension: null,
          status: m.status,
        })),
    );
    const ownIds = new Set(own.map((s) => s.id));
    const others = load.state === 'ready' ? load.stories.filter((s) => !ownIds.has(s.id)) : [];
    return [...own, ...others];
  }, [mine, load, titleOf]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((s) => (dimension === 'all' ? true : s.dimension === dimension))
      .filter((s) => (q ? s.filmTitle.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        const ta = a.created_at ?? '';
        const tb = b.created_at ?? '';
        return newestFirst ? tb.localeCompare(ta) : ta.localeCompare(tb);
      });
  }, [all, query, dimension, newestFirst]);

  // Grouped by month, in the sorted order.
  const groups = useMemo(() => {
    const out: { month: string; stories: BoardStory[] }[] = [];
    for (const s of visible) {
      const month = monthOf(s.created_at);
      const last = out[out.length - 1];
      if (last && last.month === month) last.stories.push(s);
      else out.push({ month, stories: [s] });
    }
    return out;
  }, [visible]);

  const readingIndex = reading ? visible.findIndex((s) => s.key === reading) : -1;
  const readingStory = readingIndex >= 0 ? visible[readingIndex] : null;

  const openForm = (filmId: number) => {
    setFormFilm(filmId);
    setThanks(false);
    setReading(null);
    setFormOpen(true);
  };

  return (
    <div className="storyboard">
      <h1 className="storyboard-heading">Storyboard</h1>

      <div className="storyboard-bar">
        <p className="storyboard-tagline">Where our stories shape a larger one</p>
        <input
          className="lgn-field storyboard-search"
          type="search"
          placeholder="Search by Film"
          aria-label="Search by film"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className="lgn-btn storyboard-add" onClick={() => openForm(capsule.id)}>
          Add to the Storyboard
        </button>

        <div className="storyboard-filters" role="group" aria-label="Show">
          {[{ key: 'all' as const, label: 'All' }, ...DIMENSIONS].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`lgn-link${dimension === key ? ' active' : ''}`}
              aria-pressed={dimension === key}
              onClick={() => setDimension(key)}
            >
              {label}
            </button>
          ))}
          <button type="button" className="lgn-link storyboard-sort" onClick={() => setNewestFirst((v) => !v)}>
            {newestFirst ? 'Newest First' : 'Oldest First'}
          </button>
        </div>

        <p className="storyboard-thanks" role="status">
          {thanks && 'Thank you. Your story is with our team for review. It will join the storyboard once approved.'}
        </p>
      </div>

      {load.state === 'loading' && all.length === 0 && <p className="storyboard-note">Loading stories&hellip;</p>}
      {load.state === 'error' && all.length === 0 && (
        <p className="storyboard-note">The stories could not be loaded. Please try again later.</p>
      )}
      {load.state === 'ready' && visible.length === 0 && (
        <p className="storyboard-note">
          {all.length === 0 ? 'No stories yet. Be the first to add one.' : 'No stories match. Try another film or filter.'}
        </p>
      )}

      {groups.map(({ month, stories }) => {
        const pageCount = Math.ceil(stories.length / PAGE_SIZE);
        const page = Math.min(pages[month] ?? 0, pageCount - 1);
        const shown = stories.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
        const setPage = (p: number) => setPages((prev) => ({ ...prev, [month]: p }));
        return (
          <section key={month || 'undated'} className="storyboard-month" aria-label={monthName(month)}>
            <div className="storyboard-month-bar">
              <h2 className="storyboard-month-name">{monthName(month)}</h2>
              {pageCount > 1 && (
                <nav className="storyboard-pager" aria-label={`${monthName(month)} pages`}>
                  {Array.from({ length: pageCount }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`lgn-link${i === page ? ' active' : ''}`}
                      aria-current={i === page ? 'page' : undefined}
                      onClick={() => setPage(i)}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="lgn-link"
                    aria-label="Next page"
                    disabled={page >= pageCount - 1}
                    onClick={() => setPage(page + 1)}
                  >
                    &gt;
                  </button>
                </nav>
              )}
            </div>
            <ul className="storyboard-cards">
              {shown.map((s) => (
                <li key={s.key}>
                  <StoryCard
                    story={s}
                    onOpen={() => setReading(s.key)}
                    onRemove={s.status === 'declined' ? () => removeMine(s.capsuleId, s.id) : undefined}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <StoryReader
        story={readingStory}
        onClose={() => setReading(null)}
        onNext={readingIndex >= 0 && readingIndex < visible.length - 1 ? () => setReading(visible[readingIndex + 1].key) : undefined}
        onPrevious={readingIndex > 0 ? () => setReading(visible[readingIndex - 1].key) : undefined}
        onOpenFilm={onOpenFilm}
        onAdd={(filmId) => openForm(filmId)}
      />

      <AddStoryDialog
        open={formOpen}
        films={ordered}
        initialFilm={formFilm}
        onClose={() => setFormOpen(false)}
        onShared={(filmId, entry) => {
          setMine((prev) => {
            const updated = [entry, ...(prev[filmId] ?? readMine(filmId))];
            writeMine(filmId, updated);
            return { ...prev, [filmId]: updated };
          });
          setFormOpen(false);
          setThanks(true);
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- card */

/** One story. Figma: a 600x309 #EDEDED card -- the story in 36px (clipped
 *  to four lines), the byline and date, then "READ MORE >" and the film. */
function StoryCard({ story, onOpen, onRemove }: { story: BoardStory; onOpen: () => void; onRemove?: () => void }) {
  return (
    <article className={`storyboard-card${story.status ? ' storyboard-card--mine' : ''}`}>
      <p className="storyboard-card-text">{story.content}</p>
      <p className="storyboard-card-byline lgn-label">
        {byline(story)}
        <br />
        {dotDate(story.created_at)}
        {story.status && (
          <>
            <br />
            <span className="storyboard-card-status">{STATUS_LABEL[story.status]}</span>
            {onRemove && (
              <>
                {' · '}
                <button type="button" className="storyboard-card-remove" onClick={onRemove}>
                  Remove
                </button>
              </>
            )}
          </>
        )}
      </p>
      <div className="storyboard-card-foot lgn-label">
        <button type="button" className="storyboard-card-more" onClick={onOpen}>
          Read more &gt;
        </button>
        <span>{tagLine(story)}</span>
      </div>
    </article>
  );
}

/* --------------------------------------------------------------- reader */

/** A story in full, in a panel from the right. Figma: "Storyboard—read". */
function StoryReader({
  story,
  onClose,
  onNext,
  onPrevious,
  onOpenFilm,
  onAdd,
}: {
  story: BoardStory | null;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onOpenFilm: (capsuleId: number) => void;
  onAdd: (capsuleId: number) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = Boolean(story);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="storyboard-reader"
      aria-label="Story"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {story && (
        <div className="storyboard-reader-inner">
          <div className="storyboard-reader-nav">
            <button type="button" className="lgn-link" disabled={!onNext} onClick={onNext}>
              &lt; Next
            </button>
            <button type="button" className="lgn-link" disabled={!onPrevious} onClick={onPrevious}>
              Previous &gt;
            </button>
            <button type="button" className="lgn-link storyboard-reader-close" aria-label="Close" onClick={onClose}>
              [x]
            </button>
          </div>

          {story.photo ? (
            <img className="storyboard-reader-photo" src={story.photo} alt="" />
          ) : (
            <div className="storyboard-reader-photo" aria-hidden="true" />
          )}
          <p className="storyboard-reader-tag lgn-label">{tagLine(story)}</p>

          <p className="storyboard-reader-text">{story.content}</p>
          <p className="storyboard-reader-byline lgn-label">
            {byline(story)}
            <br />
            {dotDate(story.created_at)}
            {story.status && (
              <>
                <br />
                {STATUS_LABEL[story.status]}
              </>
            )}
          </p>

          <div className="storyboard-reader-film">
            <div className="storyboard-reader-film-bar lgn-label">
              <span>The film behind this story</span>
              <button type="button" className="storyboard-reader-watch" onClick={() => onOpenFilm(story.capsuleId)}>
                Watch with us
              </button>
            </div>
            <p className="storyboard-reader-film-title">{story.filmTitle}</p>
            <button type="button" className="lgn-btn storyboard-reader-add" onClick={() => onAdd(story.capsuleId)}>
              Add your own story
            </button>
            <a
              className="storyboard-reader-report lgn-label"
              href={`mailto:info@lgncinema.org?subject=${encodeURIComponent(`Report a storyboard story (#${story.id})`)}`}
            >
              Report this story
            </a>
          </div>
        </div>
      )}
    </dialog>
  );
}

/* ----------------------------------------------------------------- form */

interface AddProps {
  open: boolean;
  films: CapsuleSummary[];
  initialFilm: number;
  onClose: () => void;
  onShared: (filmId: number, entry: MyStory) => void;
}

/** "Add to the Storyboard". Figma: "Storyboard—add". */
function AddStoryDialog({ open, films, initialFilm, onClose, onShared }: AddProps) {
  const [filmId, setFilmId] = useState<number | null>(initialFilm);
  const [choosingFilm, setChoosingFilm] = useState(false);
  const [draft, setDraft] = useState('');
  const [nameCity, setNameCity] = useState('');
  const [email, setEmail] = useState('');
  const [monthly, setMonthly] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const ids = useId();

  // Each opening starts on the film it was opened for.
  useEffect(() => {
    if (open) {
      setFilmId(initialFilm);
      setChoosingFilm(false);
      setHint(null);
    }
  }, [open, initialFilm]);

  const words = wordCount(draft);
  const film = films.find((f) => f.id === filmId);

  const handlePhoto = async (file: File | undefined) => {
    setPhotoError(null);
    if (!file) return;
    try {
      setPhoto(await shrinkPhoto(file));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'That photo couldn’t be used.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    const content = draft.trim();
    if (!film) return setHint('Choose the film this story is about.');
    if (!content) return setHint('Write a sentence or two first.');
    if (words > MAX_WORDS) return setHint(`Please keep it to ${MAX_WORDS} words.`);
    if (!agreed) return setHint('Please confirm the last box to add your story.');
    if (submitting) return;
    setSubmitting(true);
    setHint(null);
    try {
      const { name, city } = splitNameCity(nameCity);
      const receipt = await submitStory({
        capsule_id: film.id,
        content,
        author_name: name,
        author_location: city,
        author_email: email.trim() || undefined,
        consent_to_share: true,
        photo: photo ?? undefined,
      });
      // The monthly email is Mailchimp's, sent in the background; a failure
      // there shouldn't undo a shared story.
      if (monthly && email.trim()) void subscribeEmail(email.trim());
      onShared(film.id, {
        id: receipt.id,
        token: receipt.token,
        content,
        author_name: name ?? null,
        author_location: name ? city ?? null : null,
        photo,
        created_at: receipt.created_at,
        status: receipt.status,
      });
      setDraft('');
      setPhoto(null);
      setAgreed(false);
    } catch (err) {
      setHint(`${err instanceof Error ? err.message : 'Could not add your story.'} Your words are still here. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <LgnDialog open={open} onClose={onClose} className="storyboard-form-dialog" label={<span className="storyboard-form-title">Add to the Storyboard</span>}>
        <form
          className="storyboard-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="storyboard-form-films lgn-label">
            {film && !choosingFilm ? (
              <span className="storyboard-chip">
                {film.title}
                <button type="button" aria-label={`Remove ${film.title}`} onClick={() => setFilmId(null)}>
                  [x]
                </button>
              </span>
            ) : null}
            {(!film || choosingFilm) && films.length > 0 ? (
              <span className="storyboard-film-choices">
                {films.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setFilmId(f.id);
                      setChoosingFilm(false);
                    }}
                  >
                    {f.title}
                  </button>
                ))}
              </span>
            ) : (
              films.length > 1 && (
                <button type="button" className="storyboard-quiet" onClick={() => setChoosingFilm(true)}>
                  + Change film
                </button>
              )
            )}
          </div>

          <label htmlFor={`${ids}-story`} className="storyboard-form-prompt">
            How did you take it beyond the screen?
          </label>
          <div className="storyboard-form-story">
            <textarea
              id={`${ids}-story`}
              className="lgn-field"
              placeholder="A sentence is enough."
              maxLength={MAX_STORY_LENGTH}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (hint) setHint(null);
              }}
            />
            <span className={`storyboard-form-count lgn-label${words > MAX_WORDS ? ' over' : ''}`}>
              {words > 0 ? `${words} / ${MAX_WORDS} words` : `Up to ${MAX_WORDS} words`}
            </span>
          </div>

          <div className="storyboard-form-extras lgn-label">
            <button type="button" className="storyboard-quiet" onClick={() => fileRef.current?.click()}>
              {photo ? 'Change photo' : '+ Add a photo'}
            </button>
            {photo && (
              <button type="button" className="storyboard-quiet" onClick={() => setPhoto(null)}>
                Remove photo
              </button>
            )}
            {photo && <img className="storyboard-form-thumb" src={photo} alt="Your photo" />}
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
          {photoError && <p className="storyboard-form-error" role="alert">{photoError}</p>}

          <p className="storyboard-form-section lgn-label">Your info</p>
          <input
            className="lgn-field lgn-field--quiet storyboard-form-field"
            type="text"
            placeholder="Name and city, or leave blank to stay anonymous"
            aria-label="Name and city (optional)"
            autoComplete="off"
            maxLength={142}
            value={nameCity}
            onChange={(e) => setNameCity(e.target.value)}
          />
          <input
            className="lgn-field lgn-field--quiet storyboard-form-field"
            type="email"
            placeholder="Email (optional), only to ask about edits"
            aria-label="Email (optional)"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="storyboard-check lgn-label">
            <input type="checkbox" checked={monthly} onChange={(e) => setMonthly(e.target.checked)} />
            <span>Email me when each month&rsquo;s film arrives</span>
          </label>
          <label className="storyboard-check lgn-label">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              I&rsquo;m 13 or older, this story is mine to share, and I agree to the{' '}
              <button type="button" className="storyboard-terms-link" onClick={() => setTermsOpen(true)}>
                Storyboard terms.
              </button>
              <br />
              We review every story before it appears
            </span>
          </label>

          <div className="storyboard-form-actions">
            <button type="submit" className="lgn-btn" disabled={submitting} aria-busy={submitting || undefined}>
              {submitting ? 'Adding…' : 'Add your story'}
            </button>
            <p className="storyboard-form-hint" role="status">{hint}</p>
          </div>
        </form>
      </LgnDialog>

      <LgnDialog open={termsOpen} onClose={() => setTermsOpen(false)} className="storyboard-terms-dialog" label="Storyboard terms">
        <ul className="storyboard-terms">
          <li>Your story, and your name, city and photo if you add them, may be shown publicly on the storyboard.</li>
          <li>Every story is reviewed by the LGN team before it appears. We may decline any submission.</li>
          <li>Please only share your own experience, and only upload a photo of yourself.</li>
          <li>Your email is never shown. We use it only to ask about edits to your story.</li>
          <li>Want something taken down later? Contact us and we&rsquo;ll remove it.</li>
        </ul>
      </LgnDialog>
    </>
  );
}
