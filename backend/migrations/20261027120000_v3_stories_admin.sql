-- V3 stories admin: Self / Neighbor / World for Reflect and Practice, the
-- story-level copy that goes with them, the LGN Spark link, behind-the-scenes
-- photos, and two storyboard fields.
--
-- capsules.reflect_intro    One introduction for the whole Reflect tab (it used
--                           to live on each reflection; the first one's moves
--                           here).
-- capsules.practice_title   The Practice tab's main title / intro line.
-- capsules.spark_url        The story's "LGN Spark": its YouTube interview.
--                           Stored now; its place on the public page is TBD.
-- reflections.dimension     self / neighbor / world. A dimension can hold
--                           several questions; the first (lowest id) is the
--                           featured one.
-- practices.dimension       self / neighbor / world, one practice each.
-- practices.tips            Optional tips shown with a practice.
-- storyboard_submissions.dimension     Set by the reviewer when approving.
-- storyboard_submissions.author_email  Optional, from the add form, only for
--                           asking the author about edits. Never public.
-- capsule_photos            Behind-the-scenes photos (and room for other kinds
--                           later). Shrunk in the browser before upload, so they
--                           live in the row like storyboard photos.

ALTER TABLE capsules
    ADD COLUMN IF NOT EXISTS reflect_intro TEXT NULL,
    ADD COLUMN IF NOT EXISTS practice_title TEXT NULL,
    ADD COLUMN IF NOT EXISTS spark_url TEXT NULL;

ALTER TABLE reflections
    ADD COLUMN IF NOT EXISTS dimension VARCHAR(16) NULL;

ALTER TABLE practices
    ADD COLUMN IF NOT EXISTS dimension VARCHAR(16) NULL,
    ADD COLUMN IF NOT EXISTS tips TEXT NULL;

ALTER TABLE storyboard_submissions
    ADD COLUMN IF NOT EXISTS dimension VARCHAR(16) NULL,
    ADD COLUMN IF NOT EXISTS author_email VARCHAR(254) NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reflections_dimension_check') THEN
        ALTER TABLE reflections ADD CONSTRAINT reflections_dimension_check
            CHECK (dimension IS NULL OR dimension IN ('self', 'neighbor', 'world'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'practices_dimension_check') THEN
        ALTER TABLE practices ADD CONSTRAINT practices_dimension_check
            CHECK (dimension IS NULL OR dimension IN ('self', 'neighbor', 'world'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storyboard_submissions_dimension_check') THEN
        ALTER TABLE storyboard_submissions ADD CONSTRAINT storyboard_submissions_dimension_check
            CHECK (dimension IS NULL OR dimension IN ('self', 'neighbor', 'world'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS capsule_photos (
    id SERIAL PRIMARY KEY,
    capsule_id INTEGER NOT NULL REFERENCES capsules (id) ON DELETE CASCADE,
    kind VARCHAR(16) NOT NULL DEFAULT 'bts' CHECK (kind IN ('bts')),
    position INTEGER NOT NULL DEFAULT 0,
    image BYTEA NOT NULL,
    caption TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS ix_capsule_photos_capsule ON capsule_photos (capsule_id, kind, position);

-- The Reflect introduction moves up to the story: the first reflection that
-- has one gives it.
UPDATE capsules c
SET reflect_intro = r.introduction
FROM (
    SELECT DISTINCT ON (capsule_id) capsule_id, introduction
    FROM reflections
    WHERE introduction IS NOT NULL AND btrim(introduction) <> ''
    ORDER BY capsule_id, id
) r
WHERE c.id = r.capsule_id AND c.reflect_intro IS NULL;

-- Existing reflections and practices take Self / Neighbor / World in their
-- order (what the V3 site already shows them as), anything past the third
-- joining World.
WITH ranked AS (
    SELECT id, row_number() OVER (PARTITION BY capsule_id ORDER BY id) AS n
    FROM reflections
    WHERE dimension IS NULL
)
UPDATE reflections r
SET dimension = CASE ranked.n WHEN 1 THEN 'self' WHEN 2 THEN 'neighbor' ELSE 'world' END
FROM ranked
WHERE r.id = ranked.id;

WITH ranked AS (
    SELECT id, row_number() OVER (PARTITION BY capsule_id ORDER BY id) AS n
    FROM practices
    WHERE dimension IS NULL
)
UPDATE practices p
SET dimension = CASE ranked.n WHEN 1 THEN 'self' WHEN 2 THEN 'neighbor' ELSE 'world' END
FROM ranked
WHERE p.id = ranked.id;
