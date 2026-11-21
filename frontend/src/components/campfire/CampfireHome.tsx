import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent } from 'react';
import './CampfireHome.css';
import { API_URL } from '../../api';
import type { CapsuleDetail, CapsuleSummary } from '../../types';
import { FilmCredit } from './FilmCredit';
import { GuidesDialog } from './GuidesDialog';
import { LgnDialog } from '../LgnDialog';
import { comingSoonMonths, storiesInOrder } from './campfire';

interface Props {
  /** Published stories only (the public API never returns drafts). */
  stories: CapsuleSummary[];
  onOpenStory: (capsuleId: number) => void;
  theme: 'light' | 'dark';
  /** "For Filmmakers >" in How these guides are made. */
  onOpenFilmmakers: () => void;
  /** "Read more about how it works >": About, LGN Cinema. */
  onOpenAboutCinema: () => void;
}

/** Per-story detail state. A missing key means the fetch is still in flight. */
type DetailState = CapsuleDetail | 'failed';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "2027-01" -> "January 2027" (the label is set in caps by CSS). */
function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return y && m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${y}` : month;
}

/** "2027-02" -> "02.2027", the coming-soon card's date. */
function monthDots(month: string): string {
  const [y, m] = month.split('-');
  return y && m ? `${m}.${y}` : month;
}

/** How long the pointer rests on a side card before it slides to the centre. */
const HOVER_DWELL_MS = 220;
/** After a hover slides the row, the pointer must travel this far (px) before
 *  another hover can: otherwise the card now under a resting cursor would
 *  pull the row straight back. */
const HOVER_REARM_PX = 48;

type Slide =
  | { kind: 'story'; story: CapsuleSummary; number: number }
  | { kind: 'coming'; number: number; month?: string };

/**
 * The landing page (UX, 2026-11: the old introductory home page is retired;
 * this, the Go Beyond page, is where the site opens). Figma "HOME":
 *
 * - the Life > Numbers wordmark, "Watch. Reflect. Practice." and the film
 *   search. The search itself (a page of guidance for any film) is being
 *   built separately, so for now submitting says it's on its way.
 * - "LGN Presents": the monthly films as a carousel. The centred card is
 *   full size; its neighbours sit smaller to each side. Resting the pointer
 *   on a neighbour brings it to the centre and up to full size (UX: so it's
 *   clear each card opens), as do the arrows and a click. A click on the
 *   centred card opens that film. After the newest film, a "Coming Soon"
 *   card for the next month.
 */
export function CampfireHome({ stories, onOpenStory, theme, onOpenFilmmakers, onOpenAboutCinema }: Props) {
  const ordered = useMemo(() => storiesInOrder(stories), [stories]);
  const [details, setDetails] = useState<Record<number, DetailState>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [guidesOpen, setGuidesOpen] = useState(false);
  const [presentsOpen, setPresentsOpen] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);

  // Keyed on the id list rather than the array so a parent re-render that hands
  // us an equal-but-new array does not refetch every story.
  const idKey = ordered.map((s) => s.id).join(',');
  useEffect(() => {
    const controller = new AbortController();
    const ids = idKey ? idKey.split(',').map(Number) : [];
    for (const id of ids) {
      fetch(`${API_URL}/api/capsules/${id}`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
          return res.json() as Promise<CapsuleDetail>;
        })
        .then((detail) => setDetails((prev) => ({ ...prev, [id]: detail })))
        .catch(() => {
          // An abort means we unmounted or the list changed -- not a failure.
          if (controller.signal.aborted) return;
          setDetails((prev) => ({ ...prev, [id]: 'failed' }));
        });
    }
    return () => controller.abort();
  }, [idKey]);

  // Every published film, then a placeholder for the next month. Not a real
  // upcoming story -- the public API hides unpublished ones.
  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = ordered.map((story, i) => ({ kind: 'story', story, number: i + 1 }));
    const latest = ordered[ordered.length - 1];
    if (latest) {
      const [month] = comingSoonMonths(latest.month, 1);
      out.push({ kind: 'coming', number: ordered.length + 1, month });
    }
    return out;
  }, [ordered]);

  // The newest film leads unless the visitor has moved the row.
  const newest = Math.max(0, ordered.length - 1);
  const active = selected !== null && selected < slides.length ? selected : newest;

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = String(new FormData(e.currentTarget).get('film') ?? '').trim();
    setSearchNote(query ? 'Guides for any film are on their way. For now, see LGN Presents below.' : null);
  };

  return (
    <div className="campfire-home">
      <section className="cf-hero" aria-label="Life is Greater than Numbers">
        <h1 className="cf-hero-logo">
          <img
            src={theme === 'dark' ? '/images/lgn-logo-registered-white.svg' : '/images/lgn-logo-registered.svg'}
            alt="Life is Greater than Numbers"
          />
        </h1>
        <WatchReflectPractice />
        <form className="cf-search" role="search" onSubmit={onSearch}>
          <input
            className="lgn-field cf-search-field"
            type="search"
            name="film"
            placeholder="Search film"
            aria-label="Search film"
            autoComplete="off"
            onChange={() => setSearchNote(null)}
          />
          <button type="submit" className="lgn-btn cf-search-btn">Go beyond</button>
        </form>
        <p className="cf-hero-note cf-grey" role="status">
          {searchNote ?? (
            <>
              Take any film beyond the screen.{' '}
              <button type="button" className="cf-text-btn" onClick={() => setGuidesOpen(true)}>
                How guides work.
              </button>
            </>
          )}
        </p>
      </section>

      <section className="cf-presents" aria-labelledby="cf-presents-heading">
        <h2 id="cf-presents-heading" className="cf-heading">LGN Presents</h2>
        <p className="cf-presents-text">
          One short film a month. Guided by its filmmaker.
          <br />
          <button type="button" className="cf-text-btn" onClick={() => setPresentsOpen(true)}>
            How it works.
          </button>
        </p>

        {slides.length > 0 ? (
          <FilmCarousel
            slides={slides}
            active={active}
            details={details}
            onSelect={setSelected}
            onOpen={onOpenStory}
          />
        ) : (
          <p className="cf-empty">The first film is on its way.</p>
        )}
      </section>

      <GuidesDialog open={guidesOpen} onClose={() => setGuidesOpen(false)} onOpenFilmmakers={onOpenFilmmakers} />
      <PresentsDialog
        open={presentsOpen}
        onClose={() => setPresentsOpen(false)}
        onReadMore={() => {
          setPresentsOpen(false);
          onOpenAboutCinema();
        }}
      />
    </div>
  );
}

interface CarouselProps {
  slides: Slide[];
  active: number;
  details: Record<number, DetailState>;
  onSelect: (index: number) => void;
  onOpen: (capsuleId: number) => void;
}

/**
 * The row of film cards, laid out as the Figma draws it: the month's film
 * full size on the 660 line, the next one smaller to its right behind a ">",
 * the previous one (if any) to its left behind a "<". Each card is placed by
 * its distance from the active one (--offset), so moving the row is one CSS
 * transition: cards slide and scale together. Only the hover (a dwell brings
 * a neighbour to the centre) and that scale are new.
 */
function FilmCarousel({ slides, active, details, onSelect, onOpen }: CarouselProps) {
  const dwell = useRef<number | null>(null);
  // Where the pointer was when a hover last moved the row; null when armed.
  const lockedAt = useRef<{ x: number; y: number } | null>(null);

  const clearDwell = () => {
    if (dwell.current !== null) window.clearTimeout(dwell.current);
    dwell.current = null;
  };
  useEffect(() => clearDwell, []);

  const onCardPointer = (index: number, e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || index === active) return;
    const lock = lockedAt.current;
    if (lock) {
      if (Math.hypot(e.clientX - lock.x, e.clientY - lock.y) < HOVER_REARM_PX) return;
      lockedAt.current = null;
    }
    if (dwell.current !== null) return;
    const at = { x: e.clientX, y: e.clientY };
    dwell.current = window.setTimeout(() => {
      dwell.current = null;
      lockedAt.current = at;
      onSelect(index);
    }, HOVER_DWELL_MS);
  };

  const prev = active > 0 ? active - 1 : null;
  const next = active < slides.length - 1 ? active + 1 : null;

  return (
    <div className="cf-carousel" aria-roledescription="carousel" aria-label="Monthly films" onPointerLeave={clearDwell}>
      <div className="cf-carousel-track">
        {slides.map((slide, i) => {
          const offset = i - active;
          if (Math.abs(offset) > 2) return null;
          const hidden = Math.abs(offset) > 1;
          const isActive = offset === 0;
          return (
            <div
              key={slide.kind === 'story' ? slide.story.id : 'coming'}
              className={`cf-slide${isActive ? ' is-active' : ''}${hidden ? ' is-hidden' : ''}`}
              style={{ '--offset': offset } as CSSProperties}
              aria-hidden={isActive ? undefined : true}
              onPointerMove={(e) => onCardPointer(i, e)}
              onPointerLeave={clearDwell}
            >
              {slide.kind === 'story' ? (
                <FilmCard
                  story={slide.story}
                  number={slide.number}
                  detail={details[slide.story.id]}
                  interactive={isActive}
                  onClick={() => (isActive ? onOpen(slide.story.id) : onSelect(i))}
                />
              ) : (
                <ComingSoonCard
                  number={slide.number}
                  month={slide.month}
                  onClick={isActive ? undefined : () => onSelect(i)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* The carets between the centred card and its neighbours (Figma: a
          ">" between the month's film and the next). */}
      {prev !== null && (
        <button type="button" className="cf-caret cf-caret--prev" aria-label="Previous film" onClick={() => onSelect(prev)}>
          &lt;
        </button>
      )}
      {next !== null && (
        <button type="button" className="cf-caret cf-caret--next" aria-label="Next film" onClick={() => onSelect(next)}>
          &gt;
        </button>
      )}
    </div>
  );
}

interface FilmCardProps {
  story: CapsuleSummary;
  number: number;
  detail: DetailState | undefined;
  /** Only the centred card is in the tab order; the others are reached by the arrows. */
  interactive: boolean;
  onClick: () => void;
}

/** A month's film: its number and month, title, credit line and still. The whole card is
 *  the button (the title's ::after covers it), so the heading stays a heading
 *  and screen readers hear a short name. */
function FilmCard({ story, number, detail, interactive, onClick }: FilmCardProps) {
  const film = detail && detail !== 'failed' ? detail.film : undefined;
  const thumbnail = film?.thumbnail_url?.trim();
  // A broken thumbnail URL falls back to the same grey block as "no still yet".
  const [stillFailed, setStillFailed] = useState(false);

  return (
    <article className="cf-card cf-card--film" aria-busy={detail === undefined}>
      <div className="cf-card-labels lgn-label">
        <span>Film No. {number}</span>
        <span>{monthLabel(story.month)}</span>
      </div>
      <h3 className="cf-card-title">
        <button type="button" className="cf-card-link" tabIndex={interactive ? 0 : -1} onClick={onClick}>
          {story.title}
        </button>
      </h3>
      {film && <FilmCredit film={film} className="cf-card-credit lgn-label" />}
      {thumbnail && !stillFailed ? (
        <img
          className="cf-card-still"
          src={thumbnail}
          alt=""
          loading="lazy"
          onError={() => setStillFailed(true)}
        />
      ) : (
        <div className="cf-card-still" aria-hidden="true" />
      )}
    </article>
  );
}

/** The card after the newest film. Figma: centred grey caps. */
function ComingSoonCard({ number, month, onClick }: { number: number; month?: string; onClick?: () => void }) {
  const text = (
    <span className="cf-coming-text lgn-label">
      <span>Life is Greater than<br />Numbers, Inc.</span>
      <span>LGN Presents</span>
      <span>
        Film No. {number}
        <br />
        Coming Soon
        {month && (
          <>
            <br />
            {monthDots(month)}
          </>
        )}
      </span>
      <span>Greater Stories for<br />Greater Living</span>
    </span>
  );
  return onClick ? (
    <button type="button" className="cf-card cf-card--coming" tabIndex={-1} onClick={onClick}>
      {text}
    </button>
  ) : (
    <div className="cf-card cf-card--coming">{text}</div>
  );
}

/**
 * "Watch. Reflect. Practice." under the wordmark, with its explanation on
 * hover or keyboard focus (Figma popup 1, "watch reflect practice—hover").
 */
function WatchReflectPractice() {
  const id = useId();
  return (
    <div className="cf-wrp">
      <p className="cf-hero-tagline" tabIndex={0} aria-describedby={id}>
        Watch. Reflect. Practice.
      </p>
      <div className="cf-wrp-pop" id={id} role="tooltip">
        <p className="lgn-label">Watch. Reflect. Practice.</p>
        <p className="cf-wrp-lead">
          What a film sets in motion tends to stall unless it has somewhere to go. These three steps are that somewhere.
        </p>
        <ol className="cf-wrp-steps">
          <li>
            <strong>Watch.</strong> Look closer. Learn who made the film, why they made it, and how.
          </li>
          <li>
            <strong>Reflect.</strong> Look inward. Answer three questions: one about yourself, one about your neighbor,
            one about the world we share.
          </li>
          <li>
            <strong>Practice.</strong> Live it out. Find three ways to carry the film forward: for you, for a neighbor,
            for the world.
          </li>
        </ol>
      </div>
    </div>
  );
}

/** "How “LGN Presents” works". Figma popup 3. */
function PresentsDialog({ open, onClose, onReadMore }: { open: boolean; onClose: () => void; onReadMore: () => void }) {
  return (
    <LgnDialog open={open} onClose={onClose} className="presents-dialog" label="How “LGN Presents” works">
      <div className="presents-dialog-body">
        <p className="presents-dialog-lead">Each month, LGN presents one short film for all of us to gather around.</p>
        <p>
          <strong>One film, together.</strong> When many of us spend the same month with the same story, we have common
          ground to stand on. A new film opens on the first Sunday of each month.
        </p>
        <p>
          <strong>Why short films.</strong> A short can be a whole encounter in under half an hour. That leaves room for
          what comes next.
        </p>
        <p>
          <strong>Shaped with the filmmaker.</strong> Every question and practice is written with the people who made the
          film. It’s the fullest kind of guide we offer (<span aria-hidden="true">●●●●</span> LGN + Filmmaker), and the
          standard we hope every film in the Library reaches.
        </p>
        <p>
          <strong>The filmmaker goes first.</strong> In our Beyond the Screen series on YouTube, each filmmaker answers
          the questions and tries the practices before anyone else does.{' '}
          <a className="rich-link" href="https://www.youtube.com/@lgncinema" target="_blank" rel="noopener noreferrer">
            Watch the series
          </a>
        </p>
        <p>Watch whenever you’re ready. Then reflect, practice, and share on the Storyboard if you’d like.</p>
        <button type="button" className="lgn-btn presents-dialog-more" onClick={onReadMore}>
          Read more about how it works
        </button>
      </div>
    </LgnDialog>
  );
}
