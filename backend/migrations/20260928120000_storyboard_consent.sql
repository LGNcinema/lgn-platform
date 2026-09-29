-- Storyboard: an explicit consent flag, and an index for the public read.
--
-- A submission appears on a campfire's public storyboard only when BOTH:
--   consent_to_share  -- the visitor said yes to it being shared (their call)
--   is_approved       -- LGN reviewed it (ours)
-- Neither implies the other. A visitor can share a story privately with LGN
-- without consenting to publication, and consent alone does not publish
-- unreviewed writing to a public page.
--
-- Defaults FALSE so every row that predates this column stays private: nobody
-- consented to a checkbox that did not exist when they wrote.
ALTER TABLE storyboard_submissions
    ADD COLUMN IF NOT EXISTS consent_to_share BOOLEAN NOT NULL DEFAULT FALSE;

-- Every public read filters by capsule.
CREATE INDEX IF NOT EXISTS ix_storyboard_submissions_capsule_id
    ON storyboard_submissions (capsule_id);
