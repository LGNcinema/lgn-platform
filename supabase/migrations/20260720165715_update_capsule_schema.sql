-- Add new columns to existing tables
ALTER TABLE capsules ADD COLUMN pre_watch_prompt VARCHAR;
ALTER TABLE capsules ADD COLUMN pre_watch_supporting_text TEXT;

ALTER TABLE films ADD COLUMN theme VARCHAR;
ALTER TABLE films ADD COLUMN bts_text TEXT;
ALTER TABLE films ADD COLUMN screenplay_text TEXT;

ALTER TABLE reflections ADD COLUMN introduction TEXT;

-- Create discussion_circles table (replacing gatherings)
CREATE TABLE discussion_circles (
    id SERIAL PRIMARY KEY,
    capsule_id INTEGER NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    opening_round TEXT,
    discuss_prompts TEXT,
    closing_question TEXT
);
CREATE INDEX ix_discussion_circles_id ON discussion_circles (id);

-- Drop the old gatherings table
DROP TABLE IF EXISTS gatherings CASCADE;

-- Create storyboard_submissions table
CREATE TABLE storyboard_submissions (
    id SERIAL PRIMARY KEY,
    capsule_id INTEGER NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
    content TEXT,
    media_url VARCHAR,
    author_name VARCHAR,
    author_location VARCHAR,
    author_age VARCHAR,
    is_anonymous BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);
CREATE INDEX ix_storyboard_submissions_id ON storyboard_submissions (id);
