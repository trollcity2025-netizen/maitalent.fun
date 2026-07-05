-- MaiTalent.fun Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles (single source of truth)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(30) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  frozen BOOLEAN DEFAULT FALSE,
  frozen_until TIMESTAMPTZ,
  frozen_reason TEXT,
  frozen_by UUID REFERENCES public.user_profiles(id),
  paypal_email VARCHAR(255),
  preferred_payout_method VARCHAR(50) DEFAULT 'paypal',
  cashout_approved BOOLEAN DEFAULT FALSE,
  troll_coins BIGINT DEFAULT 0,
  tokens BIGINT DEFAULT 0,
  hype_coins BIGINT DEFAULT 0,
  cash_balance DECIMAL(12,2) DEFAULT 0,
  cashout_coins BIGINT DEFAULT 0,
  cashout_reserved_coins BIGINT DEFAULT 0,
  crowns BIGINT DEFAULT 0,
  remaining_guaranteed_turns INT DEFAULT 5,
  gift_card_progress DECIMAL(5,2) DEFAULT 0,
  total_deposited DECIMAL(12,2) DEFAULT 0,
  total_won DECIMAL(12,2) DEFAULT 0,
  total_cashed_out DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helper function: check if the current requester is an admin.
-- Runs with SECURITY DEFINER to avoid RLS recursion when used inside policies.
CREATE OR REPLACE FUNCTION public.is_requester_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.user_profiles WHERE id = auth.uid()::uuid;
  RETURN COALESCE(v_is_admin, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- wallets removed: all balances now live in public.user_profiles

DO $$
DECLARE
  desired_cols text[] := ARRAY[
    'id','username','email','avatar_url','is_admin','frozen','frozen_until','paypal_email',
    'cash_balance','tokens','troll_coins','hype_coins','total_deposited','total_won','total_cashed_out',
    'created_at','updated_at'
  ];
  target_cols text[];
  source_cols text[];
  cols text := '';
  selects text := '';
  col text;
  sql text;
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    SELECT array_agg(attname) INTO target_cols
    FROM pg_attribute
    WHERE attrelid = 'public.user_profiles'::regclass
      AND attnum > 0 AND NOT attisdropped;

    SELECT array_agg(attname) INTO source_cols
    FROM pg_attribute
    WHERE attrelid = 'public.profiles'::regclass
      AND attnum > 0 AND NOT attisdropped;

    FOREACH col IN ARRAY desired_cols LOOP
      IF col = ANY(target_cols) THEN
        IF cols <> '' THEN
          cols := cols || ', ';
          selects := selects || ', ';
        END IF;
        cols := cols || quote_ident(col);
        -- Build safe select: use p.col if present in source, else fallback
        IF col = 'created_at' THEN
          IF col = ANY(source_cols) THEN
            selects := selects || 'COALESCE(p.' || quote_ident(col) || ', NOW())';
          ELSE
            selects := selects || 'NOW()';
          END IF;
        ELSIF col = 'updated_at' THEN
          IF col = ANY(source_cols) THEN
            selects := selects || 'COALESCE(p.' || quote_ident(col) || ', NOW())';
          ELSE
            selects := selects || 'NOW()';
          END IF;
        ELSE
          IF col = ANY(source_cols) THEN
            selects := selects || 'p.' || quote_ident(col);
          ELSE
            selects := selects || 'NULL';
          END IF;
        END IF;
      END IF;
    END LOOP;

    IF cols <> '' THEN
      sql := format('INSERT INTO public.user_profiles (%s) SELECT %s FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles u WHERE u.id = p.id)', cols, selects);
      EXECUTE sql;
    END IF;

    -- Drop legacy table to avoid duplicate-auth hooks and policy recursion
    EXECUTE 'DROP TABLE IF EXISTS public.profiles CASCADE';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Coin transactions
CREATE TABLE IF NOT EXISTS coin_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('purchase', 'bonus', 'refund', 'admin_adjustment', 'crown_conversion', 'hype_conversion', 'cashout_fee', 'cashout_reserve')),
  amount BIGINT NOT NULL,
  price_usd DECIMAL(10,2),
  payment_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Token transactions
CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('convert', 'play', 'reward', 'bonus', 'admin_adjustment', 'purchase')),
  amount BIGINT NOT NULL,
  source VARCHAR(30) CHECK (source IN ('troll_coin', 'hype_coin', 'free', 'purchase')),
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game sessions
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
  game_type VARCHAR(30) NOT NULL CHECK (game_type IN ('coin_flip', 'treasure_hunt', 'lucky_spin', 'card_pick', 'ladder_climb')),
  token_cost INT DEFAULT 1,
  result VARCHAR(10) NOT NULL CHECK (result IN ('win', 'loss', 'pending')),
  reward_amount DECIMAL(10,2) DEFAULT 0,
  reward_type VARCHAR(20) DEFAULT 'none' CHECK (reward_type IN ('cash', 'token', 'gift_card', 'free_turn', 'none')),
  random_seed VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  device_info TEXT
);

-- Cashout requests
CREATE TABLE IF NOT EXISTS cashout_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
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

-- Payout requests (MAI Pay)
CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
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

-- Pending PayPal orders (coin purchases)
CREATE TABLE IF NOT EXISTS pending_paypal_orders (
  order_id VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
  coins BIGINT NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  capture_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'captured', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  captured_at TIMESTAMPTZ
);

-- Gift card redemptions
CREATE TABLE IF NOT EXISTS gift_card_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
  amount_usd DECIMAL(10,2) NOT NULL,
  gift_card_progress_used DECIMAL(5,2) NOT NULL,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sent', 'denied', 'completed')),
  sent_by UUID REFERENCES public.user_profiles(id),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to process cashout coin deduction
