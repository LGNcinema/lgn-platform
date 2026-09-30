-- Lightpoles: the Reflect copy from the Campfire REFLECT frame
-- (design/exports/2026-09-28/[CAMPFIRE]-REFLECT).
--
-- DATA, not schema -- a deliberate exception. Routine content edits belong in
-- the admin portal. This one is a one-time correction that has to land with the
-- Campfire redesign, and as a migration every database converges on exactly the
-- same text: production, each preview branch, and local.
--
-- The page takes its heading from the first reflection's `introduction` and
-- numbers one prompt per reflection's `content`. The frame lists a third
-- question that is a verbatim repeat of the second (a copy-paste slip), so only
-- the two distinct questions are written.
--
-- Keyed on the capsule (month + title), never on row ids: the ids differ between
-- production, preview branches and local databases. Lightpoles' reflections are
-- replaced wholesale, which also removes a stray production row ("In Sofia's
-- lens, the forest...") that belonged to another film. Nothing references
-- reflections by id.
--
-- Where Lightpoles doesn't exist this is a no-op -- e.g. a fresh local
-- database, where migrations run before seed.sql (which carries the same copy).

DELETE FROM reflections
WHERE capsule_id IN (
    SELECT id FROM capsules WHERE month = '2026-07' AND title = 'Lightpoles'
);

INSERT INTO reflections (capsule_id, title, introduction, content)
SELECT capsules.id, v.title, v.introduction, v.content
FROM capsules
CROSS JOIN (VALUES
    (1, 'Reflection 1', 'Something about reflections—', 'What moment in the film stayed with you the longest?'),
    (2, 'Reflection 2', NULL,                           'Is there a grief or loss you’ve been walking with?')
) AS v (position, title, introduction, content)
WHERE capsules.month = '2026-07' AND capsules.title = 'Lightpoles'
ORDER BY v.position;
