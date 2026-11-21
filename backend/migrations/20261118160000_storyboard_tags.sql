-- The Storyboard form's new tags (Figma "Add to the Storyboard"):
--
-- engagement    The author's optional engagement tag: watch, reflect or
--               practice.
-- extra_films   Other films the story refers to, beyond its main LGN film: a
--               JSON list of {"title", "year", "capsule_id"}; a typed title
--               has no capsule_id.
--
-- The focus tag reuses the existing `dimension` column, now settable by the
-- author too (the reviewer can still change it). Additive only, so it is safe
-- to run before the code that uses it is deployed.

ALTER TABLE storyboard_submissions
    ADD COLUMN IF NOT EXISTS engagement VARCHAR(16) NULL,
    ADD COLUMN IF NOT EXISTS extra_films TEXT NULL;

ALTER TABLE storyboard_submissions DROP CONSTRAINT IF EXISTS storyboard_submissions_engagement_check;
ALTER TABLE storyboard_submissions
    ADD CONSTRAINT storyboard_submissions_engagement_check
    CHECK (engagement IS NULL OR engagement IN ('watch', 'reflect', 'practice'));
