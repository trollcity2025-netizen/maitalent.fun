-- Identity verification fields and storage
-- Run in Supabase SQL Editor

-- Add identity fields to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS zip VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ssn_last4 CHAR(4),
  ADD COLUMN IF NOT EXISTS id_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS id_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS id_document_url TEXT,
  ADD COLUMN IF NOT EXISTS id_verification_status VARCHAR(20) DEFAULT 'not_submitted' CHECK (id_verification_status IN ('not_submitted', 'pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS id_verification_notes TEXT;

-- Create ID verification storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('id-verification', 'id-verification', FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload own ID" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'id-verification' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own ID" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'id-verification' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can manage ID verifications" ON storage.objects
  FOR ALL USING (
    bucket_id = 'id-verification' AND
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid()::uuid AND is_admin = true)
  );

NOTIFY pgrst, 'reload schema';
