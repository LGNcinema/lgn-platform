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

// ------------------------------------------------------------------ storyboard

export interface StoryboardStory {
  id: number;
  content: string;
  /** Null when the author chose to be anonymous. */
  author_name: string | null;
  author_location: string | null;
  created_at: string | null;
}

export interface StoryboardResponse {
  capsule_id: number;
  month: string;
  /** False until the story's month has ended; `stories` is empty until then. */
  revealed: boolean;
  /** ISO-8601 naive UTC -- the first instant after the story's month. */
  reveals_at: string | null;
  stories: StoryboardStory[];
}

export async function fetchStoryboard(capsuleId: number): Promise<StoryboardResponse> {
  const res = await fetch(`${API_URL}/api/capsules/${capsuleId}/storyboard`);
  if (!res.ok) throw new Error(`Could not load the storyboard (${res.status}).`);
  return res.json();
}

export interface StorySubmission {
  capsule_id: number;
  content: string;
  author_name?: string;
  author_location?: string;
  is_anonymous?: boolean;
  /** The visitor's explicit consent to publication. Without it the story is
   *  kept privately and never appears on the storyboard. */
  consent_to_share: boolean;
}

export async function submitStory(payload: StorySubmission): Promise<void> {
  const res = await fetch(`${API_URL}/api/submissions/storyboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Could not share your story (${res.status}).`);
}
