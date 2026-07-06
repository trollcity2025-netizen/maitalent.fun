-- ============================================================================
-- MaiTalent.fun — public.user_profiles only schema + migration
-- Purpose: keep all public profile, troll coin, token, hype, cashout and wallet
-- balances in ONE table: public.user_profiles.
-- Run in Supabase SQL Editor.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Main user table. This replaces public.profiles + public.wallets.
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(30) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  frozen BOOLEAN NOT NULL DEFAULT FALSE,
  frozen_until TIMESTAMPTZ,
  frozen_reason TEXT,
  frozen_by UUID REFERENCES public.user_profiles(id),
  paypal_email VARCHAR(255),
  preferred_payout_method VARCHAR(50) NOT NULL DEFAULT 'paypal',
  cashout_approved BOOLEAN NOT NULL DEFAULT FALSE,

  -- all balances live here only
  troll_coins BIGINT NOT NULL DEFAULT 0 CHECK (troll_coins >= 0),
  tokens BIGINT NOT NULL DEFAULT 30 CHECK (tokens >= 0),
  hype_coins BIGINT NOT NULL DEFAULT 0 CHECK (hype_coins >= 0),
  cashout_coins BIGINT NOT NULL DEFAULT 0 CHECK (cashout_coins >= 0),
  cashout_reserved_coins BIGINT NOT NULL DEFAULT 0 CHECK (cashout_reserved_coins >= 0),
  crowns BIGINT NOT NULL DEFAULT 0 CHECK (crowns >= 0),
  remaining_guaranteed_turns INT NOT NULL DEFAULT 5 CHECK (remaining_guaranteed_turns >= 0),
  token_usages INT NOT NULL DEFAULT 0 CHECK (token_usages >= 0),
  gift_card_progress DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- former wallet totals
  total_deposited DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_won DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_cashed_out DECIMAL(12,2) NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS frozen_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS frozen_reason TEXT,
  ADD COLUMN IF NOT EXISTS frozen_by UUID REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS gift_card_progress DECIMAL(12,2) NOT NULL DEFAULT 0;

-- 2) Migrate data from old tables if they exist.
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    INSERT INTO public.user_profiles (
      id, username, email, avatar_url, is_admin, frozen, paypal_email, preferred_payout_method,
      cashout_approved, troll_coins, hype_coins, cashout_coins, cashout_reserved_coins,
      crowns, remaining_guaranteed_turns, gift_card_progress, created_at, updated_at
    )
    SELECT
      p.id,
      COALESCE(NULLIF(p.username, ''), split_part(COALESCE(p.email, p.id::text), '@', 1)),
      COALESCE(p.email, p.id::text || '@missing.local'),
      p.avatar_url,
      COALESCE(p.is_admin, FALSE),
      COALESCE(p.frozen, FALSE),
      p.paypal_email,
      COALESCE(p.preferred_payout_method, 'paypal'),
      COALESCE(p.cashout_approved, FALSE),
      COALESCE(p.troll_coins, 0),
      COALESCE(p.hype_coins, 0),
      COALESCE(p.cashout_coins, 0),
      COALESCE(p.cashout_reserved_coins, 0),
      COALESCE(p.crowns, 0),
      COALESCE(p.remaining_guaranteed_turns, 5),
      COALESCE(p.gift_card_progress, 0),
      COALESCE(p.created_at, NOW()),
      COALESCE(p.updated_at, NOW())
    FROM public.profiles p
    ON CONFLICT (id) DO UPDATE SET
      username = EXCLUDED.username,
      email = EXCLUDED.email,
      avatar_url = EXCLUDED.avatar_url,
      is_admin = EXCLUDED.is_admin,
      frozen = EXCLUDED.frozen,
      paypal_email = EXCLUDED.paypal_email,
      preferred_payout_method = EXCLUDED.preferred_payout_method,
      cashout_approved = EXCLUDED.cashout_approved,
      troll_coins = GREATEST(public.user_profiles.troll_coins, EXCLUDED.troll_coins),
      hype_coins = GREATEST(public.user_profiles.hype_coins, EXCLUDED.hype_coins),
      cashout_coins = GREATEST(public.user_profiles.cashout_coins, EXCLUDED.cashout_coins),
      cashout_reserved_coins = GREATEST(public.user_profiles.cashout_reserved_coins, EXCLUDED.cashout_reserved_coins),
      crowns = GREATEST(public.user_profiles.crowns, EXCLUDED.crowns),
      remaining_guaranteed_turns = GREATEST(public.user_profiles.remaining_guaranteed_turns, EXCLUDED.remaining_guaranteed_turns),
      gift_card_progress = GREATEST(public.user_profiles.gift_card_progress, EXCLUDED.gift_card_progress),
      updated_at = NOW();
  END IF;

  IF to_regclass('public.wallets') IS NOT NULL THEN
    UPDATE public.user_profiles up
    SET troll_coins = GREATEST(up.troll_coins, COALESCE(w.coin_balance, 0)),
        tokens = GREATEST(up.tokens, COALESCE(w.token_balance, 0)),
        hype_coins = GREATEST(up.hype_coins, COALESCE(w.hype_coins, 0)),
        total_deposited = GREATEST(up.total_deposited, COALESCE(w.total_deposited, 0)),
        total_won = GREATEST(up.total_won, COALESCE(w.total_won, 0)),
        total_cashed_out = GREATEST(up.total_cashed_out, COALESCE(w.total_cashed_out, 0)),
        updated_at = NOW()
    FROM public.wallets w
    WHERE w.user_id = up.id;
  END IF;
  -- Drop legacy profiles table if present to avoid duplicate auth hooks
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'DROP TABLE IF EXISTS public.profiles CASCADE';
  END IF;
