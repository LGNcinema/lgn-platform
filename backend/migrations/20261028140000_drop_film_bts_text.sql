-- Drop the film's retired long-form text. Behind-the-scenes text moved to
-- bts_sections in 20261028130000; the screenplay excerpt is no longer shown
-- anywhere. Run only once the code from that change is deployed: earlier
-- code still reads these columns.

ALTER TABLE films
    DROP COLUMN IF EXISTS bts_text,
    DROP COLUMN IF EXISTS screenplay_text;