CREATE OR REPLACE FUNCTION process_cashout_deduction(
  p_user_id UUID,
  p_coins BIGINT
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_profiles
  SET cashout_coins = cashout_coins - p_coins,
      updated_at = NOW()
  WHERE id = p_user_id AND cashout_coins >= p_coins;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient cashout coin balance';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Charge tokens for an in-game action (e.g., tile click, flip)
CREATE OR REPLACE FUNCTION charge_tokens(
  p_user_id UUID,
  p_cost INT
)
RETURNS VOID AS $$
DECLARE
  v_tokens BIGINT;
BEGIN
  SELECT tokens INTO v_tokens FROM public.user_profiles WHERE id = p_user_id;

  IF v_tokens IS NULL OR v_tokens < p_cost THEN
    RAISE EXCEPTION 'Insufficient tokens for action: need %', p_cost;
  END IF;

  UPDATE public.user_profiles
  SET tokens = tokens - p_cost,
      updated_at = NOW()
  WHERE id = p_user_id;

  INSERT INTO token_transactions (user_id, type, amount, source)
  VALUES (p_user_id, 'play', -p_cost, 'purchase');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Convert troll coins to tokens (100 troll = 50 tokens)
CREATE OR REPLACE FUNCTION convert_troll_to_tokens(
  p_user_id UUID,
  p_troll_amount BIGINT
)
RETURNS VOID AS $$
DECLARE
  v_tokens BIGINT;
BEGIN
  IF p_troll_amount < 100 OR p_troll_amount % 100 != 0 THEN
    RAISE EXCEPTION 'Troll coin amount must be a multiple of 100';
  END IF;

  v_tokens := p_troll_amount / 2;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins - p_troll_amount,
      tokens = tokens + v_tokens,
      updated_at = NOW()
  WHERE id = p_user_id AND troll_coins >= p_troll_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient troll coin balance';
  END IF;

  INSERT INTO token_transactions (user_id, type, amount, source)
  VALUES (p_user_id, 'convert', v_tokens, 'troll_coin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Convert hype coins to tokens (100 hype = 50 tokens)
CREATE OR REPLACE FUNCTION convert_hype_to_tokens(
  p_user_id UUID,
  p_hype_amount BIGINT
)
RETURNS VOID AS $$
DECLARE
  v_tokens BIGINT;
BEGIN
  IF p_hype_amount < 100 OR p_hype_amount % 100 != 0 THEN
    RAISE EXCEPTION 'Hype coin amount must be a multiple of 100';
  END IF;

  v_tokens := p_hype_amount / 2;

  UPDATE public.user_profiles
  SET hype_coins = hype_coins - p_hype_amount,
      tokens = tokens + v_tokens,
      updated_at = NOW()
  WHERE id = p_user_id AND hype_coins >= p_hype_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient hype coin balance';
  END IF;

  INSERT INTO token_transactions (user_id, type, amount, source)
  VALUES (p_user_id, 'convert', v_tokens, 'hype_coin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- MAI Pay applications
CREATE TABLE IF NOT EXISTS mai_pay_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) UNIQUE NOT NULL,
  paypal_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.user_profiles(id)
);

-- Crown redemptions
CREATE TABLE IF NOT EXISTS crown_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
  crowns_spent BIGINT NOT NULL,
  coins_received BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin game settings
CREATE TABLE IF NOT EXISTS admin_game_settings (
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

-- Trivia questions
CREATE TABLE IF NOT EXISTS trivia_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  options TEXT[] NOT NULL,
  correct_index INT NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  difficulty VARCHAR(10) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User trivia history
CREATE TABLE IF NOT EXISTS user_trivia_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
  question_id UUID REFERENCES trivia_questions(id) NOT NULL,
  selected_index INT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_spent_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Responsible play limits
CREATE TABLE IF NOT EXISTS responsible_play_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) UNIQUE NOT NULL,
  daily_play_count INT DEFAULT 0,
  daily_spend_usd DECIMAL(10,2) DEFAULT 0,
  weekly_play_count INT DEFAULT 0,
  weekly_spend_usd DECIMAL(10,2) DEFAULT 0,
  self_excluded_until TIMESTAMPTZ,
  cooling_off_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
  username VARCHAR(30) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Free entry requests
CREATE TABLE IF NOT EXISTS free_entry_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
  method VARCHAR(50) DEFAULT 'mail',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User stats
CREATE TABLE IF NOT EXISTS user_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) UNIQUE NOT NULL,
  total_games_played INT DEFAULT 0,
  total_wins INT DEFAULT 0,
  total_cash_won DECIMAL(10,2) DEFAULT 0,
  total_cashed_out DECIMAL(10,2) DEFAULT 0,
  current_streak INT DEFAULT 0,
  best_streak INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default game settings
INSERT INTO admin_game_settings (game_type, win_probability) VALUES
  ('coin_flip', 0.35),
  ('treasure_hunt', 0.40),
  ('lucky_spin', 0.35),
  ('card_pick', 0.35),
  ('ladder_climb', 0.50)
ON CONFLICT (game_type) DO NOTHING;