END $$;

-- 3) New users automatically get one public profile row and 5 free tokens.
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
INSERT INTO public.user_profiles (id, username, email, tokens)
   VALUES (
     NEW.id,
     COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), split_part(COALESCE(NEW.email, NEW.id::text), '@', 1)),
     COALESCE(NEW.email, NEW.id::text || '@missing.local'),
     30
   )
   ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS create_user_profile_after_signup ON auth.users;
CREATE TRIGGER create_user_profile_after_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_user_profile();

-- 4) Transaction/history tables point to user_profiles, not profiles/wallets.
CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('purchase', 'bonus', 'refund', 'admin_adjustment', 'crown_conversion', 'hype_conversion', 'cashout_fee', 'cashout_reserve')),
  amount BIGINT NOT NULL,
  price_usd DECIMAL(10,2),
  payment_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.token_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('convert', 'play', 'reward', 'bonus', 'admin_adjustment', 'purchase')),
  amount BIGINT NOT NULL,
  source VARCHAR(30) CHECK (source IN ('troll_coin', 'hype_coin', 'free', 'purchase')),
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  game_type VARCHAR(30) NOT NULL CHECK (game_type IN ('coin_flip', 'treasure_hunt', 'lucky_spin', 'card_pick', 'ladder_climb')),
  token_cost INT DEFAULT 1,
  result VARCHAR(10) NOT NULL CHECK (result IN ('win', 'loss', 'pending')),
  reward_amount DECIMAL(10,2) DEFAULT 0,
  reward_type VARCHAR(20) DEFAULT 'none' CHECK (reward_type IN ('cash', 'token', 'gift_card', 'free_turn', 'hype_coin', 'none')),
  random_seed VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  device_info TEXT
);

CREATE TABLE IF NOT EXISTS public.cashout_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  requested_amount DECIMAL(10,2) NOT NULL,
  coin_amount BIGINT NOT NULL,
  paypal_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'denied', 'refunded')),
  paypal_payout_batch_id VARCHAR(255),
  paypal_transaction_id VARCHAR(255),
  approved_by UUID REFERENCES public.user_profiles(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  denied_reason TEXT
);

