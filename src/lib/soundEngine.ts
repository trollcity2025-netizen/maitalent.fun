import { create } from 'zustand';

type SoundAction = 'start' | 'win' | 'lose' | 'cash_reward' | 'token_reward' | 'hype_reward' | 'gift_card' | 'error';

interface SoundConfig {
  game: string;
  action: SoundAction;
  url: string;
}

const SOUND_CONFIG: Record<string, SoundConfig[]> = {
  ladder_climb: [
    { game: 'ladder_climb', action: 'start', url: '/sounds/ladder_start.mp3' },
    { game: 'ladder_climb', action: 'win', url: '/sounds/ladder_win.mp3' },
    { game: 'ladder_climb', action: 'lose', url: '/sounds/ladder_lose.mp3' },
    { game: 'ladder_climb', action: 'cash_reward', url: '/sounds/cash_reward.mp3' },
    { game: 'ladder_climb', action: 'error', url: '/sounds/error.mp3' },
  ],
  lucky_spin: [
    { game: 'lucky_spin', action: 'start', url: '/sounds/spin_start.mp3' },
    { game: 'lucky_spin', action: 'win', url: '/sounds/spin_win.mp3' },
    { game: 'lucky_spin', action: 'lose', url: '/sounds/spin_lose.mp3' },
    { game: 'lucky_spin', action: 'token_reward', url: '/sounds/token_reward.mp3' },
    { game: 'lucky_spin', action: 'gift_card', url: '/sounds/gift_card.mp3' },
    { game: 'lucky_spin', action: 'cash_reward', url: '/sounds/cash_reward.mp3' },
    { game: 'lucky_spin', action: 'error', url: '/sounds/error.mp3' },
  ],
  card_pick: [
    { game: 'card_pick', action: 'start', url: '/sounds/card_start.mp3' },
    { game: 'card_pick', action: 'win', url: '/sounds/card_win.mp3' },
    { game: 'card_pick', action: 'lose', url: '/sounds/card_lose.mp3' },
    { game: 'card_pick', action: 'cash_reward', url: '/sounds/cash_reward.mp3' },
    { game: 'card_pick', action: 'token_reward', url: '/sounds/token_reward.mp3' },
    { game: 'card_pick', action: 'error', url: '/sounds/error.mp3' },
  ],
  treasure_hunt: [
    { game: 'treasure_hunt', action: 'start', url: '/sounds/hunt_start.mp3' },
    { game: 'treasure_hunt', action: 'win', url: '/sounds/hunt_win.mp3' },
    { game: 'treasure_hunt', action: 'lose', url: '/sounds/hunt_lose.mp3' },
    { game: 'treasure_hunt', action: 'cash_reward', url: '/sounds/cash_reward.mp3' },
    { game: 'treasure_hunt', action: 'token_reward', url: '/sounds/token_reward.mp3' },
    { game: 'treasure_hunt', action: 'hype_reward', url: '/sounds/hype_reward.mp3' },
    { game: 'treasure_hunt', action: 'error', url: '/sounds/error.mp3' },
  ],
};

interface SoundEngine {
  audioContext: AudioContext | null;
  initialized: boolean;
  initialize: () => Promise<void>;
  play: (game: string, action: SoundAction) => Promise<void>;
  loadSounds: (game: string) => Promise<AudioBuffer[]>;
}

const useSoundEngine = create<SoundEngine>()((set, get) => ({
  audioContext: null,
  initialized: false,
  initialize: async () => {
    if (get().initialized) return;
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        set({ audioContext: ctx, initialized: true });
      }
    } catch (error) {
      console.warn('[SoundEngine] Failed to initialize Web Audio API');
    }
  },
  
  play: async (game: string, action: SoundAction) => {
    if (!get().initialized) {
      await get().initialize();
    }
    
    const config = SOUND_CONFIG[game]?.find(c => c.action === action);
    if (!config) {
      console.warn(`[SoundEngine] No sound config for ${game}:${action}`);
      return;
    }
    
    try {
      const response = await fetch(config.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = get().audioContext;

      if (!audioContext) {
        // fallback to HTMLAudioElement
        const audio = new Audio(config.url);
        await audio.play().catch((e) => console.warn('[SoundEngine] audio element play failed', e));
        return;
      }

      try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);
      } catch (decodeErr) {
        console.warn(`[SoundEngine] decodeAudioData failed for ${config.url}`, decodeErr);
        // fallback to HTMLAudioElement when decoding fails (corrupt file, unsupported codec, CORS)
        try {
          const audio = new Audio(config.url);
          await audio.play().catch((e) => console.warn('[SoundEngine] audio element play failed', e));
        } catch (audioErr) {
          console.warn(`[SoundEngine] Fallback audio element failed for ${config.url}`, audioErr);
        }
      }
    } catch (error) {
      console.warn(`[SoundEngine] Failed to play sound: ${config.url}`, error);
      // final fallback: try HTMLAudioElement even if fetch failed (handles relative paths in some hosts)
      try {
        const audio = new Audio(config.url);
        await audio.play().catch(() => {});
      } catch {}
    }
  },
  
  loadSounds: async (game: string) => {
    const configs = SOUND_CONFIG[game] || [];
    const buffers: AudioBuffer[] = [];
    
    const audioContext = get().audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
    
    for (const config of configs) {
      try {
        const response = await fetch(config.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        try {
          const buffer = await audioContext.decodeAudioData(arrayBuffer);
          buffers.push(buffer);
        } catch (decodeErr) {
          console.warn(`[SoundEngine] decodeAudioData failed for ${config.url}`, decodeErr);
        }
      } catch (error) {
        console.warn(`[SoundEngine] Failed to load sound: ${config.url}`, error);
      }
    }
    
    return buffers;
  }
}));

export { useSoundEngine, SOUND_CONFIG };