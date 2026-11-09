import type { Dimension } from '../../types';
import type { AiStatus, FilmDetail, PromptKind } from '../../components/beyond/beyond';

export type Handling = 'normal' | 'universal_only' | 'held';

export interface AdminPrompt {
  id: number;
  source: 'universal' | 'lgn' | 'ai';
  kind: PromptKind;
  dimension: Dimension;
  position: number;
  title: string | null;
  content: string | null;
  steps: string | null;
  tips: string | null;
}

export interface AdminFilmRow {
  id: number;
  tmdb_id: number;
  title: string | null;
  year: number | null;
  handling: Handling;
  has_care_note: boolean;
  ai_status: AiStatus;
  lgn_prompt_count: number;
}

export interface AdminFilmDetail {
  id: number;
  tmdb_id: number;
  film: FilmDetail | null;
  handling: Handling;
  care_note: string | null;
  logline: string | null;
  ai_status: AiStatus;
  ai_model: string | null;
  lgn: AdminPrompt[];
  ai: AdminPrompt[];
}

export interface FeedbackItem {
  id: number;
  tmdb_id: number | null;
  film_title: string | null;
  type: 'suggestion' | 'something_off' | 'not_found';
  kind: PromptKind | null;
  dimension: Dimension | null;
  message: string | null;
  suggested_text: string | null;
  film_year_typed: string | null;
  email: string | null;
  status: 'new' | 'reviewed' | 'resolved';
  created_at: string | null;
}

export const HANDLING_LABEL: Record<Handling, string> = {
  normal: 'Normal',
  universal_only: 'Universal questions only',
  held: 'Held (no page)',
};

export const AI_LABEL: Record<AiStatus, string> = {
  none: 'Not generated',
  pending: 'Generating…',
  ready: 'AI questions ready',
  unavailable: 'AI doesn’t know this film',
  failed: 'AI failed (will retry)',
};
