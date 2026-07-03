import { create } from 'zustand';
import type { AdminGameSettings, GameSession } from '../types';

interface GameState {
  settings: AdminGameSettings[];
  sessions: GameSession[];
  loading: boolean;
  loadSettings: () => Promise<void>;
  loadSessions: (userId: string) => Promise<void>;
}

export const useGameStore = create<GameState>((set) => ({
  settings: [],
  sessions: [],
  loading: false,

  loadSettings: async () => {
    set({ loading: true });
    const { data } = await (await import('../lib/supabase')).supabase
      .from('admin_game_settings')
      .select('*');
    set({ settings: data || [], loading: false });
  },

  loadSessions: async (userId) => {
    set({ loading: true });
    const supabase = (await import('../lib/supabase')).supabase;
    const { data, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.warn('[loadSessions] query failed:', error.message);
    }
    set({ sessions: data || [], loading: false });
  },
}));