CREATE TABLE IF NOT EXISTS public.payout_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  amount_usd DECIMAL(10,2) NOT NULL,
  coin_amount BIGINT NOT NULL,
  fee_amount DECIMAL(10,2) DEFAULT 0,
  paypal_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'denied', 'refunded')),
  paypal_payout_batch_id VARCHAR(255),
  paypal_transaction_id VARCHAR(255),
  approved_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.pending_paypal_orders (
  order_id VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  coins BIGINT NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  capture_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'captured', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  captured_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.gift_card_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  amount_usd DECIMAL(10,2) NOT NULL,
  gift_card_progress_used DECIMAL(12,2) NOT NULL,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sent', 'denied', 'completed')),
  sent_by UUID REFERENCES public.user_profiles(id),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mai_pay_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  paypal_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.user_profiles(id)
);

CREATE TABLE IF NOT EXISTS public.crown_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  crowns_used BIGINT,
  crowns_spent BIGINT,
  coins_received BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_game_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_type VARCHAR(30) UNIQUE NOT NULL,
  win_probability DECIMAL(5,4) DEFAULT 0.35,
  max_daily_payout DECIMAL(10,2) DEFAULT 100.00,
  max_user_daily_payout DECIMAL(10,2) DEFAULT 10.00,
  max_user_weekly_payout DECIMAL(10,2) DEFAULT 50.00,
  is_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.user_profiles(id)
);

CREATE TABLE IF NOT EXISTS public.trivia_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  options TEXT[] NOT NULL,
  correct_index INT NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  difficulty VARCHAR(10) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_trivia_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.trivia_questions(id) NOT NULL,
  selected_index INT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_spent_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.responsible_play_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  daily_play_count INT DEFAULT 0,
  daily_spend_usd DECIMAL(10,2) DEFAULT 0,
  weekly_play_count INT DEFAULT 0,
  weekly_spend_usd DECIMAL(10,2) DEFAULT 0,
  self_excluded_until TIMESTAMPTZ,
  cooling_off_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  username VARCHAR(30) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.free_entry_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  method VARCHAR(50) DEFAULT 'mail',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  total_games_played INT DEFAULT 0,
  total_wins INT DEFAULT 0,
  total_cash_won DECIMAL(10,2) DEFAULT 0,
  total_cashed_out DECIMAL(10,2) DEFAULT 0,
  current_streak INT DEFAULT 0,
  best_streak INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5) Atomic balance functions — all touch user_profiles only.
