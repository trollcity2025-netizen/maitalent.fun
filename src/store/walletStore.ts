import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Wallet, CoinTransaction, TokenTransaction, GiftCardRedemption, Profile } from '../types';

interface WalletState {
  wallet: Wallet | null;
  coinTransactions: CoinTransaction[];
  tokenTransactions: TokenTransaction[];
  loading: boolean;
  hypeCoins: number;
  giftCardProgress: number;
  frozen: boolean;
  frozenUntil: string | null;
  loadWallet: (userId: string) => Promise<void>;
  loadCoinTransactions: (userId: string) => Promise<void>;
  loadTokenTransactions: (userId: string) => Promise<void>;
  refreshWallet: (userId: string) => Promise<void>;
  validateTokens: (userId: string, cost?: number) => Promise<{ valid: boolean; balance: number; message?: string }>;
  deductTokens: (userId: string, amount: number) => Promise<boolean>;
  updateBalance: (userId: string, updates: Partial<Profile>) => Promise<boolean>;
  convertTrollToTokens: (userId: string, amount: number) => Promise<void>;
  convertHypeToTokens: (userId: string, amount: number) => Promise<void>;
  addGiftCardProgress: (userId: string, amount: number) => Promise<void>;
  addHypeCoins: (userId: string, amount: number) => Promise<void>;
  addCashBalance: (userId: string, amount: number) => Promise<void>;
  addTrollCoins: (userId: string, amount: number) => Promise<void>;
  redeemGiftCard: (userId: string, amountUsd: number, email: string) => Promise<GiftCardRedemption | null>;
  redeemPromoCode: (userId: string, code: string) => Promise<{ success: boolean; message: string; tokenAmount?: number }>;
  isUserFrozen: (userId: string) => Promise<boolean>;
}

