-- Store a film's video as a provider-tagged source rather than a bare URL string,
-- so the platform can move from Vimeo embeds to Mux / self-hosted files later
-- without changing the frontend contract.
--
-- Idempotent-safe (IF NOT EXISTS) in the style of the baseline migration, so it
-- can be re-run against a database where SQLAlchemy already created the columns.

ALTER TABLE films ADD COLUMN IF NOT EXISTS video_provider VARCHAR;          -- 'vimeo' | 'mux' | 'youtube' | 'file'; NULL = infer from video_url
ALTER TABLE films ADD COLUMN IF NOT EXISTS video_id VARCHAR;                -- provider asset id (Vimeo numeric id, Mux playback id)
ALTER TABLE films ADD COLUMN IF NOT EXISTS video_hash VARCHAR;              -- Vimeo private/unlisted `h=` param; NULL for other providers
ALTER TABLE films ADD COLUMN IF NOT EXISTS video_aspect_ratio VARCHAR;      -- e.g. '16 / 9'; frontend defaults to '16 / 9' when NULL
ALTER TABLE films ADD COLUMN IF NOT EXISTS video_duration_seconds INTEGER;  -- runtime badge before the player loads
ALTER TABLE films ADD COLUMN IF NOT EXISTS captions_url VARCHAR;            -- future WebVTT track

-- video_url stays for backward compatibility and for the 'file' provider, but a
-- Vimeo-provider film is fully described by video_provider + video_id + video_hash,
-- so the column is no longer required.
ALTER TABLE films ALTER COLUMN video_url DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- Backfill. Deliberately simple: cover the common Vimeo URL shapes and fall
-- back to 'file' for everything else that has a URL. Rows the regexes miss keep
-- video_provider = NULL and the frontend infers from video_url as before, so a
-- partial backfill is safe.
-- ---------------------------------------------------------------------------

-- 1. https://player.vimeo.com/video/<id>?h=<hash>
UPDATE films
SET video_provider = 'vimeo',
    video_id       = COALESCE(video_id, substring(video_url from 'player\.vimeo\.com/video/([0-9]+)')),
    video_hash     = COALESCE(video_hash, substring(video_url from '[?&]h=([0-9A-Za-z]+)'))
WHERE video_provider IS NULL
  AND video_url ~ 'player\.vimeo\.com/video/[0-9]+';

-- 2. https://vimeo.com/<id> or https://vimeo.com/<id>/<hash>
UPDATE films
SET video_provider = 'vimeo',
    video_id       = COALESCE(video_id, substring(video_url from 'vimeo\.com/([0-9]+)')),
    video_hash     = COALESCE(video_hash, substring(video_url from 'vimeo\.com/[0-9]+/([0-9A-Za-z]+)'))
WHERE video_provider IS NULL
  AND video_url ~ 'vimeo\.com/[0-9]+';

-- 3. YouTube watch/embed/short links.
UPDATE films
SET video_provider = 'youtube',
    video_id       = COALESCE(
                        video_id,
                        substring(video_url from '[?&]v=([0-9A-Za-z_-]+)'),
                        substring(video_url from 'youtu\.be/([0-9A-Za-z_-]+)'),
                        substring(video_url from 'youtube\.com/(?:embed|shorts|v)/([0-9A-Za-z_-]+)')
                     )
WHERE video_provider IS NULL
  AND video_url ~ '(youtube\.com|youtu\.be)';

-- 4. Everything else with a URL is treated as a directly-playable file.
UPDATE films
SET video_provider = 'file'
WHERE video_provider IS NULL
  AND video_url IS NOT NULL
  AND video_url <> '';

-- Default aspect ratio for any row that now has a provider but no ratio.
UPDATE films
SET video_aspect_ratio = '16 / 9'
WHERE video_aspect_ratio IS NULL
  AND video_provider IS NOT NULL;
