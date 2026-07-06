import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import { useGameStore } from '../store/gameStore';
import { supabase } from '../lib/supabase';
import SEO from '../components/SEO';

type Reward = { type: 'cash'; amount: number } | { type: 'token' } | { type: 'no_turn' } | { type: 'hype_coin' } | { type: 'none' };

interface ChestResult {
  reward: Reward;
}

const GRID_SIZE = 16;
const GAME_COST = 5;

function generateChests(): number[] {
  const positions = new Set<number>();
  while (positions.size < GRID_SIZE) {
    positions.add(Math.floor(Math.random() * GRID_SIZE));
  }
  return Array.from(positions);
}

function simulateReward(): ChestResult {
  const roll = Math.random();
  if (roll < 0.25) {
    const amounts = [0.01, 0.02, 0.03, 0.05, 0.08, 0.10];
    return { reward: { type: 'cash', amount: amounts[Math.floor(Math.random() * amounts.length)] } };
  }
  if (roll < 0.35) return { reward: { type: 'token' } };
  if (roll < 0.36) return { reward: { type: 'hype_coin' } };
  if (roll < 0.45) return { reward: { type: 'no_turn' } };
  return { reward: { type: 'none' } };
}

function rewardLabel(r: Reward): string {
  switch (r.type) {
    case 'cash': return `$${r.amount.toFixed(2)}!`;
    case 'token': return 'Free Token!';
    case 'no_turn': return 'No Turn Chance!';
    case 'hype_coin': return '+1 Hype Coin!';
    case 'none': return 'Empty!';
  }
}

function rewardEmoji(r: Reward): string {
  switch (r.type) {
    case 'cash': return '💰';
    case 'token': return '🪙';
    case 'no_turn': return '⏳';
    case 'hype_coin': return '🔥';
    case 'none': return '😢';
  }
}