function profileToWallet(profile: Profile | null): Wallet | null {
  if (!profile) return null;
  return {
    id: profile.id,
    user_id: profile.id,
    coin_balance: profile.troll_coins ?? 0,
    token_balance: profile.tokens ?? 0,
    hype_coins: profile.hype_coins ?? 0,
    total_deposited: profile.total_deposited ?? 0,
    total_won: profile.total_won ?? 0,
    total_cashed_out: profile.total_cashed_out ?? 0,
    updated_at: profile.updated_at ?? profile.created_at,
  };
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet: null,
  coinTransactions: [],
  tokenTransactions: [],
  loading: false,
  hypeCoins: 0,
  giftCardProgress: 0,
  frozen: false,
  frozenUntil: null,

  loadWallet: async (userId) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) console.warn('[loadWallet] user_profiles query failed:', error.message);

    const profile = data as Profile | null;
    set({ 
      wallet: profileToWallet(profile), 
      loading: false,
      hypeCoins: profile?.hype_coins ?? 0,
      giftCardProgress: profile?.gift_card_progress ?? 0,
      frozen: profile?.frozen ?? false,
      frozenUntil: profile?.frozen_until ?? null,
    });
  },

  loadCoinTransactions: async (userId) => {
    const { data } = await supabase
      .from('coin_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    set({ coinTransactions: data || [] });
  },

  loadTokenTransactions: async (userId) => {
    const { data } = await supabase
      .from('token_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    set({ tokenTransactions: data || [] });
  },

  refreshWallet: async (userId) => {
    await get().loadWallet(userId);
  },

  validateTokens: async (_userId, cost = 1) => {
    const wallet = get().wallet;
    const balance = wallet?.token_balance ?? 0;
    const valid = balance >= cost;
    return { valid, balance, message: valid ? undefined : 'Not enough tokens' };
  },

  updateBalance: async (userId, updates) => {
    try {
      const { error } = await supabase.from('user_profiles').update(updates).eq('id', userId);
      if (error) throw error;
      await get().loadWallet(userId);
      return true;
    } catch (err) {
      console.error('[updateBalance] exception', err);
      return false;
    }
  },

  addHypeCoins: async (userId, amount) => {
    const current = get().wallet?.hype_coins ?? 0;
    const { error } = await supabase.from('user_profiles').update({ hype_coins: current + amount }).eq('id', userId);
    if (error) throw error;
    await get().loadWallet(userId);
  },

  addCashBalance: async (userId, amount) => {
    const current = get().wallet?.total_won ?? 0;
    const { error } = await supabase.from('user_profiles').update({ total_won: current + amount }).eq('id', userId);
    if (error) throw error;
    await get().loadWallet(userId);
  },

  addTrollCoins: async (userId, amount) => {
    const current = get().wallet?.coin_balance ?? 0;
    const { error } = await supabase.from('user_profiles').update({ troll_coins: current + amount }).eq('id', userId);
    if (error) throw error;
    await get().loadWallet(userId);
  },

  convertTrollToTokens: async (userId, amount) => {
    const { error } = await supabase.rpc('convert_troll_to_tokens', { p_user_id: userId, p_troll_amount: amount });
    if (error) throw error;
    await get().loadWallet(userId);
    await get().loadTokenTransactions(userId);
  },

  convertHypeToTokens: async (userId, amount) => {
    const { error } = await supabase.rpc('convert_hype_to_tokens', { p_user_id: userId, p_hype_amount: amount });
    if (error) throw error;
    await get().loadWallet(userId);
    await get().loadTokenTransactions(userId);
  },

  addGiftCardProgress: async (userId, amount) => {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('gift_card_progress')
      .eq('id', userId)
      .single();
    if (profileError) throw profileError;
    const currentProgress = profile?.gift_card_progress ?? 0;
    const { error } = await supabase
      .from('user_profiles')
      .update({ gift_card_progress: currentProgress + amount })
      .eq('id', userId);
    if (error) throw error;
    await get().loadWallet(userId);
  },

  redeemGiftCard: async (userId, amountUsd, email) => {
    const { data, error } = await supabase
      .from('gift_card_redemptions')
      .insert({ user_id: userId, amount_usd: amountUsd, gift_card_progress_used: get().giftCardProgress, email })
      .select()
      .single();
    if (error) throw error;
    await get().addGiftCardProgress(userId, -get().giftCardProgress);
    return data;
  },

  redeemPromoCode: async (userId, code) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session?.access_token ? `Bearer ${session.access_token}` : null;
      if (!authHeader) return { success: false, message: 'You must be signed in to redeem a promo code.' };

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/redeem-maitalent-promo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          'X-Client-Platform': 'maitalent.fun',
        },
        body: JSON.stringify({ code, requestor: { platform: 'maitalent.fun', accountId: userId } }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        return { success: false, message: payload.error || 'Promo redemption failed.', tokenAmount: payload.tokenAmount };
      }

      await get().loadWallet(userId);
      await get().loadTokenTransactions(userId);
      return { success: true, message: `Promo redeemed successfully! +${payload.tokenAmount ?? 0} tokens`, tokenAmount: payload.tokenAmount };
    } catch (error) {
      console.error('[redeemPromoCode] exception', error);
      return { success: false, message: 'Promo redemption failed.' };
    }
  },
  
  deductTokens: async (userId, amount) => {
    try {
      const { error } = await supabase.rpc('charge_tokens', { p_user_id: userId, p_cost: amount });
      if (error) {
        console.warn('[deductTokens] charge_tokens rpc error', error);
        return false;
      }
      await get().loadWallet(userId);
      await get().loadTokenTransactions(userId);
      return true;
    } catch (err) {
      console.error('[deductTokens] exception', err);
      return false;
    }
  },

  isUserFrozen: async (userId) => {
    // Prefer cached state, otherwise fetch from DB
    const state = get();
    if (state.wallet && state.wallet.user_id === userId) {
      if (state.frozen) return true;
      if (state.frozenUntil) {
        try {
          const until = new Date(state.frozenUntil);
          if (!isNaN(until.getTime()) && until > new Date()) return true;
        } catch {}
      }
    }
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('frozen, frozen_until')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        console.warn('[isUserFrozen] query error', error);
        return false;
      }
      const frozen = data?.frozen ?? false;
      const frozenUntil = data?.frozen_until ?? null;
      set({ frozen, frozenUntil });
      if (frozen) return true;
      if (frozenUntil) {
        const until = new Date(frozenUntil);
        return !isNaN(until.getTime()) && until > new Date();
      }
      return false;
    } catch (err) {
      console.error('[isUserFrozen] exception', err);
      return false;
    }
  },
}));
