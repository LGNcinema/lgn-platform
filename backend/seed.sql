-- Disable triggers to avoid foreign key constraints during seeding if needed
-- Though since we insert in order, it should be fine.

-- Seed Capsule
INSERT INTO capsules (
    id, month, title, description, is_active, pre_watch_prompt, pre_watch_supporting_text
) VALUES (
    1, 
    '2026-07', 
    'Lightpoles', 
    'A community platform that offers one short film each month as common ground for reflection, discussion, and practice.', 
    true, 
    'Who comes to mind when you hear the phrase “a light in the darkness”? What did they do that made them a light?',
    'You don’t need to write anything down. Simply carry the question with you as you watch.'
) ON CONFLICT (month) DO UPDATE SET 
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    pre_watch_prompt = EXCLUDED.pre_watch_prompt,
    pre_watch_supporting_text = EXCLUDED.pre_watch_supporting_text;

-- Seed Film
-- Video is stored as a provider-tagged source. The Vimeo embed the studio sent
-- was:
--   <iframe src="https://player.vimeo.com/video/1052574030?h=53c90178cb&amp;title=0&amp;byline=0&amp;portrait=0&amp;badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479" ...></iframe>
-- which normalizes to provider 'vimeo', id 1052574030, hash 53c90178cb.
-- video_url is left NULL: the provider fields fully describe this film.
INSERT INTO films (
    capsule_id, title, director, duration,
    video_url, video_provider, video_id, video_hash,
    video_aspect_ratio, video_duration_seconds, captions_url,
    thumbnail_url, description, theme, bts_text, screenplay_text
) VALUES (
    1,
    'For the Love of God!',
    'TBD',
    '10 min',
    NULL,
    'vimeo',
    '1052574030',
    '53c90178cb',
    '16 / 9',
    570,   -- video_duration_seconds, from Vimeo oEmbed
    NULL,  -- captions_url
    -- Real poster frame from the film, via Vimeo oEmbed at width=1280. The
    -- content hash in this URL is not derivable from the video id; refresh it
    -- with:  curl 'https://vimeo.com/api/oembed.json?url=https://vimeo.com/1052574030/53c90178cb&width=1280'
    'https://i.vimeocdn.com/video/2092323335-5ccbfc251feefb8e6eda1aa87165cd5a842456682cba26398f8925dd3f5ae655-d_1280?region=us',
    'A short film exploring purpose and light in the darkness.',
    'Purpose',
    'True story of Jon, the filmmaking process, and Cast/Crew',
    'Script text goes here.'
) ON CONFLICT (capsule_id) DO UPDATE SET
    title = EXCLUDED.title,
    director = EXCLUDED.director,
    duration = EXCLUDED.duration,
    video_url = EXCLUDED.video_url,
    video_provider = EXCLUDED.video_provider,
    video_id = EXCLUDED.video_id,
    video_hash = EXCLUDED.video_hash,
    video_aspect_ratio = EXCLUDED.video_aspect_ratio,
    video_duration_seconds = EXCLUDED.video_duration_seconds,
    captions_url = EXCLUDED.captions_url,
    thumbnail_url = EXCLUDED.thumbnail_url,
    description = EXCLUDED.description,
    theme = EXCLUDED.theme,
    bts_text = EXCLUDED.bts_text,
    screenplay_text = EXCLUDED.screenplay_text;

-- Seed Reflections
-- Copy follows the Campfire REFLECT frame (design/exports/2026-09-28). The page
-- takes its heading from the first reflection's `introduction` and numbers one
-- prompt per reflection's `content`. The frame lists a third question, but it
-- is a verbatim repeat of the second -- a copy-paste slip -- so only the two
-- distinct questions are seeded.
INSERT INTO reflections (capsule_id, title, introduction, content) VALUES
(1, 'Reflection 1', 'Something about reflections—', 'What moment in the film stayed with you the longest?'),
(1, 'Reflection 2', NULL, 'Is there a grief or loss you’ve been walking with?');