-- Insert sample trivia questions
INSERT INTO trivia_questions (question, options, correct_index, category, difficulty) VALUES
  ('What year was the first PlayStation released?', ARRAY['1994', '1996', '1998', '2000'], 0, 'gaming', 'easy'),
  ('Which company created the Mario franchise?', ARRAY['Sega', 'Nintendo', 'Sony', 'Capcom'], 1, 'gaming', 'easy'),
  ('What is the highest-selling video game of all time?', ARRAY['Tetris', 'Minecraft', 'GTA V', 'Wii Sports'], 1, 'gaming', 'medium'),
  ('In what year was the internet publicly available?', ARRAY['1989', '1991', '1993', '1995'], 1, 'tech', 'medium'),
  ('What does CPU stand for?', ARRAY['Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility', 'Core Processing Unit'], 0, 'tech', 'easy'),
  ('Which planet is known as the Red Planet?', ARRAY['Venus', 'Jupiter', 'Mars', 'Saturn'], 2, 'science', 'easy'),
  ('What is the chemical symbol for gold?', ARRAY['Go', 'Gd', 'Au', 'Ag'], 2, 'science', 'medium'),
  ('How many bones are in the adult human body?', ARRAY['186', '206', '226', '246'], 1, 'science', 'hard'),
  ('Who painted the Mona Lisa?', ARRAY['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Donatello'], 2, 'art', 'easy'),
  ('In which year did World War II end?', ARRAY['1943', '1944', '1945', '1946'], 2, 'history', 'easy'),
  ('What is the largest ocean on Earth?', ARRAY['Atlantic', 'Indian', 'Arctic', 'Pacific'], 3, 'geography', 'easy'),
  ('Which element has the atomic number 1?', ARRAY['Helium', 'Hydrogen', 'Lithium', 'Carbon'], 1, 'science', 'easy'),
  ('What is the speed of light in km/s (approximately)?', ARRAY['150,000', '200,000', '300,000', '400,000'], 2, 'science', 'hard'),
  ('Who wrote "Romeo and Juliet"?', ARRAY['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'], 1, 'literature', 'easy'),
  ('What is the smallest prime number?', ARRAY['0', '1', '2', '3'], 2, 'math', 'medium'),
  ('Which country has the most natural lakes?', ARRAY['USA', 'Russia', 'Canada', 'Brazil'], 2, 'geography', 'hard'),
  ('What year was the first iPhone released?', ARRAY['2005', '2006', '2007', '2008'], 2, 'tech', 'medium'),
  ('How many hearts does an octopus have?', ARRAY['1', '2', '3', '4'], 2, 'science', 'medium'),
  ('What is the longest river in the world?', ARRAY['Amazon', 'Nile', 'Mississippi', 'Yangtze'], 1, 'geography', 'medium'),
  ('Which gas do plants absorb from the atmosphere?', ARRAY['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'], 2, 'science', 'easy');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cashout_requests_user_id ON cashout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_cashout_requests_status ON cashout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_user_id ON payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_pending_paypal_orders_user_id ON pending_paypal_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);

-- Enable Row Level Security and policies for game-related tables
-- Helper: allow access if owner or admin

ALTER TABLE IF EXISTS game_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "game_sessions_owner_select" ON game_sessions;
CREATE POLICY "game_sessions_owner_select" ON game_sessions
  FOR SELECT USING (
    user_id = auth.uid()::uuid OR
    is_requester_admin()
  );
DROP POLICY IF EXISTS "game_sessions_owner_insert" ON game_sessions;
CREATE POLICY "game_sessions_owner_insert" ON game_sessions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::uuid OR
    is_requester_admin()
  );
DROP POLICY IF EXISTS "game_sessions_owner_update" ON game_sessions;
CREATE POLICY "game_sessions_owner_update" ON game_sessions
  FOR UPDATE USING (
    user_id = auth.uid()::uuid OR
    is_requester_admin()
  );
DROP POLICY IF EXISTS "game_sessions_admin_delete" ON game_sessions;
CREATE POLICY "game_sessions_admin_delete" ON game_sessions
  FOR DELETE USING (
    is_requester_admin()
  );

ALTER TABLE IF EXISTS token_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "token_transactions_owner_select" ON token_transactions;
CREATE POLICY "token_transactions_owner_select" ON token_transactions
  FOR SELECT USING (
    user_id = auth.uid()::uuid OR
    is_requester_admin()
  );
DROP POLICY IF EXISTS "token_transactions_owner_insert" ON token_transactions;
CREATE POLICY "token_transactions_owner_insert" ON token_transactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::uuid OR
    is_requester_admin()
  );

ALTER TABLE IF EXISTS coin_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coin_transactions_owner_select" ON coin_transactions;
CREATE POLICY "coin_transactions_owner_select" ON coin_transactions
  FOR SELECT USING (
    user_id = auth.uid()::uuid OR
    is_requester_admin()
  );
DROP POLICY IF EXISTS "coin_transactions_owner_insert" ON coin_transactions;
CREATE POLICY "coin_transactions_owner_insert" ON coin_transactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::uuid OR
    is_requester_admin()
  );
