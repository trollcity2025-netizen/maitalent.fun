CREATE OR REPLACE FUNCTION public.get_admin_platform_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_requester_email text := current_setting('requester.email', true);
  v_is_admin boolean;
BEGIN
  -- Default to not admin
  v_is_admin := false;
  
  -- Get requester email from session context
  BEGIN
    SELECT current_setting('requester.email') INTO v_requester_email;
  EXCEPTION WHEN others THEN
    v_requester_email := NULL;
  END;

  -- Hardcoded admin email verification
  IF v_requester_email = current_setting('admin.email', true) THEN
    v_is_admin := true;
  END IF;

  -- Verify server-side admin status
  IF NOT v_is_admin THEN
    SELECT EXISTS (
      SELECT 1 
      FROM public.user_profiles 
      WHERE id = auth.uid()::uuid 
      AND (role = 'admin' OR is_admin = true)
    ) INTO v_is_admin;
  END IF;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'Unauthorized - admin access required');
  END IF;

  -- Continue with stats calculation...
  v_result := jsonb_build_object(
    'users_online', COALESCE(
      (SELECT COUNT(*) FROM public.presence WHERE last_seen > now() - interval '5 minutes'),
      0
    ),
    'total_purchases', COALESCE(
      (SELECT COUNT(*) FROM public.pending_paypal_orders WHERE status IN ('captured','completed')),
      0
    ),
    'total_purchase_usd', COALESCE(
      (SELECT SUM(price_usd) FROM public.pending_paypal_orders WHERE status IN ('captured','completed')),
      0
    ),
    'total_coins_sold', COALESCE(
      (SELECT SUM(coins) FROM public.pending_paypal_orders WHERE status IN ('captured','completed')),
      0
    ),
    'total_tokens_held', COALESCE(
      (SELECT COALESCE(SUM(troll_coins), 0) FROM public.user_profiles),
      0
    ),
    'total_winnings', COALESCE(
      (SELECT COALESCE(SUM(total_won), 0) FROM public.user_profiles),
      0
    ),
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