-- Seed Discussion Circles
INSERT INTO discussion_circles (capsule_id, title, opening_round, discuss_prompts, closing_question) VALUES
(1, 'Circle 1: Light and Darkness', 'Each person shares the first word that comes to mind when they hear “light,” followed by the first word that comes to mind when they hear “darkness.”', E'What patterns or differences do you notice?\nWhen can light expose, overwhelm, or harm?\nWhen can darkness offer rest, privacy, mystery, or protection?', 'What kind of light do you want to bring into the lives around you?'),
(1, 'Circle 2: Resilience and Mourning', 'Choose one: share a time when you had to endure, or a time when you allowed yourself to mourn.', E'What did the experience reveal about what mattered to you?\nWhen is resilience life-giving?\nWhen can resilience become a way of avoiding grief?\nWhat can mourning teach us that achievement cannot?', 'What does the way you respond to difficulty reveal about your values?'),
(1, 'Circle 3: Purpose and Disconnection', 'Share a time when you felt purposeful—or a time when you felt disconnected from purpose.', E'What was present or absent in that season?\nConsider: Belonging, Responsibility, Challenge, Freedom, Hope, Contribution, Being needed.', 'Is purpose something we find, choose, receive, or practice?');

-- Seed Practices
INSERT INTO practices (capsule_id, title, description, steps) VALUES
(1, 'Practice 1: Return', 'Choose one practice for the month, move through all three, or choose your own.', E'Revisit something you loved when you were younger—something that made you lose track of time: an instrument, game, sport, craft, place, collection, or curiosity.\nSpend at least twenty uninterrupted minutes with it.\nAfterward, ask yourself:\nWhat part of me returned?\nWhat did I value about this before anyone told me whether it was useful?\nIs there something here I want to carry into my life now?'),
(1, 'Practice 2: Respond', NULL, E'Bring one person to mind. Set a three-minute timer and give them your uninterrupted attention—not to solve them, but to notice them.\nAsk yourself:\nWhat might they be carrying?\nWhat might they need?\nWhat is one genuine action I could take today?\nName one large need in their life and scale it down to one small action you can take this month.\n\nExample: “My father is sick and I want him to feel better” might become: “I’ll call him and tell him one of my favorite memories of us.”'),
(1, 'Practice 3: Join', NULL, E'Choose a need in your community that matters to you.\nTake one small step toward it:\nGive an hour\nOffer a skill\nAttend something\nHelp a neighbor\nInvite someone to participate with you\nYou might also invite someone who would welcome connection to join you in an activity that once gave you joy.');

-- ---------------------------------------------------------------------------
-- Storyboard sample stories for Lightpoles (capsule 1). LOCAL DEVELOPMENT ONLY.
--
-- Lightpoles is 2026-07, so its month has ended and its storyboard is revealed.
-- Rows 1-4 are what the public wall should show. Rows 5 and 6 are here to
-- prove the filter, and must NEVER appear:
--   5  approved, but the author did not consent to sharing
--   6  consented, but not yet approved
-- If either shows up on the page, the read path is broken.
-- ---------------------------------------------------------------------------
INSERT INTO storyboard_submissions
    (id, capsule_id, content, author_name, author_location, is_anonymous, is_approved, consent_to_share, created_at)
VALUES
    (1, 1, 'My grandfather kept the porch light on every night after my grandmother died. He said it was so she could find her way home. I didn''t understand it until I watched this.',
        'Maya', 'Anaheim, CA', false, true, true, '2026-07-04 19:12:00'),
    (2, 1, 'I have been the one who needed a light for most of this year. Watching two people just sit together and look at the same horizon reminded me that I don''t have to fix anything to be there for someone.',
        NULL, NULL, true, true, true, '2026-07-09 21:40:00'),
    (3, 1, 'Called my brother for the first time in two years after this. We talked for an hour about nothing. It was the best hour I''ve had in a long time.',
        'Daniel', 'Fullerton, CA', false, true, true, '2026-07-15 08:05:00'),
    (4, 1, 'The quiet in this film stayed with me. I''ve started leaving my phone in another room on Sunday mornings.',
        'Grace', 'Irvine, CA', false, true, true, '2026-07-22 11:30:00'),
    (5, 1, 'PRIVATE -- approved but no consent. This must not appear on the public storyboard.',
        'Sam', NULL, false, true, false, '2026-07-24 16:00:00'),
    (6, 1, 'PENDING -- consented but not approved. This must not appear on the public storyboard.',
        'Lee', NULL, false, false, true, '2026-07-28 10:15:00')
ON CONFLICT (id) DO NOTHING;

-- Rows above carry explicit ids, so move the sequence past them or the next
-- real submission collides on the primary key.
SELECT setval(
    pg_get_serial_sequence('storyboard_submissions', 'id'),
    GREATEST((SELECT max(id) FROM storyboard_submissions), 1)
);
