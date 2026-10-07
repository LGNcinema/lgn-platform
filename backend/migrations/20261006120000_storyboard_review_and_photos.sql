-- Storyboard: a real review queue, an optional author photo, and a way for an
-- author to check on their own submission.
--
-- reviewed_at   NULL while a submission waits for review. Set when an admin
--               approves or declines it, so the queue can tell "not looked at
--               yet" from "declined" -- is_approved alone can't (both FALSE).
--                 pending  = reviewed_at IS NULL AND NOT is_approved
--                 approved = is_approved
--                 declined = reviewed_at IS NOT NULL AND NOT is_approved
-- photo         The author's optional photo of themselves. The browser shrinks
--               it to a 320px JPEG (~20 KB) before upload, so it lives in the
--               row; the API never selects it in list queries and serves it
--               from its own endpoint.
-- owner_token   A random secret handed back to the author on submit, so their
--               browser can ask "is mine approved yet?" without an account and
--               without anyone else being able to ask about it.

ALTER TABLE storyboard_submissions
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS photo BYTEA NULL,
    ADD COLUMN IF NOT EXISTS owner_token VARCHAR(64) NULL;

-- Already-approved rows were reviewed; date them by their submission.
UPDATE storyboard_submissions
SET reviewed_at = created_at
WHERE is_approved AND reviewed_at IS NULL;

-- The admin review queue reads exactly the pending rows.
CREATE INDEX IF NOT EXISTS ix_storyboard_submissions_pending
    ON storyboard_submissions (capsule_id)
    WHERE reviewed_at IS NULL;
