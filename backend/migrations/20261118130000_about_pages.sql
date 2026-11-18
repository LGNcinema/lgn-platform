-- The About pages' text, editable in the admin (Karson's request, 2026-11).
--
-- about_sections   One section of an About page: a heading and its body, in
--                  `position` order. `page` is life-numbers, lgn-cinema, faqs
--                  (heading = question, body = answer) or credits (the small
--                  print under the FAQs). Bodies are plain paragraphs separated
--                  by a blank line; **Lead.** sets a bold lead-in and
--                  [text](https://...) a link.
-- people           The People page: team, board and advisory council
--                  (`category`), each with a role, an optional bio and an
--                  optional "A film that moved them" line.
--
-- Seeded with the copy from the Figma About frames (2026-11). Bios other than
-- Karson's, and one FAQ answer, are placeholders until the real copy arrives. Additive
-- only, so it is safe to run before the code that uses it is deployed.

CREATE TABLE IF NOT EXISTS about_sections (
    id SERIAL PRIMARY KEY,
    page TEXT NOT NULL CHECK (page IN ('life-numbers', 'lgn-cinema', 'faqs', 'credits')),
    heading TEXT NULL,
    body TEXT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_about_sections_page ON about_sections (page, position, id);

CREATE TABLE IF NOT EXISTS people (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('team', 'board', 'advisory')),
    name TEXT NOT NULL,
    role TEXT NULL,
    bio TEXT NULL,
    film_lead TEXT NULL,
    film_title TEXT NULL,
    film_year TEXT NULL,
    film_url TEXT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_people_category ON people (category, position, id);

-- Seed only an empty table, so re-running never duplicates or overwrites edits.
INSERT INTO about_sections (page, heading, body, position)
SELECT v.page, v.heading, v.body, v.position
FROM (VALUES
    ('life-numbers', 'Our belief', 'Every life has worth beyond what numbers can capture.', 1),
    ('life-numbers', 'Our vision', 'A culture of common ground, where life is greater than numbers.', 2),
    ('life-numbers', 'Why “Life > Numbers”?',
     E'Numbers are everywhere: money, data, tech, scores, age, odds, speed. They are powerful tools, but poor masters.\n\nThe phrase has been with our founder, Karson, since he was fifteen and making YouTube videos. It began as a response to likes and subscriber counts. It grew into a philosophy.', 3),
    ('life-numbers', 'How we live it out', 'We build bridges toward that vision. Our first is LGN Cinema.', 4),

    ('lgn-cinema', 'Mission', 'To join films with pathways that lead beyond the screen, toward a fuller regard for ourselves, our neighbors, and the world we share.', 1),
    ('lgn-cinema', 'What it is',
     E'LGN Cinema is a free community resource that gives viewers a next step after a film ends. There are plenty of places to rate a film. This is a place to consider where it might be leading you.\n\n**The Library.** A growing collection of guided reflection and practice for any film. Search for the film you just watched, or help build its page.\n\n**LGN Presents.** One film for all of us to gather around, with questions and practices shaped by its filmmaker. A new one opens on the first Sunday of each month.\n\n**The Storyboard.** Share where a film led you, as our stories come together to shape a larger one.', 2),
    ('lgn-cinema', 'How it works',
     E'A film can move us in many ways. It can lift us up, break our hearts, or help us face something in our own lives.\n\nWe believe being moved, in any of these ways, can lead to a fuller life. But research suggests what a film sets in motion tends to stall unless it has somewhere to go. Watch. Reflect. Practice. is that somewhere.\n\n**Watch.** Look closer. Learn who made the film, why they made it, and how.\n\n**Reflect.** Look inward. Answer three questions: one about yourself, one about your neighbor, one about the world we share.\n\n**Practice.** Live it out. Find three ways to carry the film forward: for you, for a neighbor, for the world.\n\nThere’s no sign-in. Your reflections are private, and nothing you write is saved.', 3),
    ('lgn-cinema', 'Why we built it',
     E'In November 2025 I was at a film festival in Coronado, supporting a friend, when a film called Charliebird screened. It follows a music therapist at a children’s hospital in Texas.\n\nI was deeply moved. I was ready to change something foundational about how I was living. I’d march straight out of the theater to the nearest children’s hospital and, like the therapist in the film, help kids write songs for their parents.\n\nThen I checked my phone. It was 11:30 PM, and under the time was a tough text I’d missed during the screening. Record scratch.\n\nIt was late. I was in a town that wasn’t my own. My hands were already full. And who was I to take this on?\n\nAnd so, there it went.\n\nWho knows where that momentum would have led if it’d had somewhere to go. I only know that losing it led me to build LGN Cinema.\n\n—Karson Utzinger, Founder', 4),

    ('faqs', 'How do we choose films?', 'Placeholder answer. Each month our team watches a wide range of short films and chooses one that opens a conversation worth having. A few sentences here will explain what we look for and who helps choose.', 1),
    ('faqs', 'Do you save what I write?', 'No. Your reflections stay private and aren’t saved anywhere. If you’d like to keep one, copy it and paste it somewhere safe. If you choose to share where a film led you, you can post it to the Storyboard, where others can read it.', 2),
    ('faqs', 'Can I claim my film’s guide?', 'Yes. If you made a film in the Library, we’d love for you to claim its guide and shape it with us. Start on our [For Filmmakers](/?view=for-filmmakers) page.', 3),

    ('credits', 'Credits',
     E'Film details, posters and stills on our Go Beyond pages come from The Movie Database (TMDB). This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.\n\nWhere-to-watch information comes from JustWatch, through TMDB.', 1)
) AS v(page, heading, body, position)
WHERE NOT EXISTS (SELECT 1 FROM about_sections);

INSERT INTO people (category, name, role, bio, film_lead, film_title, film_year, position)
SELECT v.category, v.name, v.role, v.bio, v.film_lead, v.film_title, v.film_year, v.position
FROM (VALUES
    ('team', 'Karson Utzinger', 'Founder and Executive Director',
     'Karson is a writer and director who started building Life > Numbers in 2024 and leads its work day to day. A graduate of Chapman University’s film production program, he has made the short films Unit_01, Godly boy, For the Love of God!, and Lightpoles, LGN’s first original short, based on a true story from Oklahoma. He’s fascinated by the ways the material world reflects the eternal, and he believes cinema can build bridges between people like no other medium.',
     'A film that moved him', 'The Perks of Being a Wallflower', '2012', 1),
    ('team', 'Joëlle Utzinger', 'Brand Design', 'Placeholder bio. Two or three sentences on who Joëlle is, what they do at LGN, and what drew them to the work.', NULL, NULL, NULL, 2),
    ('team', 'Justin Cho', 'Platform Development', 'Placeholder bio. Two or three sentences on who Justin is, what they do at LGN, and what drew them to the work.', NULL, NULL, NULL, 3),
    ('team', 'Cooper Fiedler', 'Platform Development', 'Placeholder bio. Two or three sentences on who Cooper is, what they do at LGN, and what drew them to the work.', NULL, NULL, NULL, 4),
    ('team', 'Stephen Brown', 'Pipeline Production', 'Placeholder bio. Two or three sentences on who Stephen is, what they do at LGN, and what drew them to the work.', NULL, NULL, NULL, 5),
    ('board', 'Kirk Utzinger', 'Board Chair', 'Placeholder bio. Two or three sentences on who Kirk is, what they do at LGN, and what drew them to the work.', NULL, NULL, NULL, 1),
    ('board', 'Dean Kato', 'Director of Board Development', 'Placeholder bio. Two or three sentences on who Dean is, what they do at LGN, and what drew them to the work.', NULL, NULL, NULL, 2),
    ('board', 'Ann Swann', 'Secretary', 'Placeholder bio. Two or three sentences on who Ann is, what they do at LGN, and what drew them to the work.', NULL, NULL, NULL, 3),
    ('board', 'Dominic Carrera', 'Treasurer', 'Placeholder bio. Two or three sentences on who Dominic is, what they do at LGN, and what drew them to the work.', NULL, NULL, NULL, 4),
    ('advisory', 'Emily Timmer', 'Community Building', 'Placeholder bio. Two or three sentences on who Emily is, what they do at LGN, and what drew them to the work.', NULL, NULL, NULL, 1)
) AS v(category, name, role, bio, film_lead, film_title, film_year, position)
WHERE NOT EXISTS (SELECT 1 FROM people);
