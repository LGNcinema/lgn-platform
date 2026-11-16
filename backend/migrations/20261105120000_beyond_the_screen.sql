-- Beyond the Screen: search any film (TMDB) and Reflect / Practice on it, plus the
-- admin on/off switch for the whole feature.
--
-- external_films   LGN's settings for one outside film, keyed by TMDB id. Nothing
--                  from TMDB itself is stored (their terms), only LGN's choices.
-- film_prompts     The questions / actions. external_film_id NULL = the universal
--                  set; otherwise a film's own set (source 'lgn' or 'ai').
-- film_feedback    The admin inbox (suggestions, "something's off", "can't find it").
-- site_settings    Site-wide switches flipped in the admin. No row = the server's
--                  default (BEYOND_THE_SCREEN_ENABLED, off unless set), so the
--                  feature stays OFF everywhere until someone turns it on.
--
-- Enum-like columns carry CHECK constraints, as the earlier migrations do.
--
-- Additive only, so it is safe to run before the code that uses it is deployed;
-- idempotent, so a re-run changes nothing.

CREATE TABLE IF NOT EXISTS external_films (
    id SERIAL PRIMARY KEY,
    tmdb_id INTEGER NOT NULL,
    handling VARCHAR(16) NOT NULL DEFAULT 'normal' CHECK (handling IN ('normal', 'universal_only', 'held')),
    care_note TEXT NULL,
    logline TEXT NULL,
    ai_status VARCHAR(16) NOT NULL DEFAULT 'none' CHECK (ai_status IN ('none', 'pending', 'ready', 'unavailable', 'failed')),
    ai_attempted_at TIMESTAMP NULL,
    ai_model VARCHAR(100) NULL,
    ai_prompt_version INTEGER NULL,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Unique, and the one index on it (the model's `unique=True, index=True`).
CREATE UNIQUE INDEX IF NOT EXISTS ix_external_films_tmdb_id ON external_films (tmdb_id);

CREATE TABLE IF NOT EXISTS film_prompts (
    id SERIAL PRIMARY KEY,
    external_film_id INTEGER NULL REFERENCES external_films(id) ON DELETE CASCADE,
    source VARCHAR(16) NOT NULL CHECK (source IN ('universal', 'lgn', 'ai')),
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('reflect', 'practice')),
    dimension VARCHAR(16) NOT NULL CHECK (dimension IN ('self', 'neighbor', 'world')),
    position INTEGER NOT NULL DEFAULT 0,
    title TEXT NULL,
    content TEXT NULL,
    steps TEXT NULL,
    tips TEXT NULL,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_film_prompts_external_film_id ON film_prompts (external_film_id);

CREATE TABLE IF NOT EXISTS film_feedback (
    id SERIAL PRIMARY KEY,
    external_film_id INTEGER NULL REFERENCES external_films(id) ON DELETE SET NULL,
    tmdb_id INTEGER NULL,
    film_title VARCHAR NULL,
    type VARCHAR(16) NOT NULL CHECK (type IN ('suggestion', 'something_off', 'not_found')),
    kind VARCHAR(16) NULL CHECK (kind IS NULL OR kind IN ('reflect', 'practice')),
    dimension VARCHAR(16) NULL CHECK (dimension IS NULL OR dimension IN ('self', 'neighbor', 'world')),
    message TEXT NULL,
    suggested_text TEXT NULL,
    film_year_typed VARCHAR(16) NULL,
    email VARCHAR(254) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
    key VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT now()
);

-- The universal set (the questions every film falls back to). Placeholder copy
-- until LGN's own is written; editable in the admin. Only when there are none.
INSERT INTO film_prompts (source, kind, dimension, position, title, content, steps, tips)
SELECT * FROM (VALUES
    ('universal', 'reflect', 'self', 1, 'Self question', 'What moment from this film stayed with you, and what does it stir up in you?', NULL, NULL),
    ('universal', 'reflect', 'neighbor', 1, 'Neighbor question', 'Who in your life would you want to talk about this film with, and what would you want to ask them?', NULL, NULL),
    ('universal', 'reflect', 'world', 1, 'World question', 'What does this film say about the world we share, and what might it be asking of us?', NULL, NULL),
    ('universal', 'practice', 'self', 1, 'Sit with it', NULL, 'Set a timer for five minutes.
Write down the one moment from the film you keep returning to.
Notice what it asks of you, without trying to fix anything.', 'Keep it small. One honest sentence is enough.'),
    ('universal', 'practice', 'neighbor', 1, 'Take it to someone', NULL, 'Choose one person you trust.
Tell them one moment from the film and why it stayed with you.
Ask what they noticed, then listen without correcting.', 'You don''t need them to have seen it. Start with the moment.'),
    ('universal', 'practice', 'world', 1, 'Carry it outward', NULL, 'Name one small, concrete action this film nudges you toward.
Do it this week.
Write down, or tell someone, what happened.', 'Small and real beats big and imagined.')
) AS v(source, kind, dimension, position, title, content, steps, tips)
WHERE NOT EXISTS (SELECT 1 FROM film_prompts WHERE source = 'universal');