ALTER TABLE IF EXISTS user_trivia_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_trivia_history_owner_select" ON user_trivia_history;
CREATE POLICY "user_trivia_history_owner_select" ON user_trivia_history
  FOR SELECT USING (
    user_id = auth.uid()::uuid OR
    is_requester_admin()
  );
DROP POLICY IF EXISTS "user_trivia_history_owner_insert" ON user_trivia_history;
CREATE POLICY "user_trivia_history_owner_insert" ON user_trivia_history
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::uuid OR is_requester_admin()
  );

CREATE POLICY "user_profiles_owner_select" ON public.user_profiles
  FOR SELECT USING (
    id = auth.uid()::uuid OR is_requester_admin()
  );
CREATE POLICY "user_profiles_owner_update" ON public.user_profiles
  FOR UPDATE USING (
    id = auth.uid()::uuid OR is_requester_admin()
  ) WITH CHECK (
    id = auth.uid()::uuid OR is_requester_admin()
  );
CREATE POLICY "user_profiles_admin_insert" ON public.user_profiles
  FOR INSERT WITH CHECK (
    id = auth.uid()::uuid OR is_requester_admin()
  );
-- old `profiles` policies removed; `public.user_profiles` is the single source of truth

-- wallets table removed; policies intentionally omitted

ALTER TABLE IF EXISTS cashout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cashout_requests_owner_select" ON cashout_requests;
CREATE POLICY "cashout_requests_owner_select" ON cashout_requests
  FOR SELECT USING (
    user_id = auth.uid()::uuid OR is_requester_admin()
  );
DROP POLICY IF EXISTS "cashout_requests_owner_insert" ON cashout_requests;
CREATE POLICY "cashout_requests_owner_insert" ON cashout_requests
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::uuid OR is_requester_admin()
  );
DROP POLICY IF EXISTS "cashout_requests_admin_update" ON cashout_requests;
CREATE POLICY "cashout_requests_admin_update" ON cashout_requests
  FOR UPDATE USING (
    is_requester_admin()
  );

ALTER TABLE IF EXISTS payout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payout_requests_owner_select" ON payout_requests;
CREATE POLICY "payout_requests_owner_select" ON payout_requests
  FOR SELECT USING (
    user_id = auth.uid()::uuid OR is_requester_admin()
  );
DROP POLICY IF EXISTS "payout_requests_owner_insert" ON payout_requests;
CREATE POLICY "payout_requests_owner_insert" ON payout_requests
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::uuid OR is_requester_admin()
  );
DROP POLICY IF EXISTS "payout_requests_admin_update" ON payout_requests;
CREATE POLICY "payout_requests_admin_update" ON payout_requests
  FOR UPDATE USING (
    is_requester_admin()
  );

ALTER TABLE IF EXISTS pending_paypal_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pending_paypal_orders_owner_select" ON pending_paypal_orders;
CREATE POLICY "pending_paypal_orders_owner_select" ON pending_paypal_orders
  FOR SELECT USING (
    user_id = auth.uid()::uuid OR is_requester_admin()
  );
DROP POLICY IF EXISTS "pending_paypal_orders_owner_insert" ON pending_paypal_orders;
CREATE POLICY "pending_paypal_orders_owner_insert" ON pending_paypal_orders
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::uuid OR is_requester_admin()
  );
DROP POLICY IF EXISTS "pending_paypal_orders_owner_update" ON pending_paypal_orders;
CREATE POLICY "pending_paypal_orders_owner_update" ON pending_paypal_orders
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid()::uuid OR is_requester_admin()
  )
  WITH CHECK (
    user_id = auth.uid()::uuid OR is_requester_admin()
  );
DROP POLICY IF EXISTS "pending_paypal_orders_owner_delete" ON pending_paypal_orders;
CREATE POLICY "pending_paypal_orders_owner_delete" ON pending_paypal_orders
  FOR DELETE TO authenticated USING (
    user_id = auth.uid()::uuid OR is_requester_admin()
  );

