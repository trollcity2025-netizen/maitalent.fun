-- Service-role RPC to run a game for a user (no auth.uid() ownership check)
-- Intended for server-side/service-role usage only.

CREATE OR REPLACE FUNCTION public.play_game_service(p_game_type VARCHAR, p_user_id UUID)
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
  -- No auth.uid() check: this RPC is only for service-role or trusted server callers.

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

   INSERT INTO public.token_transactions (user_id, type, amount, source) VALUES (p_user_id, 'play', -v_token_cost, 'purchase');

   INSERT INTO public.game_sessions (user_id, game_type, token_cost, result, reward_amount, reward_type, random_seed)
   VALUES (p_user_id, p_game_type, v_token_cost, CASE WHEN v_win THEN 'win' ELSE 'loss' END, v_reward, v_reward_type, v_seed);

  IF v_win AND v_reward > 0 AND v_reward_type = 'cash' THEN
    INSERT INTO public.coin_transactions (user_id, type, amount, price_usd, status, created_at)
    VALUES (p_user_id, 'bonus', round(v_reward * 100)::BIGINT, v_reward, 'completed', now());
  END IF;

  RETURN QUERY SELECT CASE WHEN v_win THEN 'win' ELSE 'loss' END::VARCHAR, v_reward, v_reward_type, v_seed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
