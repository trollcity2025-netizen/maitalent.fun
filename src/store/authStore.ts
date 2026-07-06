import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Profile, Wallet } from '../types';

interface AuthState {
  user: Profile | null;
  wallet: Wallet | null;
  loading: boolean;
  isAdmin: boolean;
  hypeCoins: number;
  giftCardProgress: number;
  setUser: (user: Profile | null) => void;
  setWallet: (wallet: Wallet | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, username: string, realName: string, dateOfBirth: string, address: string, city: string, state: string, zip: string, ssnLast4: string, signupMeta?: { ip?: string; deviceFingerprint?: string; latitude?: number; longitude?: number }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  loadUser: () => Promise<void>;
}

function profileToWallet(profile: Profile | null): Wallet | null {
  if (!profile) return null;
  return {
    id: profile.id,
    user_id: profile.id,
    coin_balance: profile.troll_coins ?? 0,
    token_balance: profile.tokens ?? 0,
    hype_coins: profile.hype_coins ?? 0,
    cash_balance: profile.cash_balance ?? 0,
    total_deposited: profile.total_deposited ?? 0,
    total_won: profile.total_won ?? 0,
    total_cashed_out: profile.total_cashed_out ?? 0,
    updated_at: profile.updated_at || profile.created_at || new Date().toISOString(),
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  wallet: null,
  loading: true,
  isAdmin: false,
  hypeCoins: 0,
  giftCardProgress: 0,

  setUser: (user) => set({ user, wallet: profileToWallet(user), isAdmin: user?.is_admin || false }),
  setWallet: (wallet) => set({ wallet }),

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    await get().loadUser();
    return { error: null };
  },

  signUp: async (email, password, username, realName, dateOfBirth, address, city, state, zip, ssnLast4, signupMeta) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) return { error: error.message };

      const user = data.user;
      if (!user?.id) {
        return { error: 'Signup requires email confirmation. Please check your inbox and confirm before signing in.' };
      }

      const uid = user.id;
      const displayName = username || user.user_metadata?.username || email.split('@')[0] || 'User';

      const { error: profileError } = await supabase.from('user_profiles').upsert({
        id: uid,
        username: displayName,
        email: user.email,
        full_name: realName || displayName,
        date_of_birth: dateOfBirth || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        ssn_last4: ssnLast4 || null,
        signup_ip: signupMeta?.ip || null,
        signup_device_fingerprint: signupMeta?.deviceFingerprint || null,
        signup_latitude: signupMeta?.latitude ?? null,
        signup_longitude: signupMeta?.longitude ?? null,
        troll_coins: 5,
        tokens: 5,
        total_won: 0.05,
      }, { onConflict: 'id' });
      if (profileError) console.error('[signUp] user_profiles upsert error:', profileError);

      await get().loadUser();
      return { error: null };
    } catch (e) {
      console.error('[signUp] unexpected error:', e);
      return { error: 'An unexpected error occurred during signup.' };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, wallet: null, isAdmin: false, hypeCoins: 0, giftCardProgress: 0 });
  },

  loadUser: async () => {
    set({ loading: true });
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        set({ user: null, wallet: null, loading: false, isAdmin: false });
        return;
      }

      const uid = authUser.id;
      const email = authUser.email;
      const displayName = authUser.user_metadata?.username || email?.split('@')[0] || 'User';

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      let finalProfile = profile as Profile | null;
      if (!finalProfile) {
        const { data: newProfile } = await supabase
          .from('user_profiles')
          .insert({ id: uid, username: displayName, email, troll_coins: 5, tokens: 5, total_won: 0.05 })
          .select()
          .single();
        finalProfile = newProfile as Profile | null;
      }

      set({ 
        user: finalProfile, 
        wallet: profileToWallet(finalProfile), 
        hypeCoins: finalProfile?.hype_coins ?? 0,
        giftCardProgress: finalProfile?.gift_card_progress ?? 0,
        loading: false, 
        isAdmin: finalProfile?.is_admin || false 
      });
    } catch (e) {
      console.error('[loadUser] error:', e);
      set({ user: null, wallet: null, loading: false, isAdmin: false });
    }
  },
}));