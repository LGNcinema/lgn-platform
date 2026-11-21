-- For Filmmakers (Figma "FOR FILMMAKERS", "—CAST/CREW"): requests to claim a
-- film's guide, or for cast and crew to share how it was made. Reviewed in the
-- admin's Filmmaker requests; nothing on the site changes until LGN confirms
-- who sent it.
--
-- role         director | writer | producer (send work_link) or cast-crew
--              (send message).
-- capsule_id   The published story picked in the form's search, if any.
-- status       new -> replied -> closed.
--
-- Additive only, so it is safe to run before the code that uses it is deployed.

CREATE TABLE IF NOT EXISTS filmmaker_requests (
    id SERIAL PRIMARY KEY,
    film_title TEXT NOT NULL,
    film_year TEXT NULL,
    capsule_id INTEGER NULL REFERENCES capsules(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('director', 'writer', 'producer', 'cast-crew')),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    work_link TEXT NULL,
    message TEXT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'replied', 'closed')),
    admin_note TEXT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_filmmaker_requests_status ON filmmaker_requests (status, created_at);
