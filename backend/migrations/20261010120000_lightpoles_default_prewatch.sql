-- Lightpoles: use the universal pre-watch line.
--
-- DATA, not schema -- like 20260929120000_lightpoles_reflect_copy.sql, a
-- one-time content correction, so every database ends up the same.
--
-- The pre-watch card shows "Before you press play, take a breath—" (the
-- [CAMPFIRE]-WATCH frame's wording) unless a story sets its own prompt in the
-- admin portal, which then replaces it. Lightpoles carried a custom question
-- and a supporting line written for that question; clearing both makes it
-- show the universal line. Any story can still set its own from Details.
--
-- Keyed on the capsule (month + title), never on row ids. A no-op where
-- Lightpoles doesn't exist.

UPDATE capsules
SET pre_watch_prompt = NULL,
    pre_watch_supporting_text = NULL
WHERE month = '2026-07' AND title = 'Lightpoles';
