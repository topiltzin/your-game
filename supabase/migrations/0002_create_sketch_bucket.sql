-- Private Storage bucket for uploaded photos (inputs/) and generated models (models/).
-- Apply once in the Supabase SQL editor for project lrhvutyuikgvwuzaduil, after 0001.
-- Private: no public URLs. The server reads and writes with the secret key, which bypasses
-- Storage policies, and the app serves models through its own signed URLs.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('sketch-runner', 'sketch-runner', false, 52428800)
ON CONFLICT (id) DO NOTHING;
