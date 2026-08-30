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
INSERT INTO reflections (capsule_id, title, introduction, content) VALUES
(1, 'Reflection 1: The Path We Didn’t Choose', 'Take these at your own pace. Keep your answers private, record them for yourself, or share them with the community later—the choice is yours.', 'Jon takes a small step toward a purpose he did not choose for himself. When has a person, responsibility, or unexpected need drawn you down a path you would not have chosen? What did you resist? What did you discover?'),
(1, 'Reflection 2: What Makes You Come Alive', NULL, 'Remember a time when you felt especially alive, useful, or needed. What were you doing? Who else was affected? What might that moment reveal about what matters to you?'),
(1, 'Reflection 3: What It’s For', NULL, 'Looking at the lightpole in daylight, Jon says, “Takes dark to know what it’s for.” Has a difficult season ever revealed the value of something you had overlooked—a person, a practice, a belief, or a part of yourself? What did the darkness help you see?');

-- Seed Discussion Circles
INSERT INTO discussion_circles (capsule_id, title, opening_round, discuss_prompts, closing_question) VALUES
(1, 'Circle 1: Light and Darkness', 'Each person shares the first word that comes to mind when they hear “light,” followed by the first word that comes to mind when they hear “darkness.”', 'What patterns or differences do you notice?\nWhen can light expose, overwhelm, or harm?\nWhen can darkness offer rest, privacy, mystery, or protection?', 'What kind of light do you want to bring into the lives around you?'),
(1, 'Circle 2: Resilience and Mourning', 'Choose one: share a time when you had to endure, or a time when you allowed yourself to mourn.', 'What did the experience reveal about what mattered to you?\nWhen is resilience life-giving?\nWhen can resilience become a way of avoiding grief?\nWhat can mourning teach us that achievement cannot?', 'What does the way you respond to difficulty reveal about your values?'),
(1, 'Circle 3: Purpose and Disconnection', 'Share a time when you felt purposeful—or a time when you felt disconnected from purpose.', 'What was present or absent in that season?\nConsider: Belonging, Responsibility, Challenge, Freedom, Hope, Contribution, Being needed.', 'Is purpose something we find, choose, receive, or practice?');

-- Seed Practices
INSERT INTO practices (capsule_id, title, description, steps) VALUES
(1, 'Practice 1: Return', 'Choose one practice for the month, move through all three, or choose your own.', 'Revisit something you loved when you were younger—something that made you lose track of time: an instrument, game, sport, craft, place, collection, or curiosity.\nSpend at least twenty uninterrupted minutes with it.\nAfterward, ask yourself:\nWhat part of me returned?\nWhat did I value about this before anyone told me whether it was useful?\nIs there something here I want to carry into my life now?'),
(1, 'Practice 2: Respond', NULL, 'Bring one person to mind. Set a three-minute timer and give them your uninterrupted attention—not to solve them, but to notice them.\nAsk yourself:\nWhat might they be carrying?\nWhat might they need?\nWhat is one genuine action I could take today?\nName one large need in their life and scale it down to one small action you can take this month.\n\nExample: “My father is sick and I want him to feel better” might become: “I’ll call him and tell him one of my favorite memories of us.”'),
(1, 'Practice 3: Join', NULL, 'Choose a need in your community that matters to you.\nTake one small step toward it:\nGive an hour\nOffer a skill\nAttend something\nHelp a neighbor\nInvite someone to participate with you\nYou might also invite someone who would welcome connection to join you in an activity that once gave you joy.');
