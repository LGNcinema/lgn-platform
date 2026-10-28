-- Drop discussion circles. V3 has no Discuss section, the admin console no
-- longer edits them, and the API no longer serves them, so the table and its
-- rows go too. Discussion content, if it comes back, will be designed afresh.

DROP TABLE IF EXISTS discussion_circles;