export default function MaiTreasureHunt() {
  const { user } = useAuthStore();
  const { wallet, refreshWallet, loadTokenTransactions } = useWalletStore();
  const { loadSessions } = useGameStore();
  const [chests, setChests] = useState<number[]>([]);
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<{ show: boolean; reward: Reward | null }>({ show: false, reward: null });

  useEffect(() => {
    setChests(generateChests());
  }, []);

const openChest = useCallback(async (idx: number) => {
  if (!user || opened.has(idx) || (wallet?.token_balance ?? 0) < GAME_COST) return;

  let result: ChestResult;
  let backendSuccess = false;
  try {
    const { data, error } = await supabase.rpc('play_game', {
      p_game_type: 'treasure_hunt',
      p_user_id: user.id,
    });
    if (error) {
      console.error('[MaiTreasureHunt] play_game rpc error', error);
      backendSuccess = false;
      result = simulateReward();
    } else {
      backendSuccess = true;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        backendSuccess = false;
        result = simulateReward();
      } else {
        const won = row.result === 'win';
        if (won && row.reward_type === 'cash' && row.reward_amount > 0) {
          result = { reward: { type: 'cash', amount: parseFloat(row.reward_amount) } };
        } else if (won && row.reward_type === 'token') {
          result = { reward: { type: 'token' } };
        } else if (won && (row.reward_type === 'gift_card' || row.reward_type === 'no_turn')) {
          result = { reward: { type: 'no_turn' } };
        } else if (won && row.reward_type === 'hype_coin') {
          result = { reward: { type: 'hype_coin' } };
        } else {
          result = { reward: { type: 'none' } };
        }
      }
    }
  } catch (err) {
    console.error('[MaiTreasureHunt] play_game exception', err);
    backendSuccess = false;
    result = simulateReward();
  }

  setOpened((prev) => new Set(prev).add(idx));
  setModal({ show: true, reward: result.reward });

  if (user?.id) {
    try {
      if (!backendSuccess) {
        if (result.reward.type === 'token') {
          await supabase.from('user_profiles').update({ tokens: (wallet?.token_balance ?? 0) + 1 }).eq('id', user.id);
          await supabase.from('token_transactions').insert({ user_id: user.id, type: 'reward', amount: 1, source: 'free' });
        } else if (result.reward.type === 'no_turn') {
          if (Math.random() < 0.30) {
            const minutes = [1, 3, 5][Math.floor(Math.random() * 3)];
            const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
            await supabase.from('user_profiles').update({ no_turn_until: until }).eq('id', user.id);
          }
        } else if (result.reward.type === 'hype_coin') {
          await supabase.from('user_profiles').update({ hype_coins: (wallet?.hype_coins ?? 0) + 1 }).eq('id', user.id);
} else if (result.reward.type === 'cash') {
                    try {
                      const payout = result.reward.amount;
                      const { data: profile, error: profileError } = await supabase
                        .from('user_profiles')
                        .select('cash_balance,total_won')
                        .eq('id', user.id)
                        .single();

                      if (profileError) {
                        console.warn('[MaiTreasureHunt] reward profile lookup failed:', profileError);
                      } else {
                        const { error: updateError } = await supabase
                          .from('user_profiles')
                          .update({
                            cash_balance: Number((Number(profile?.cash_balance ?? 0) + payout).toFixed(2)),
                            total_won: Number((Number(profile?.total_won ?? 0) + payout).toFixed(2)),
                            updated_at: new Date().toISOString(),
                          })
                          .eq('id', user.id);

                        if (updateError) {
                          console.warn('[MaiTreasureHunt] reward update failed:', updateError);
                        } else {
                          const coinAmount = Math.round(payout * 100);
                          const { error: transactionError } = await supabase.from('coin_transactions').insert({
                            user_id: user.id,
                            type: 'reward',
                            amount: coinAmount,
                            price_usd: payout,
                            status: 'completed',
                          });
                          if (transactionError) console.warn('[MaiTreasureHunt] reward transaction failed:', transactionError);
                        }
                      }
                    } catch (err) {
                      console.error('[MaiTreasureHunt] reward processing exception:', err);
                    }
                  }
      }
    } catch (err) {
      console.warn('[MaiTreasureHunt] fallback updates failed', err);
    }

    try {
      await Promise.all([
        refreshWallet(user.id),
        loadTokenTransactions(user.id),
        loadSessions(user.id),
      ]);
    } catch (err) {
      console.warn('[MaiTreasureHunt] refresh failed', err);
    }
  }
}, [user, opened, wallet?.token_balance, wallet?.hype_coins, refreshWallet, loadTokenTransactions, loadSessions]);

  const reset = () => {
    setChests(generateChests());
    setOpened(new Set());
    setModal({ show: false, reward: null });
  };

  return (
    <>
      <SEO title="Mai Treasure Hunt" description="Find hidden treasure chests in the city!" />
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
        <h1 className="neon-text-pink" style={{ fontSize: '2rem', textShadow: '0 0 10px #ff00ff, 0 0 20px #ff00ff' }}>
          Mai Treasure Hunt
        </h1>

        {user && (
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <p style={{ color: '#00ff88' }}>Tokens: <strong>{wallet?.token_balance ?? 0}</strong></p>
            <p style={{ color: '#ff2d95' }}>Hype: <strong>{wallet?.hype_coins ?? 0}</strong></p>
          </div>
        )}
        {!user && (
          <div className="card neon-border" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ color: '#ff66cc' }}>Sign in to play!</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {Array.from({ length: GRID_SIZE }, (_, i) => {
            const isChest = chests.includes(i);
            const wasOpened = opened.has(i);
            return (
              <button
                key={i}
                className="neon-border"
                onClick={() => isChest && !wasOpened && openChest(i)}
                disabled={!user || wasOpened}
                style={{
                  aspectRatio: '1',
                  fontSize: '1.5rem',
                  borderRadius: '8px',
                  border: '2px solid #00aaff',
                  background: wasOpened ? 'rgba(255,255,255,0.05)' : 'rgba(20,20,50,0.8)',
                  cursor: user && !wasOpened ? 'pointer' : 'default',
                  boxShadow: !wasOpened ? '0 0 10px #00aaff' : 'none',
                  transition: 'all 0.3s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {wasOpened ? '❌' : '🎁'}
              </button>
            );
          })}
        </div>

        <button className="btn btn-primary neon-border" onClick={reset} style={{ padding: '0.6rem 1.5rem' }}>
          New Game
        </button>
      </div>

      {modal.show && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setModal({ show: false, reward: null })}
        >
          <div
            className="card neon-border"
            style={{ padding: '2rem', textAlign: 'center', maxWidth: '320px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
              {modal.reward ? rewardEmoji(modal.reward) : ''}
            </div>
            <p className="neon-text-green" style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>
              {modal.reward ? rewardLabel(modal.reward) : ''}
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: '1rem', padding: '0.5rem 1.5rem' }}
              onClick={() => setModal({ show: false, reward: null })}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
