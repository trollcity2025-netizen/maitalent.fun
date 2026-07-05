import { supabase } from './supabase';

/**
 * Shared helper to award cash rewards consistently across all games.
 * 
 * Only call this when:
 * - The backend play_game RPC fails and you're using a fallback simulation, OR
 * - You need to add frontend-generated rewards
 * 
 * Do NOT call if play_game succeeded and already awarded the cash.
 */
export async function awardCashReward(userId: string, payout: number): Promise<void> {
  if (!userId || payout <= 0) return;

  try {
    // Get current balances
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('cash_balance,total_won')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.warn('[awardCashReward] profile lookup failed:', profileError);
      return;
    }

    const currentCashBalance = Number(profile?.cash_balance ?? 0);
    const currentTotalWon = Number(profile?.total_won ?? 0);

    // Update balances
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        cash_balance: Number((currentCashBalance + payout).toFixed(2)),
        total_won: Number((currentTotalWon + payout).toFixed(2)),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.warn('[awardCashReward] update failed:', updateError);
      return;
    }

    // Insert transaction record (in cents for coin_transactions)
    const coinAmount = Math.round(payout * 100);
    const { error: transactionError } = await supabase
      .from('coin_transactions')
      .insert({
        user_id: userId,
        type: 'reward',
        amount: coinAmount,
        price_usd: payout,
        status: 'completed',
      });

    if (transactionError) {
      console.warn('[awardCashReward] transaction insert failed:', transactionError);
    }
  } catch (err) {
    console.error('[awardCashReward] exception:', err);
  }
}
