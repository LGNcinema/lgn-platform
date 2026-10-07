/**
 * Shared pieces for the Campfire -- the collection of stories that used to be
 * called "capsules". Each story is one monthly capsule (Lightpoles is Story
 * No. 1); the backend still calls them capsules, so the API types keep that
 * name and only the UI speaks of stories.
 */
import { API_URL } from '../../api';
import type { CapsuleSummary } from '../../types';

/** Sections of a story page. `making` is reached from "More on making this
 *  film", not from the section nav, so it is absent from STORY_NAV_SECTIONS. */
export type StorySection = 'watch' | 'reflect' | 'practice' | 'making';

export const STORY_NAV_SECTIONS: { key: StorySection; label: string }[] = [
  { key: 'watch', label: 'Watch' },
  { key: 'reflect', label: 'Reflect' },
  { key: 'practice', label: 'Practice' },
];

export const VALID_STORY_SECTIONS = ['watch', 'reflect', 'practice', 'making'] as const;

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

/** "2026-07" -> "JULY 2026". Tolerates "2026-07-01". Unparseable input is
 *  returned as-is rather than rendered as "UNDEFINED NaN". */
export function formatStoryMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return month;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Stories in chronological order -- `month` is 'YYYY-MM', so a string sort is
 *  a date sort. Story No. 1 is the oldest. */
export function storiesInOrder<T extends { month: string }>(stories: T[]): T[] {
  return [...stories].sort((a, b) => a.month.localeCompare(b.month));
}

/** 1-based story number for a capsule, from its place in the published list. */
export function storyNumber(capsuleId: number, stories: CapsuleSummary[]): number {
  const index = storiesInOrder(stories).findIndex((s) => s.id === capsuleId);
  return index === -1 ? 1 : index + 1;
}

/** The next `count` months after `month`, as 'YYYY-MM' -- used for the hub's
 *  "Coming Soon" placeholders. The public API only returns published stories,
 *  so upcoming ones are placeholders derived here, not real data. */
export function monthsAfter(month: string, count: number): string[] {
  let [y, m] = month.split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    out.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return out;
}

/** 'YYYY-MM' for a date, in the visitor's local time. */
function monthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Months to label the hub's "Coming Soon" placeholders with.
 *
 * Counts forward from the latest published story -- but never from before the
 * current month. Without that floor, a campfire whose newest story is a few
 * months old advertises months that are already over: Lightpoles (2026-07)
 * seen in late September offered "Coming Soon: August 2026". The current month
 * itself is allowed, since a story scheduled for later this month is exactly
 * what "coming soon" means.
 *
 * These are still guesses about the schedule -- the public API hides
 * unpublished stories -- so they can drift from what is actually planned.
 */
export function comingSoonMonths(latestMonth: string, count: number, now: Date = new Date()): string[] {
  if (count <= 0) return [];
  const [afterLatest] = monthsAfter(latestMonth, 1);
  const current = monthOf(now);
  // 'YYYY-MM' compares correctly as a string.
  const start = afterLatest > current ? afterLatest : current;
  return [start, ...monthsAfter(start, count - 1)];
}

// ------------------------------------------------------------------ storyboard

export type StoryStatus = 'pending' | 'approved' | 'declined';

export interface StoryboardStory {
  id: number;
  content: string;
  /** Null when the author left their name blank. */
  author_name: string | null;
  author_location: string | null;
  /** Path to the author's photo (relative to the API), or null. */
  photo_url: string | null;
  created_at: string | null;
}

/** Approved stories, oldest first. The page shows them once the visitor has
 *  shared a story of their own. */
export interface StoryboardResponse {
  capsule_id: number;
  month: string;
  stories: StoryboardStory[];
}

export async function fetchStoryboard(capsuleId: number): Promise<StoryboardResponse> {
  const res = await fetch(`${API_URL}/api/capsules/${capsuleId}/storyboard`);
  if (!res.ok) throw new Error(`Could not load the storyboard (${res.status}).`);
  return res.json();
}

/** An API-relative photo path made absolute for <img src>. */
export const storyPhotoSrc = (path: string) => `${API_URL}${path}`;

export interface StorySubmission {
  capsule_id: number;
  content: string;
  author_name?: string;
  author_location?: string;
  /** Always true: the form is only offered after the visitor agrees to the
   *  storyboard terms, and the API rejects anything else. */
  consent_to_share: true;
  /** A small JPEG data URL (see shrinkPhoto), or omitted. */
  photo?: string;
}

export interface StoryReceipt {
  id: number;
  /** Lets this browser check on the submission later. Keep it private. */
  token: string;
  status: StoryStatus;
  created_at: string | null;
}

export async function submitStory(payload: StorySubmission): Promise<StoryReceipt> {
  const res = await fetch(`${API_URL}/api/submissions/storyboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Could not share your story (${res.status}).`);
  return res.json();
}

/** Where the visitor's own submission stands. Null if it can't be checked
 *  (offline, or the server no longer knows it) -- callers keep what they had. */
export async function fetchOwnStoryStatus(id: number, token: string): Promise<StoryStatus | null> {
  try {
    const res = await fetch(`${API_URL}/api/submissions/storyboard/${id}?token=${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { status: StoryStatus };
    return body.status;
  } catch {
    return null;
  }
}

/**
 * A photo file, shrunk in the browser to a centred 320px square JPEG (~20 KB)
 * before it ever leaves the device -- the original is never uploaded. Throws a
 * readable Error for files the browser can't decode (e.g. HEIC on most
 * desktop browsers).
 */
export async function shrinkPhoto(file: File, size = 320): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode().catch(() => {
      throw new Error('That photo couldn\u2019t be opened here. Try a JPG or PNG.');
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser couldn\u2019t prepare the photo.');
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
