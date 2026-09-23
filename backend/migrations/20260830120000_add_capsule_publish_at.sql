-- Many published capsules + scheduled publishing.
--
-- The old product rule was "exactly one live capsule": activating one capsule
-- demoted every other row to is_active = FALSE. That rule is gone. The public
-- site now shows every published capsule as a tab, and the "current" capsule is
-- simply the published one with the greatest `month` (VARCHAR 'YYYY-MM', so
-- lexical ordering is chronological).
--
-- `is_active` keeps its column name but now means PUBLISHED. It is no longer
-- exclusive: many rows may have it set at once. The name is retained purely to
-- avoid a rename migration against production.
--
-- ---------------------------------------------------------------------------
-- THE PUBLICATION RULE (derived at read time -- there is no cron job and no
-- background worker; nothing ever flips is_active on a schedule):
--
--     published  ==  is_active = TRUE
--                    OR (publish_at IS NOT NULL AND publish_at <= now() AT TIME ZONE 'utc')
--
-- The API evaluates this on every read (Capsule.is_published in
-- backend/app/models.py), so a scheduled capsule becomes public on the first
-- request after its publish_at passes. Anything not matching this rule -- a
-- draft, or a capsule whose publish_at is still in the future -- is invisible
-- to the public API entirely: absent from GET /api/capsules and 404 from
-- GET /api/capsules/{id}, which matters because a capsule detail carries the
-- film's video_id and video_hash.
-- ---------------------------------------------------------------------------
--
-- Idempotent-safe (IF NOT EXISTS) in the style of the baseline migration, so it
-- can be re-run against a database where SQLAlchemy already created the column.

-- Scheduled go-live time. NULL = never scheduled. Stored WITHOUT TIME ZONE and
-- written as naive UTC by the API, matching capsules.created_at.
ALTER TABLE capsules ADD COLUMN IF NOT EXISTS publish_at TIMESTAMP WITHOUT TIME ZONE;

COMMENT ON COLUMN capsules.publish_at IS
    'Scheduled go-live, naive UTC. Published == is_active OR (publish_at IS NOT NULL AND publish_at <= utcnow()); evaluated at read time, no cron.';

COMMENT ON COLUMN capsules.is_active IS
    'PUBLISHED flag. Not exclusive: many capsules may be published at once. Historical column name.';

-- Supports the published lookup. The rule is an OR across two columns, so a
-- single partial index cannot serve it (and now() is not IMMUTABLE, so it
-- cannot appear in an index predicate anyway). Two plain indexes let the
-- planner satisfy either arm of the OR and then order by month.
CREATE INDEX IF NOT EXISTS ix_capsules_is_active_month ON capsules (is_active, month DESC);
CREATE INDEX IF NOT EXISTS ix_capsules_publish_at ON capsules (publish_at);
