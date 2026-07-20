-- Baseline schema for existing production database tables
-- We use IF NOT EXISTS so that this migration can run on production without erroring if the tables were already created by SQLAlchemy.

CREATE TABLE IF NOT EXISTS capsules (
    id SERIAL PRIMARY KEY,
    month VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_capsules_month ON capsules (month);
CREATE INDEX IF NOT EXISTS ix_capsules_id ON capsules (id);

CREATE TABLE IF NOT EXISTS films (
    id SERIAL PRIMARY KEY,
    capsule_id INTEGER NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    director VARCHAR NOT NULL,
    duration VARCHAR,
    video_url VARCHAR NOT NULL,
    thumbnail_url VARCHAR,
    description TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uix_films_capsule_id ON films (capsule_id);
CREATE INDEX IF NOT EXISTS ix_films_id ON films (id);

CREATE TABLE IF NOT EXISTS reflections (
    id SERIAL PRIMARY KEY,
    capsule_id INTEGER NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    content TEXT NOT NULL,
    author VARCHAR,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_reflections_id ON reflections (id);

CREATE TABLE IF NOT EXISTS gatherings (
    id SERIAL PRIMARY KEY,
    capsule_id INTEGER NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    description TEXT,
    date_str VARCHAR NOT NULL,
    location VARCHAR NOT NULL,
    rsvp_link VARCHAR
);
CREATE INDEX IF NOT EXISTS ix_gatherings_id ON gatherings (id);

CREATE TABLE IF NOT EXISTS practices (
    id SERIAL PRIMARY KEY,
    capsule_id INTEGER NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    description TEXT,
    steps TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_practices_id ON practices (id);

CREATE TABLE IF NOT EXISTS contact_submissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    email VARCHAR NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_contact_submissions_id ON contact_submissions (id);

CREATE TABLE IF NOT EXISTS film_submissions (
    id SERIAL PRIMARY KEY,
    title VARCHAR NOT NULL,
    director VARCHAR NOT NULL,
    duration VARCHAR,
    link VARCHAR NOT NULL,
    synopsis TEXT,
    email VARCHAR NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_film_submissions_id ON film_submissions (id);

CREATE TABLE IF NOT EXISTS user_reflections (
    id SERIAL PRIMARY KEY,
    capsule_id INTEGER NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
    email VARCHAR,
    answers TEXT NOT NULL,
    submitted_to_lgn BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_user_reflections_id ON user_reflections (id);