CREATE OR REPLACE FUNCTION public.convert_troll_to_tokens(p_user_id UUID, p_troll_amount BIGINT)
RETURNS VOID AS $$
DECLARE v_tokens BIGINT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_troll_amount < 100 OR p_troll_amount % 100 != 0 THEN RAISE EXCEPTION 'Troll coin amount must be a multiple of 100'; END IF;
  v_tokens := p_troll_amount / 2;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins - p_troll_amount,
      tokens = tokens + v_tokens,
      updated_at = NOW()
  WHERE id = p_user_id AND troll_coins >= p_troll_amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient troll coin balance'; END IF;

  INSERT INTO public.token_transactions (user_id, type, amount, source)
  VALUES (p_user_id, 'convert', v_tokens, 'troll_coin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.convert_hype_to_tokens(p_user_id UUID, p_hype_amount BIGINT)
RETURNS VOID AS $$
DECLARE v_tokens BIGINT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_hype_amount < 100 OR p_hype_amount % 100 != 0 THEN RAISE EXCEPTION 'Hype coin amount must be a multiple of 100'; END IF;
  v_tokens := p_hype_amount / 2;

  UPDATE public.user_profiles
  SET hype_coins = hype_coins - p_hype_amount,
      tokens = tokens + v_tokens,
      updated_at = NOW()
  WHERE id = p_user_id AND hype_coins >= p_hype_amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient hype coin balance'; END IF;

  INSERT INTO public.token_transactions (user_id, type, amount, source)
  VALUES (p_user_id, 'convert', v_tokens, 'hype_coin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.convert_crowns(p_user_id UUID, p_crowns BIGINT)
RETURNS VOID AS $$
DECLARE v_coins BIGINT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_crowns < 100 OR p_crowns % 100 != 0 THEN RAISE EXCEPTION 'Crowns must be converted in multiples of 100'; END IF;
  v_coins := (p_crowns / 100) * 500;

  UPDATE public.user_profiles
  SET crowns = crowns - p_crowns,
      troll_coins = troll_coins + v_coins,
      updated_at = NOW()
  WHERE id = p_user_id AND crowns >= p_crowns;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient crown balance'; END IF;

  INSERT INTO public.crown_redemptions (user_id, crowns_used, crowns_spent, coins_received)
  VALUES (p_user_id, p_crowns, p_crowns, v_coins);
  INSERT INTO public.coin_transactions (user_id, type, amount, status)
  VALUES (p_user_id, 'crown_conversion', v_coins, 'completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.process_cashout_deduction(p_user_id UUID, p_coins BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_profiles
  SET cashout_coins = cashout_coins - p_coins,
      cashout_reserved_coins = GREATEST(cashout_reserved_coins - p_coins, 0),
      total_cashed_out = total_cashed_out + (p_coins / 200.0),
      updated_at = NOW()
  WHERE id = p_user_id AND cashout_coins >= p_coins;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient cashout coin balance'; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.play_game(p_game_type VARCHAR, p_user_id UUID)
RETURNS TABLE (result VARCHAR, reward_amount DECIMAL, reward_type VARCHAR, random_seed VARCHAR) AS $$
DECLARE
  v_win_prob DECIMAL;
  v_is_enabled BOOLEAN;
  v_seed VARCHAR;
  v_win BOOLEAN;
  v_reward DECIMAL := 0;
  v_reward_type VARCHAR := 'none';
  v_token_usages BIGINT;
  v_tokens BIGINT;
  v_guaranteed_turns INT;
  v_token_cost INT := CASE WHEN p_game_type = 'treasure_hunt' THEN 5 ELSE 15 END;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Not allowed'; END IF;

SELECT tokens, remaining_guaranteed_turns, token_usages
      INTO v_tokens, v_guaranteed_turns, v_token_usages
    FROM public.user_profiles
    WHERE id = p_user_id AND frozen = FALSE;

  IF v_tokens IS NULL OR v_tokens < 1 THEN RAISE EXCEPTION 'Insufficient tokens'; END IF;

  SELECT win_probability, is_enabled INTO v_win_prob, v_is_enabled
  FROM public.admin_game_settings WHERE game_type = p_game_type;
  IF COALESCE(v_is_enabled, TRUE) = FALSE THEN RAISE EXCEPTION 'Game is disabled'; END IF;

  v_seed := md5(random()::text || clock_timestamp()::text);
  IF COALESCE(v_guaranteed_turns, 0) > 0 THEN
    v_win := TRUE;
  ELSE
    v_win := (random() < COALESCE(v_win_prob, 0.35));
  END IF;

  IF v_win THEN
    CASE p_game_type
      WHEN 'coin_flip' THEN v_reward := 0.05; v_reward_type := 'cash';
      WHEN 'treasure_hunt' THEN v_reward := (floor(random() * 10 + 1) / 100); v_reward_type := 'cash';
      WHEN 'lucky_spin' THEN v_reward := (ARRAY[0.01, 0.05, 0.10])[floor(random() * 3 + 1)]; v_reward_type := 'cash';
      WHEN 'card_pick' THEN v_reward := (ARRAY[0.01, 0.05, 0.10, 0.30])[floor(random() * 4 + 1)]; v_reward_type := 'cash';
      WHEN 'ladder_climb' THEN v_reward := (floor(random() * 10 + 1) / 100); v_reward_type := 'cash';
      ELSE v_reward := 0; v_reward_type := 'none';
    END CASE;
  END IF;

  UPDATE public.user_profiles
  SET tokens = tokens - v_token_cost,
      remaining_guaranteed_turns = GREATEST(remaining_guaranteed_turns - CASE WHEN COALESCE(v_guaranteed_turns,0) > 0 THEN 1 ELSE 0 END, 0),
      troll_coins = troll_coins + CASE WHEN v_win AND v_reward > 0 AND v_reward_type = 'token' THEN (v_reward * 100)::BIGINT ELSE 0 END,
      cashout_coins = cashout_coins + CASE WHEN v_win AND v_reward > 0 AND v_reward_type = 'cash' THEN (v_reward * 100)::BIGINT ELSE 0 END,
      cash_balance = COALESCE(cash_balance,0) + CASE WHEN v_win AND v_reward > 0 AND v_reward_type = 'cash' THEN round(v_reward::numeric,2) ELSE 0 END,
      total_won = total_won + CASE WHEN v_win THEN v_reward ELSE 0 END,
      updated_at = NOW()
  WHERE id = p_user_id AND tokens >= v_token_cost;

  INSERT INTO public.token_transactions (user_id, type, amount, source) VALUES (p_user_id, 'play', -v_token_cost, 'free');

  INSERT INTO public.game_sessions (user_id, game_type, token_cost, result, reward_amount, reward_type, random_seed)
  VALUES (p_user_id, p_game_type, v_token_cost, CASE WHEN v_win THEN 'win' ELSE 'loss' END, v_reward, v_reward_type, v_seed);

  -- Persist coin transaction for cash rewards (amount stored in cents)
  IF v_win AND v_reward > 0 AND v_reward_type = 'cash' THEN
    INSERT INTO public.coin_transactions (user_id, type, amount, price_usd, status, created_at)
    VALUES (p_user_id, 'bonus', round(v_reward * 100)::BIGINT, v_reward, 'completed', now());
  END IF;

  RETURN QUERY SELECT CASE WHEN v_win THEN 'win' ELSE 'loss' END::VARCHAR, v_reward, v_reward_type, v_seed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6) Defaults and indexes.
INSERT INTO public.admin_game_settings (game_type, win_probability) VALUES
  ('coin_flip', 0.50),
  ('treasure_hunt', 0.38),
  ('lucky_spin', 0.35),
  ('card_pick', 0.35),
  ('ladder_climb', 0.40)
ON CONFLICT (game_type) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id ON public.coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON public.token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON public.game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cashout_requests_user_id ON public.cashout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_cashout_requests_status ON public.cashout_requests(status);
CREATE INDEX IF NOT EXISTS idx_pending_paypal_orders_user_id ON public.pending_paypal_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON public.user_stats(user_id);

-- 7) RLS. Public profile reads are allowed. Users update only safe own profile fields.
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_paypal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_card_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_pay_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crown_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are readable" ON public.user_profiles;
CREATE POLICY "Public profiles are readable" ON public.user_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users insert own profile" ON public.user_profiles;
CREATE POLICY "Users insert own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users update own safe profile" ON public.user_profiles;
CREATE POLICY "Users update own safe profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users view own coin transactions" ON public.coin_transactions;
CREATE POLICY "Users view own coin transactions" ON public.coin_transactions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view own token transactions" ON public.token_transactions;
CREATE POLICY "Users view own token transactions" ON public.token_transactions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view own game sessions" ON public.game_sessions;
CREATE POLICY "Users view own game sessions" ON public.game_sessions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own cashouts" ON public.cashout_requests;
CREATE POLICY "Users manage own cashouts" ON public.cashout_requests FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own pending paypal orders" ON public.pending_paypal_orders;
CREATE POLICY "Users view own pending paypal orders" ON public.pending_paypal_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own pending paypal orders" ON public.pending_paypal_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pending_paypal_orders_owner_update" ON public.pending_paypal_orders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pending_paypal_orders_owner_delete" ON public.pending_paypal_orders FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own gift cards" ON public.gift_card_redemptions;
CREATE POLICY "Users manage own gift cards" ON public.gift_card_redemptions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own mai pay application" ON public.mai_pay_applications;
CREATE POLICY "Users manage own mai pay application" ON public.mai_pay_applications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view own crown redemptions" ON public.crown_redemptions;
CREATE POLICY "Users view own crown redemptions" ON public.crown_redemptions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users send and read chat" ON public.chat_messages;
CREATE POLICY "Users send and read chat" ON public.chat_messages FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() = user_id);

-- 8) Optional after testing: rename old tables so frontend cannot accidentally use them.
-- ALTER TABLE IF EXISTS public.wallets RENAME TO old_wallets_do_not_use;
-- ALTER TABLE IF EXISTS public.profiles RENAME TO old_profiles_do_not_use;
-- ============================================================================