ALTER TABLE IF EXISTS gift_card_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gift_card_redemptions_owner_select" ON gift_card_redemptions;
CREATE POLICY "gift_card_redemptions_owner_select" ON gift_card_redemptions
  FOR SELECT USING (
    user_id = auth.uid()::uuid OR is_requester_admin()
  );
DROP POLICY IF EXISTS "gift_card_redemptions_owner_insert" ON gift_card_redemptions;
CREATE POLICY "gift_card_redemptions_owner_insert" ON gift_card_redemptions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::uuid OR is_requester_admin()
  );

ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_admin_manage" ON audit_logs;
CREATE POLICY "audit_logs_admin_manage" ON audit_logs
  FOR ALL USING (
    is_requester_admin()
  ) WITH CHECK (
    is_requester_admin()
  );

ALTER TABLE IF EXISTS responsible_play_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "responsible_play_limits_owner_manage" ON responsible_play_limits;
CREATE POLICY "responsible_play_limits_owner_manage" ON responsible_play_limits
  FOR ALL USING (
    user_id = auth.uid()::uuid OR is_requester_admin()
  ) WITH CHECK (
    user_id = auth.uid()::uuid OR is_requester_admin()
  );

ALTER TABLE IF EXISTS chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_messages_public_select" ON chat_messages;
CREATE POLICY "chat_messages_public_select" ON chat_messages
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "chat_messages_owner_insert" ON chat_messages;
CREATE POLICY "chat_messages_owner_insert" ON chat_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::uuid
  );
DROP POLICY IF EXISTS "chat_messages_admin_delete" ON chat_messages;
CREATE POLICY "chat_messages_admin_delete" ON chat_messages
  FOR DELETE USING (
    is_requester_admin()
  );
ALTER TABLE IF EXISTS user_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_stats_owner_select" ON user_stats;
CREATE POLICY "user_stats_owner_select" ON user_stats
  FOR SELECT USING (
    user_id = auth.uid()::uuid OR is_requester_admin()
  );
DROP POLICY IF EXISTS "user_stats_owner_update" ON user_stats;
CREATE POLICY "user_stats_owner_update" ON user_stats
  FOR UPDATE USING (
    user_id = auth.uid()::uuid OR is_requester_admin()
  ) WITH CHECK (
    user_id = auth.uid()::uuid OR is_requester_admin()
  );

-- Secure play_game function
CREATE OR REPLACE FUNCTION play_game(
  p_game_type VARCHAR,
  p_user_id UUID
)
RETURNS TABLE (
  result VARCHAR,
  reward_amount DECIMAL,
  reward_type VARCHAR,
  random_seed VARCHAR
) AS $$
DECLARE
  v_win_prob DECIMAL;
  v_is_enabled BOOLEAN;
  v_seed VARCHAR;
  v_win BOOLEAN;
  v_reward DECIMAL := 0;
  v_reward_type VARCHAR := 'none';
  v_tokens BIGINT;
  v_token_cost INT := 15;
  v_guaranteed_turns INT;
  v_total_deposited DECIMAL(12,2);
  v_max_reward DECIMAL(10,2) := 10.00;
