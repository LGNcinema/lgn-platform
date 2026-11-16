import { useEffect, useMemo, useState } from 'react';
import './CampfireHome.css';
import { API_URL } from '../../api';
import type { CapsuleDetail, CapsuleSummary } from '../../types';
import { FilmCredit } from './FilmCredit';
import { BeyondSearch } from '../beyond/BeyondSearch';
import { comingSoonMonths, storiesInOrder } from './campfire';

interface Props {
  /** Published stories only (the public API never returns drafts). */
  stories: CapsuleSummary[];
  onOpenStory: (capsuleId: number) => void;
  /** Any other film, by its TMDB id (Beyond the Screen). */
  onOpenFilm: (tmdbId: number) => void;
  /** The admin's on/off switch for the film search. Off: the section is gone. */
  beyondEnabled: boolean;
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

/**
 * The Campfire hub. Figma v3: "Campfire—home".
 *
 * Two sections:
 * - "Take it beyond the screen": the film search (FilmSearch): a page of
 *   guidance for any film. "How it works." opens the guides explainer.
 * - "Gather with us": the monthly film. One large card (the newest published
 *   story, unless the visitor steps back), with the next story -- or a
 *   "Coming Soon" card after the newest -- to its right behind a ">", and the
 *   previous story to its left behind a "<" when there is one.
 */
export function CampfireHome({ stories, onOpenStory, onOpenFilm, beyondEnabled }: Props) {
  const ordered = useMemo(() => storiesInOrder(stories), [stories]);
  const [details, setDetails] = useState<Record<number, DetailState>>({});
  const [selected, setSelected] = useState<number | null>(null);

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

  // The newest story leads unless the visitor has stepped to another.
  const index = selected !== null && selected < ordered.length ? selected : ordered.length - 1;
  const current = ordered[index];
  const previous = index > 0 ? ordered[index - 1] : undefined;
  const next = index < ordered.length - 1 ? ordered[index + 1] : undefined;
  // After the newest story: a placeholder for the next month. Not a real
  // upcoming story -- the public API hides unpublished ones.
  const latest = ordered[ordered.length - 1];
  const [comingMonth] = latest ? comingSoonMonths(latest.month, 1) : [];

  return (
    <div className="campfire-home">
      {beyondEnabled && <BeyondSearch onOpenFilm={onOpenFilm} onOpenStory={onOpenStory} />}

      <section className={`cf-section cf-section--gather${beyondEnabled ? '' : ' cf-section--first'}`} aria-labelledby="cf-gather-heading">
        <h2 id="cf-gather-heading" className="cf-heading cf-heading--gather">Gather with us</h2>

        {current ? (
          <div className="cf-gather">
            <div className="cf-gather-side cf-gather-side--prev">
              {previous && (
                <>
                  <SideCard story={previous} number={index} onSelect={() => setSelected(index - 1)} />
                  <button type="button" className="cf-arrow" aria-label="Previous film" onClick={() => setSelected(index - 1)}>
                    &lt;
                  </button>
                </>
              )}
            </div>

            <FeatureCard
              story={current}
              number={index + 1}
              detail={details[current.id]}
              onOpen={() => onOpenStory(current.id)}
            />

            <div className="cf-gather-side cf-gather-side--next">
              {next ? (
                <>
                  <button type="button" className="cf-arrow" aria-label="Next film" onClick={() => setSelected(index + 1)}>
                    &gt;
                  </button>
                  <SideCard story={next} number={index + 2} onSelect={() => setSelected(index + 1)} />
                </>
              ) : (
                <>
                  <span className="cf-arrow" aria-hidden="true">&gt;</span>
                  <ComingSoonCard number={ordered.length + 1} month={comingMonth} />
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="cf-empty">The first film is on its way.</p>
        )}
      </section>

    </div>
  );
}

interface FeatureCardProps {
  story: CapsuleSummary;
  number: number;
  detail: DetailState | undefined;
  onOpen: () => void;
}

/** The month's film: labels, title, credit line, still. The whole card opens
 *  the story, through the title's button (its ::after covers the card), so the
 *  heading stays a heading and screen readers hear a short name. */
function FeatureCard({ story, number, detail, onOpen }: FeatureCardProps) {
  const film = detail && detail !== 'failed' ? detail.film : undefined;
  const thumbnail = film?.thumbnail_url?.trim();
  // A broken thumbnail URL falls back to the same grey block as "no still yet".
  const [stillFailed, setStillFailed] = useState(false);

  return (
    <article className="cf-card cf-card--feature" aria-busy={detail === undefined}>
      <div className="cf-card-labels lgn-label">
        <span>Film No. {number}</span>
        <span>{monthLabel(story.month)}</span>
      </div>
      <h3 className="cf-card-title">
        <button type="button" className="cf-card-link" onClick={onOpen}>
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

/** A neighbouring film, small, beside the featured one. Selecting it brings
 *  it to the middle. */
function SideCard({ story, number, onSelect }: { story: CapsuleSummary; number: number; onSelect: () => void }) {
  return (
    <button type="button" className="cf-card cf-card--side" onClick={onSelect}>
      <span className="cf-side-text lgn-label">
        <span>Film No. {number}</span>
        <span>{monthLabel(story.month)}</span>
        <span className="cf-side-title">{story.title}</span>
      </span>
    </button>
  );
}

/** The card after the newest film. Figma: centred grey caps. */
function ComingSoonCard({ number, month }: { number: number; month?: string }) {
  return (
    <div className="cf-card cf-card--side cf-card--coming">
      <p className="cf-side-text lgn-label">
        <span>Life is Greater than<br />Numbers, Inc.</span>
        <span>Go Beyond</span>
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
      </p>
    </div>
  );
}
