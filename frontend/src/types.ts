export type Dimension = 'self' | 'neighbor' | 'world';

export type VideoProvider = 'vimeo' | 'mux' | 'youtube' | 'file';

export interface Film {
  id: number;
  capsule_id: number;
  title: string;
  director: string;
  duration?: string;
  /** The year it came out, e.g. "2012". */
  release_year?: string | null;
  thumbnail_url?: string;
  description?: string;
  theme?: string;

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

/** A written section of the behind-the-scenes page. */
export interface BtsSection {
  id: number;
  capsule_id: number;
  heading?: string | null;
  body: string;
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
  /** The story's LGN Spark: its YouTube interview. Public placement TBD. */
  spark_url?: string | null;
  /** The behind-the-scenes page ("How this film was made"). Photo `url`s are
   *  API-relative. */
  bts_photos?: CapsulePhoto[];
  bts_hero?: CapsulePhoto | null;
  bts_logo?: CapsulePhoto | null;
  bts_copyright?: string | null;
  /** One "Role: Name, Name" per line; a blank line starts a new group. */
  bts_credits?: string | null;
  bts_sections?: BtsSection[];
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
  description?: string | null;
  is_active: boolean;
  /** Scheduled go-live time, ISO-8601 **naive UTC** (no `Z`, no offset). */
  publish_at?: string | null;
  /** Server-derived, read-only: `is_active OR publish_at <= utcnow()`. */
  is_published?: boolean;
}

/** About pages (admin-editable). */
export type AboutPageKey = 'life-numbers' | 'lgn-cinema' | 'faqs' | 'credits';
export type PersonCategory = 'team' | 'board' | 'advisory';

export interface AboutSection {
  id: number;
  page: AboutPageKey;
  heading: string | null;
  body: string | null;
  position: number;
}

export interface Person {
  id: number;
  category: PersonCategory;
  name: string;
  role: string | null;
  bio: string | null;
  /** "A film that moved him" -- the words before the colon. */
  film_lead: string | null;
  film_title: string | null;
  film_year: string | null;
  film_url: string | null;
  position: number;
}

export interface AboutContent {
  sections: AboutSection[];
  people: Person[];
}
