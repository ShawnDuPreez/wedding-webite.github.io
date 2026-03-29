-- Required song request for RSVP submissions. Legacy rows get an empty string.
ALTER TABLE rsvps
ADD COLUMN IF NOT EXISTS song_request TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN rsvps.song_request IS 'Guest song request for the reception (required in the wedding site form).';
