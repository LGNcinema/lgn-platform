export type Dimension = 'self' | 'neighbor' | 'world';

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
  /** Self / Neighbor / World. Null on reflections written before V3. */
  dimension?: Dimension | null;
}

export interface CapsulePhoto {
  id: number;
  url: string;
  caption?: string | null;
  position: number;
}

export interface Practice {
  id: number;
  capsule_id: number;
  title: string;
  description?: string;
  steps: string;
  /** Self / Neighbor / World. Null on practices written before V3. */
  dimension?: Dimension | null;
  /** Optional tips shown with the practice (V3). */
  tips?: string | null;
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
  /** One introduction for the whole Reflect tab (V3). */
  reflect_intro?: string | null;
  /** The Practice tab's title / intro line (V3). */
  practice_title?: string | null;
  /** The story's LGN Spark: its YouTube interview. Public placement TBD. */
  spark_url?: string | null;
  /** Behind-the-scenes photos; `url` is API-relative. Not shown publicly yet. */
  bts_photos?: CapsulePhoto[];
  film?: Film;
  reflections: Reflection[];
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
