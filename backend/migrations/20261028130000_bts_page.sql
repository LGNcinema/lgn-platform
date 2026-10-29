-- The behind-the-scenes page (Figma v3 "Campfire—bts"): a large picture, the
-- title, copyright and a distributor / production company logo, the credits, a
-- gallery of up to nine photos, and sections of written paragraphs.
--
-- capsules.bts_copyright   The copyright line, e.g. "Copyright © 2026 ...".
-- capsules.bts_credits     One credit per line, "Role: Name, Name"; a blank line
--                          starts a new group.
-- capsule_photos.kind      'bts' (gallery), now also 'hero' (the large picture)
--                          and 'logo' (one of each per story).
-- bts_sections             The written sections: an optional heading and a body,
--                          in `position` order.
--
-- The film's old behind-the-scenes text becomes the first section. Additive
-- only, so it is safe to run before the code that uses it is deployed.

ALTER TABLE capsules
    ADD COLUMN IF NOT EXISTS bts_copyright TEXT NULL,
    ADD COLUMN IF NOT EXISTS bts_credits TEXT NULL;

ALTER TABLE capsule_photos DROP CONSTRAINT IF EXISTS capsule_photos_kind_check;
ALTER TABLE capsule_photos
    ADD CONSTRAINT capsule_photos_kind_check CHECK (kind IN ('bts', 'hero', 'logo'));

CREATE TABLE IF NOT EXISTS bts_sections (
    id SERIAL PRIMARY KEY,
    capsule_id INTEGER NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
    heading TEXT NULL,
    body TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_bts_sections_capsule ON bts_sections (capsule_id, position, id);

INSERT INTO bts_sections (capsule_id, heading, body, position)
SELECT f.capsule_id, 'Behind the Scenes', f.bts_text, 1
FROM films f
WHERE NULLIF(TRIM(f.bts_text), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM bts_sections s WHERE s.capsule_id = f.capsule_id);
