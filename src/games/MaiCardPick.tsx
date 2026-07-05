import { useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import { useGameStore } from '../store/gameStore';
import { supabase } from '../lib/supabase';
import SEO from '../components/SEO';

const REWARDS = ['Free Turn', '$0.01', '$0.05', '$0.10', '$0.30', 'No Win'];
const CARD_COLORS = ['#00aaff', '#ff0080', '#00ff88'];
const GAME_COST = 15;

interface CardResult {
  rewards: [string, string, string];
  payout: number;
}

function simulateCards(): CardResult {
  const shuffled = [...REWARDS].sort(() => Math.random() - 0.5);
  const rewards: [string, string, string] = [shuffled[0], shuffled[1], shuffled[2]];
  const winReward = rewards[Math.floor(Math.random() * 3)];
  const payout = winReward.startsWith('$') ? parseFloat(winReward.slice(1)) : 0;
  return { rewards, payout };
}

export default function MaiCardPick() {
  const { user } = useAuthStore();
  const { wallet, refreshWallet, loadTokenTransactions } = useWalletStore();
  const { loadSessions } = useGameStore();
  const [cards, setCards] = useState<CardResult | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const pickCard = useCallback(async (idx: number) => {
    if (!user || (wallet?.token_balance ?? 0) < GAME_COST || picked !== null) return;

    let result: CardResult;
    let backendSuccess = true;
    try {
      const { data, error } = await supabase.rpc('play_game', {
        p_game_type: 'card_pick',
        p_user_id: user.id,
      });
      if (error) {
        console.error('[MaiCardPick] play_game rpc error', error);
        backendSuccess = false;
        result = simulateCards();
      } else if (!data || (Array.isArray(data) && data.length === 0)) {
        backendSuccess = false;
        result = simulateCards();
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        const won = row.result === 'win';
        const payout = won ? Number(row.reward_amount || 0) : 0;

        const displayReward =
          payout > 0 ? `$${payout.toFixed(2)}` :
          row.reward_type === 'free_turn' ? 'Free Turn' :
          'No Win';

        const otherRewards = REWARDS
          .filter(r => r !== displayReward)
          .sort(() => Math.random() - 0.5);

        const rewards: [string, string, string] = ['No Win', 'No Win', 'No Win'];

        rewards[idx] = displayReward;

        let otherIndex = 0;
        for (let i = 0; i < 3; i++) {
          if (i !== idx) {
            rewards[i] = otherRewards[otherIndex++] || 'No Win';
          }
        }

        result = { rewards, payout };
      }
    } catch (err) {
      console.error('[MaiCardPick] play_game exception', err);
      backendSuccess = false;
      result = simulateCards();
    }

    setCards(result);
    setPicked(idx);

      setTimeout(async () => {
      setRevealed(true);
      if (user?.id) {
        try {
          if (!backendSuccess && result.payout > 0) {
            try {
              const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('cash_balance,total_won')
                .eq('id', user.id)
                .single();

              if (profileError) {
                console.warn('[MaiCardPick] reward profile lookup failed:', profileError);
              } else {
                const { error: updateError } = await supabase
                  .from('user_profiles')
                  .update({
                    cash_balance: Number((Number(profile?.cash_balance ?? 0) + result.payout).toFixed(2)),
                    total_won: Number((Number(profile?.total_won ?? 0) + result.payout).toFixed(2)),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', user.id);

                if (updateError) {
                  console.warn('[MaiCardPick] reward update failed:', updateError);
                } else {
                  const coinAmount = Math.round(result.payout * 100);
                  const { error: transactionError } = await supabase.from('coin_transactions').insert({
                    user_id: user.id,
                    type: 'reward',
                    amount: coinAmount,
                    price_usd: result.payout,
                    status: 'completed',
                  });
                  if (transactionError) console.warn('[MaiCardPick] reward transaction failed:', transactionError);
                }
              }
            } catch (err) {
              console.error('[MaiCardPick] reward processing exception:', err);
            }
          }

          await Promise.all([
            refreshWallet(user.id),
            loadTokenTransactions(user.id),
            loadSessions(user.id),
          ]);
        } catch (err) {
          console.warn('[MaiCardPick] refresh failed', err);
        }
      }
    }, 600);
  }, [user, picked, refreshWallet, loadTokenTransactions]);

  const reset = () => {
    setCards(null);
    setPicked(null);
    setRevealed(false);
  };

  return (
    <>
      <SEO title="Mai Card Pick" description="Pick a card and reveal your prize!" />
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
        <h1 className="neon-text-pink" style={{ fontSize: '2rem', textShadow: '0 0 10px #ff00ff, 0 0 20px #ff00ff' }}>
          Mai Card Pick
        </h1>

        {user && <p style={{ color: '#00ff88', marginBottom: '1rem' }}>Tokens: <strong>{wallet?.token_balance ?? 0}</strong></p>}
        {!user && (
          <div className="card neon-border" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ color: '#ff66cc' }}>Sign in to play!</p>
          </div>
        )}

<div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
           {CARD_COLORS.map((color, i) => {
const showFront = revealed;
              const reward = cards?.rewards[i] ?? '';
              const isWin = reward.startsWith('$') || reward === 'Free Turn';

            return (
              <div
                key={i}
                onClick={() => pickCard(i)}
                style={{
                  width: '100px',
                  height: '140px',
                  perspective: '600px',
                  cursor: picked === null && user ? 'pointer' : 'default',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    transformStyle: 'preserve-3d',
                    transform: showFront ? 'rotateY(180deg)' : 'rotateY(0)',
                    transition: 'transform 0.6s ease',
                  }}
                >
                  {/* Back of card (face down) */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '12px',
                      background: `linear-gradient(135deg, ${color}, #1a1a2e)`,
                      border: `2px solid ${color}`,
                      boxShadow: `0 0 12px ${color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2rem',
                      color: '#fff',
                      backfaceVisibility: 'hidden',
                    }}
                  >
                    ?
                  </div>
                  {/* Front of card (face up) */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '12px',
                      background: isWin ? 'linear-gradient(135deg, #00ff88, #00cc66)' : 'linear-gradient(135deg, #333, #222)',
                      border: `2px solid ${isWin ? '#00ff88' : '#555'}`,
                      boxShadow: isWin ? '0 0 16px #00ff88' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      color: isWin ? '#000' : '#ff66cc',
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      padding: '0.25rem',
                      textAlign: 'center',
                    }}
                  >
                    {reward}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {revealed && cards && (
          <div className="card neon-border" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <p className={cards.payout > 0 ? 'neon-text-green' : 'neon-text-pink'} style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>
              {cards.payout > 0 ? `You Win $${cards.payout.toFixed(2)}!` : 'Try Again!'}
            </p>
          </div>
        )}

        {revealed && (
          <button className="btn btn-primary neon-border" onClick={reset} style={{ padding: '0.6rem 1.5rem' }}>
            Play Again ({GAME_COST} Tokens)
          </button>
        )}
      </div>
    </>
  );
}
