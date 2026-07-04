-- MAI Pay cashout, daily rewards, and no-turn migration
-- Run this in Supabase SQL Editor before testing the updated frontend.

ALTER TABLE public.user_profiles
  DROP COLUMN IF NOT EXISTS cash_balance DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_turn_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_daily_crown_claim DATE;

ALTER TABLE public.gift_card_redemptions
  ADD COLUMN IF NOT EXISTS gift_card_code TEXT,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.gift_card_redemptions
  ALTER COLUMN gift_card_progress_used SET DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.daily_reward_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  crowns_awarded BIGINT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, claim_date)
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_reward_claims_user_claim_date_key
  ON public.daily_reward_claims(user_id, claim_date);

ALTER TABLE public.daily_reward_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_reward_claims_owner_select ON public.daily_reward_claims;
CREATE POLICY daily_reward_claims_owner_select ON public.daily_reward_claims
  FOR SELECT TO authenticated USING (user_id = auth.uid()::uuid OR public.is_requester_admin());
DROP POLICY IF EXISTS daily_reward_claims_owner_insert ON public.daily_reward_claims;
CREATE POLICY daily_reward_claims_owner_insert ON public.daily_reward_claims
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::uuid OR public.is_requester_admin());

DROP POLICY IF EXISTS gift_card_redemptions_admin_update ON public.gift_card_redemptions;
CREATE POLICY gift_card_redemptions_admin_update ON public.gift_card_redemptions
  FOR UPDATE TO authenticated USING (public.is_requester_admin()) WITH CHECK (public.is_requester_admin());

DROP POLICY IF EXISTS user_profiles_owner_update_balances ON public.user_profiles;
CREATE POLICY user_profiles_owner_update_balances ON public.user_profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()::uuid OR public.is_requester_admin())
  WITH CHECK (id = auth.uid()::uuid OR public.is_requester_admin());

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_gift_card_redemptions_updated_at ON public.gift_card_redemptions;
CREATE TRIGGER update_gift_card_redemptions_updated_at
BEFORE UPDATE ON public.gift_card_redemptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Remove gift-card-progress rewards from the game session check and allow no_turn rewards.
ALTER TABLE public.game_sessions DROP CONSTRAINT IF EXISTS game_sessions_reward_type_check;
ALTER TABLE public.game_sessions
  ADD CONSTRAINT game_sessions_reward_type_check
  CHECK (reward_type IN ('cash', 'token', 'no_turn', 'free_turn', 'none', 'bankrupt'));

NOTIFY pgrst, 'reload schema';
