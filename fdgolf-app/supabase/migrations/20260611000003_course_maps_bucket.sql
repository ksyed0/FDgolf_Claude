-- Create the course-maps storage bucket for static hole map PNGs (US-0014)
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-maps', 'course-maps', true)
ON CONFLICT (id) DO NOTHING;

-- Admins can upload (insert) and replace (update) map images
CREATE POLICY "Admin can upload course maps"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'course-maps'
    AND (SELECT fdgolf_is_admin())
  );

CREATE POLICY "Admin can update course maps"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'course-maps'
    AND (SELECT fdgolf_is_admin())
  );

-- Anyone (including unauthenticated players) can read map images
CREATE POLICY "Public can read course maps"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'course-maps');
