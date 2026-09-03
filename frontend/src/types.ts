export type VideoProvider = 'vimeo' | 'mux' | 'youtube' | 'file';

export interface Film {
  id: number;
  capsule_id: number;
  title: string;
  director: string;
  duration?: string;
  thumbnail_url?: string;
  description?: string;
  theme?: string;
  bts_text?: string;
  screenplay_text?: string;

  /** Raw source field. May hold a bare URL or a full `<iframe>` embed snippet. */
  video_url?: string;
  /** Explicit provider. When null/undefined the provider is inferred from `video_url`. */
  video_provider?: VideoProvider;
  /** Provider-native id, e.g. the Vimeo numeric id `1052574030`. */
  video_id?: string;
  /** Vimeo private-link hash, e.g. `53c90178cb`. */
  video_hash?: string;
  /** CSS aspect-ratio string, e.g. `16 / 9`. Defaults to `16 / 9`. */
  video_aspect_ratio?: string;
  video_duration_seconds?: number;
  captions_url?: string;
}

export interface Reflection {
  id: number;
  capsule_id: number;
  title: string;
  introduction?: string;
  content: string;
  author?: string;
  created_at: string;
}

export interface DiscussionCircle {
  id: number;
  capsule_id: number;
  title: string;
  opening_round?: string;
  discuss_prompts?: string;
  closing_question?: string;
}

export interface Practice {
  id: number;
  capsule_id: number;
  title: string;
  description?: string;
  steps: string;
}

export interface CapsuleDetail {
  id: number;
  month: string;
  title: string;
  description?: string;
  is_active: boolean;
  /** Scheduled go-live time, ISO-8601 **naive UTC** (no `Z`, no offset). */
  publish_at?: string | null;
  /** Server-derived, read-only: `is_active OR publish_at <= utcnow()`. */
  is_published?: boolean;
  pre_watch_prompt?: string;
  pre_watch_supporting_text?: string;
  film?: Film;
  reflections: Reflection[];
  discussion_circles: DiscussionCircle[];
  practices: Practice[];
}

// One turn of a Geme conversation. The transcript lives only in component state --
// it is replayed to the backend on each turn and never stored on either side.
export interface GemeTurn {
  role: 'user' | 'assistant';
  content: string;
}

// Draft settings from the dev tuning panel, sent with each chat request. The
// server honours them only when GEME_DEBUG is on; every field is optional and
// falls back to the server's own value.
export interface GemeTuning {
  persona?: string;
  opening_turn?: string;
  model?: string;
  effort?: string;
  max_tokens?: number;
  max_turns?: number;
  max_chars_per_turn?: number;
}

// Geme's live settings as reported by GET /api/geme/config.
export interface GemeConfig {
  persona: string;
  opening_turn: string;
  model: string;
  effort: string;
  max_tokens: number;
  max_turns: number;
  max_chars_per_turn: number;
  assembled_system_prompt: string;
}

export interface CapsuleSummary {
  id: number;
  month: string;
  title: string;
  is_active: boolean;
  /** Scheduled go-live time, ISO-8601 **naive UTC** (no `Z`, no offset). */
  publish_at?: string | null;
  /** Server-derived, read-only: `is_active OR publish_at <= utcnow()`. */
  is_published?: boolean;
}
