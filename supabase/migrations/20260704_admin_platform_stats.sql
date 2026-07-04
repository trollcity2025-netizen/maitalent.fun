-- Admin-only platform statistics RPC
-- Returns aggregated stats for admin dashboard viewing
-- Uses SECURITY DEFINER to bypass RLS and check admin status internally

CREATE OR REPLACE FUNCTION public.get_admin_platform_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_users_online bigint;
  v_total_purchases bigint;
  v_total_purchase_usd numeric;
  v_total_coins_sold bigint;
  v_total_tokens_held bigint;
  v_total_winnings numeric;
  v_result jsonb;
BEGIN
  -- Verify requester is admin
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid()::uuid AND (role = 'admin' OR is_admin = true)) THEN
    RETURN jsonb_build_object('error', 'Unauthorized - admin access required');
  END IF;

  -- Users online: count distinct user IDs in presence table (if exists)
  BEGIN
    SELECT COUNT(*) INTO v_users_online FROM public.presence WHERE last_seen > now() - interval '5 minutes';
  EXCEPTION WHEN undefined_table THEN
    v_users_online := 0;
  END;

  -- Total purchases: count completed/captured orders
  SELECT COUNT(*) INTO v_total_purchases
  FROM public.pending_paypal_orders
  WHERE status IN ('captured', 'completed');

  -- Total USD purchase amount: sum price_usd for completed/captured orders
  SELECT COALESCE(SUM(price_usd), 0) INTO v_total_purchase_usd
  FROM public.pending_paypal_orders
  WHERE status IN ('captured', 'completed');

  -- Total coins sold: sum coins from completed orders (alternative: coin_transactions)
  SELECT COALESCE(SUM(coins), 0) INTO v_total_coins_sold
  FROM public.pending_paypal_orders
  WHERE status IN ('captured', 'completed');

  -- Total tokens held: sum troll_coins from user_profiles
  BEGIN
    SELECT COALESCE(SUM(troll_coins), 0) INTO v_total_tokens_held
    FROM public.user_profiles;
  EXCEPTION WHEN undefined_column THEN
    -- Fallback to token_balance column if troll_coins doesn't exist
    BEGIN
      SELECT COALESCE(SUM(tokens), 0) INTO v_total_tokens_held
      FROM public.user_profiles;
    EXCEPTION WHEN undefined_column THEN
      v_total_tokens_held := 0;
    END;
  END;

  -- Total winnings: sum total_won from user_profiles (if column exists)
  BEGIN
    SELECT COALESCE(SUM(total_won), 0) INTO v_total_winnings
    FROM public.user_profiles;
  EXCEPTION WHEN undefined_column THEN
    -- Fallback to cash_balance if total_won doesn't exist
    BEGIN
      SELECT COALESCE(SUM(cash_balance), 0) INTO v_total_winnings
      FROM public.user_profiles;
    EXCEPTION WHEN undefined_column THEN
      v_total_winnings := 0;
    END;
  END;

  v_result := jsonb_build_object(
    'users_online', v_users_online,
    'total_purchases', v_total_purchases,
    'total_purchase_usd', v_total_purchase_usd,
    'total_coins_sold', v_total_coins_sold,
    'total_tokens_held', v_total_tokens_held,
    'total_winnings', v_total_winnings,
    'updated_at', now()
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', 'Failed to fetch stats: ' || SQLERRM,
    'users_online', 0,
    'total_purchases', 0,
    'total_purchase_usd', 0,
    'total_coins_sold', 0,
    'total_tokens_held', 0,
    'total_winnings', 0,
    'updated_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.get_admin_platform_stats() IS 'Returns platform-wide stats for admin dashboard (read-only, admin-only)';