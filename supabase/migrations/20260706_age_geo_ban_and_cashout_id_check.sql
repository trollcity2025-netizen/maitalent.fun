-- Age/geo ban enforcement and cashout ID verification
-- Run in Supabase SQL Editor

-- 1. Ban tracking table
CREATE TABLE IF NOT EXISTS public.user_bans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ban_type VARCHAR(50) NOT NULL,
  ip_address INET,
  device_fingerprint TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_radius_meters INT DEFAULT 61,
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_bans_ip ON public.user_bans(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_bans_device ON public.user_bans(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_user_bans_location ON public.user_bans(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_user_bans_user_id ON public.user_bans(user_id);

-- 2. Signup tracking columns on user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS signup_ip INET,
  ADD COLUMN IF NOT EXISTS signup_device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS signup_latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS signup_longitude DECIMAL(11, 8);

-- 3. Haversine distance check: is point near any banned location?
CREATE OR REPLACE FUNCTION public.is_near_banned_location(
  p_lat DECIMAL,
  p_lng DECIMAL,
  p_radius_meters INT DEFAULT 61
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_bans
    WHERE latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND ban_type IN ('age_under_21', 'geo_proximity')
    AND (
      2 * 6371000 * ASIN(SQRT(
        POWER(SIN((latitude - p_lat) * PI() / 180 / 2), 2) +
        COS(latitude * PI() / 180) * COS(p_lat * PI() / 180) *
        POWER(SIN((longitude - p_lng) * PI() / 180 / 2), 2)
      ))
    ) <= p_radius_meters
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. IP ban check
CREATE OR REPLACE FUNCTION public.is_ip_banned(p_ip INET)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_bans
    WHERE ip_address = p_ip
      AND ban_type IN ('age_under_21', 'ip')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Device ban check
CREATE OR REPLACE FUNCTION public.is_device_banned(p_device_fingerprint TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_device_fingerprint IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_bans
    WHERE device_fingerprint = p_device_fingerprint
      AND ban_type IN ('age_under_21', 'device')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Cashout ID verification trigger (gift card redemptions)
CREATE OR REPLACE FUNCTION public.check_cashout_id_verification()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = NEW.user_id
      AND id_verified = true
      AND id_verification_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'User % is not identity verified. ID verification is required before cashout.', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_cashout_id_verification ON public.gift_card_redemptions;
CREATE TRIGGER trg_check_cashout_id_verification
BEFORE INSERT ON public.gift_card_redemptions
FOR EACH ROW EXECUTE FUNCTION public.check_cashout_id_verification();

-- Also enforce on cashout_requests if used for user-requested cashouts
DROP TRIGGER IF EXISTS trg_check_cashout_requests_id_verification ON public.cashout_requests;
CREATE TRIGGER trg_check_cashout_requests_id_verification
BEFORE INSERT ON public.cashout_requests
FOR EACH ROW EXECUTE FUNCTION public.check_cashout_id_verification();

-- 7. RLS for user_bans (admin only)
ALTER TABLE IF EXISTS public.user_bans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_bans_admin_manage" ON public.user_bans;
CREATE POLICY "user_bans_admin_manage" ON public.user_bans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid()::uuid AND is_admin = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid()::uuid AND is_admin = true)
  );

NOTIFY pgrst, 'reload schema';
