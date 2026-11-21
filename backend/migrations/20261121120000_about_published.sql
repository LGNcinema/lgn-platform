-- Draft / publish for the About pages: edits to about_sections and people are
-- the working copy the admin previews; the public pages show the snapshot in
-- about_published, taken when an admin presses Publish (one row, id 1).
--
-- Seeded with the current rows, so the public pages don't change when this
-- runs. Additive only, so it is safe to run before the code that uses it is
-- deployed.

CREATE TABLE IF NOT EXISTS about_published (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    content TEXT NOT NULL,
    published_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO about_published (id, content, published_at)
SELECT 1, json_build_object(
    'sections', COALESCE((
        SELECT json_agg(json_build_object(
            'id', id, 'page', page, 'heading', heading, 'body', body, 'position', position
        ) ORDER BY page, position, id)
        FROM about_sections
    ), '[]'::json),
    'people', COALESCE((
        SELECT json_agg(json_build_object(
            'id', id, 'category', category, 'name', name, 'role', role, 'bio', bio,
            'film_lead', film_lead, 'film_title', film_title, 'film_year', film_year,
            'film_url', film_url, 'position', position
        ) ORDER BY category, position, id)
        FROM people
    ), '[]'::json)
)::text, now()
WHERE NOT EXISTS (SELECT 1 FROM about_published);
