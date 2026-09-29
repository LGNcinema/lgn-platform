import { useEffect, useMemo, useState } from 'react';
import './CampfireHome.css';
import { API_URL } from '../../api';
import type { CapsuleDetail, CapsuleSummary } from '../../types';
import { FilmCredit } from './FilmCredit';
import { comingSoonMonths, formatStoryMonth, storiesInOrder } from './campfire';

interface Props {
  /** Published stories only (the public API never returns drafts). */
  stories: CapsuleSummary[];
  onOpenStory: (capsuleId: number) => void;
}

/** Cards per row in the frame. The last row is padded to this with placeholders. */
const ROW_SIZE = 3;

/** Per-story detail state. A missing key means the fetch is still in flight. */
type DetailState = CapsuleDetail | 'failed';

/**
 * The Campfire hub. Figma: [CAMPFIRE]-HOME, cards from "Capsule Menu".
 *
 * Every published story gets a white card, oldest first (Story No. 1 is the
 * first story ever published). The list endpoint carries no film data, so each
 * card fetches its own story's detail for the credit line and still; until that
 * arrives -- or if it fails -- the card still shows what the summary already
 * gives it (number, month, title), just without the credit line and with the
 * grey still placeholder.
 */
export function CampfireHome({ stories, onOpenStory }: Props) {
  const ordered = useMemo(() => storiesInOrder(stories), [stories]);
  const [details, setDetails] = useState<Record<number, DetailState>>({});

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

  // "Coming Soon" placeholders fill out the last row. The public API never
  // returns unpublished stories -- drafts and scheduled ones are invisible to it
  // -- so these are not real upcoming stories, only the next numbers and months
  // after the latest published one. They exist to show that more is coming.
  const cardCount = Math.max(ROW_SIZE, Math.ceil(ordered.length / ROW_SIZE) * ROW_SIZE);
  const placeholderCount = cardCount - ordered.length;
  const latest = ordered[ordered.length - 1];
  // With nothing published there is no month to count from, so the
  // placeholders go unlabelled rather than guessing.
  const placeholderMonths = latest ? comingSoonMonths(latest.month, placeholderCount) : [];

  return (
    <div className="campfire-home">
      <h1 className="campfire-home-heading">The Campfire</h1>

      <ul className="campfire-home-grid">
        {ordered.map((story, index) => (
          <StoryCard
            key={story.id}
            story={story}
            number={index + 1}
            detail={details[story.id]}
            onOpen={() => onOpenStory(story.id)}
          />
        ))}
        {Array.from({ length: placeholderCount }, (_, k) => (
          <li key={`coming-${k}`} className="campfire-card campfire-card--coming">
            <div className="campfire-card-body">
              <div className="campfire-card-meta">
                <span>Story No. {ordered.length + k + 1}</span>
                {placeholderMonths[k] && <span>{formatStoryMonth(placeholderMonths[k])}</span>}
              </div>
              <h2 className="campfire-card-title">Coming Soon</h2>
            </div>
            <div className="campfire-card-still" aria-hidden="true" />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface StoryCardProps {
  story: CapsuleSummary;
  number: number;
  detail: DetailState | undefined;
  onOpen: () => void;
}

function StoryCard({ story, number, detail, onOpen }: StoryCardProps) {
  const film = detail && detail !== 'failed' ? detail.film : undefined;
  const thumbnail = film?.thumbnail_url?.trim();
  // A broken thumbnail URL falls back to the same grey block as "no still yet",
  // instead of the browser's broken-image icon.
  const [stillFailed, setStillFailed] = useState(false);

  return (
    <li className="campfire-card campfire-card--story" aria-busy={detail === undefined}>
      <div className="campfire-card-body">
        <div className="campfire-card-meta">
          <span>Story No. {number}</span>
          <span>{formatStoryMonth(story.month)}</span>
        </div>
        {/* The whole card is clickable, but the only interactive element is this
            button: its ::after stretches over the card (see the CSS), so the
            heading stays a heading and screen readers hear a short name
            ("Lightpoles") rather than the entire card read out as one button. */}
        <h2 className="campfire-card-title">
          <button type="button" className="campfire-card-link" onClick={onOpen}>
            {story.title}
          </button>
        </h2>
        {film && <FilmCredit film={film} className="campfire-card-credit" />}
      </div>
      {thumbnail && !stillFailed ? (
        <img
          className="campfire-card-still"
          src={thumbnail}
          alt={film?.title ? `Still from ${film.title}` : `Still from ${story.title}`}
          loading="lazy"
          onError={() => setStillFailed(true)}
        />
      ) : (
        <div className="campfire-card-still" aria-hidden="true" />
      )}
    </li>
  );
}
