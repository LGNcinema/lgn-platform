-- The film's release year, shown on the film page with the director and
-- runtime (Figma V3 film frames: "2012 / Stephen Chbosky / 1h 43m").
-- Additive only, so it is safe to run before the code that uses it is deployed.

ALTER TABLE films ADD COLUMN IF NOT EXISTS release_year TEXT NULL;