BEGIN
  -- Check frozen status
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id AND frozen = true) THEN
    RAISE EXCEPTION 'Account is frozen';
  END IF;

  -- Check if user has tokens
  SELECT tokens INTO v_tokens FROM public.user_profiles WHERE id = p_user_id;
  IF v_tokens IS NULL OR v_tokens < v_token_cost THEN
    RAISE EXCEPTION 'Insufficient tokens';
  END IF;

  -- Get game settings
  SELECT win_probability, is_enabled INTO v_win_prob, v_is_enabled
  FROM admin_game_settings WHERE game_type = p_game_type;

  IF v_is_enabled = false THEN
    RAISE EXCEPTION 'Game is disabled';
  END IF;

  -- Check guaranteed turns
  SELECT remaining_guaranteed_turns INTO v_guaranteed_turns FROM public.user_profiles WHERE id = p_user_id;

  -- Generate random seed
  v_seed := md5(random()::text || clock_timestamp()::text);

  -- Determine result: force win if guaranteed turns remain
  IF v_guaranteed_turns IS NOT NULL AND v_guaranteed_turns > 0 THEN
    v_win := true;
    UPDATE public.user_profiles SET remaining_guaranteed_turns = remaining_guaranteed_turns - 1 WHERE id = p_user_id;
  ELSE
    v_win := (random() < COALESCE(v_win_prob, 0.35));
  END IF;

  -- Calculate reward based on game type with RTP logic
  IF v_win THEN
    SELECT total_deposited INTO v_total_deposited FROM public.user_profiles WHERE id = p_user_id;
    
    CASE p_game_type
      WHEN 'coin_flip' THEN
        v_reward := 0.05;
        v_reward_type := 'cash';
      WHEN 'treasure_hunt' THEN
        v_reward := (floor(random() * 10 + 1) / 100);
        v_reward_type := 'cash';
      WHEN 'lucky_spin' THEN
        v_reward := (ARRAY[0.01, 0.05, 0.10])[floor(random() * 3 + 1)];
        v_reward_type := 'cash';
      WHEN 'card_pick' THEN
        v_reward := (ARRAY[0.01, 0.05, 0.10, 0.30])[floor(random() * 4 + 1)];
        v_reward_type := 'cash';
      WHEN 'ladder_climb' THEN
        v_reward := (floor(random() * 10 + 1) / 100);
        v_reward_type := 'cash';
    END CASE;
    
    -- Apply RTP-based adjustments
    IF v_total_deposited <= 30 THEN
      v_reward := v_reward * 0.40;
    ELSE
      v_reward := v_reward * 0.45;
    END IF;
    
    v_reward := LEAST(v_reward, v_max_reward);
  END IF;

  -- Deduct token cost
  UPDATE public.user_profiles SET tokens = tokens - v_token_cost, updated_at = NOW() WHERE id = p_user_id;

  -- Record token transaction for the play
  INSERT INTO token_transactions (user_id, type, amount, source)
  VALUES (p_user_id, 'play', -v_token_cost, 'purchase');

  -- Create game session
  INSERT INTO game_sessions (user_id, game_type, token_cost, result, reward_amount, reward_type, random_seed)
  VALUES (p_user_id, p_game_type, v_token_cost, CASE WHEN v_win THEN 'win' ELSE 'loss' END, v_reward, v_reward_type, v_seed);

  -- If win, add reward to user_profiles
  IF v_win AND v_reward > 0 THEN
    IF v_reward_type = 'cash' THEN
      UPDATE public.user_profiles
      SET cash_balance = cash_balance + v_reward,
          troll_coins = troll_coins + (v_reward * 100)::BIGINT,
          total_won = total_won + v_reward,
          updated_at = NOW()
      WHERE id = p_user_id;

      -- Record coin_transactions for cash reward (amount in cents)
      INSERT INTO public.coin_transactions (user_id, type, amount, price_usd, status, created_at)
      VALUES (p_user_id, 'bonus', round(v_reward * 100)::BIGINT, v_reward, 'completed', NOW());

    ELSIF v_reward_type = 'token' THEN
      UPDATE public.user_profiles
      SET tokens = tokens + (v_reward::BIGINT),
          updated_at = NOW()
      WHERE id = p_user_id;

      INSERT INTO token_transactions (user_id, type, amount, source)
      VALUES (p_user_id, 'reward', (v_reward::BIGINT), 'purchase');
    ELSE
      UPDATE public.user_profiles
      SET troll_coins = troll_coins + (v_reward * 100)::BIGINT,
          total_won = total_won + v_reward,
          updated_at = NOW()
      WHERE id = p_user_id;
    END IF;
  END IF;

  RETURN QUERY SELECT 
    CASE WHEN v_win THEN 'win' ELSE 'loss' END,
    v_reward,
    v_reward_type,
    v_seed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2026-07 MAI Pay cashout / daily rewards / no-turn updates
ALTER TABLE public.user_profiles
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

NOTIFY pgrst, 'reload schema';
