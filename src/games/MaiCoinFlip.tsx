import { useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import { useGameStore } from '../store/gameStore';
import { supabase } from '../lib/supabase';
import SEO from '../components/SEO';

interface CoinResult {
  winners: number[];
  won: boolean;
  payout: number;
}

export default function MaiCoinFlip() {
  const { user } = useAuthStore();
  const { wallet, refreshWallet, loadTokenTransactions } = useWalletStore();
  const { loadSessions } = useGameStore();
  const [flipping, setFlipping] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [winners, setWinners] = useState<number[]>([]);
  const [result, setResult] = useState<{ won: boolean; payout: number } | null>(null);

  const simulateResult = (): CoinResult => {
    const won = Math.random() < 0.35;
    const allIndices = Array.from({ length: 12 }, (_, i) => i);
    const shuffled = allIndices.sort(() => Math.random() - 0.5);
    const winIndices = shuffled.slice(0, 6);
    return { winners: winIndices, won, payout: won ? 0.05 : 0 };
  };

  const playGame = useCallback(async () => {
    if (!user || (wallet?.token_balance ?? 0) < 15 || flipping) return;
    setFlipping(true);
    setFlipped(false);
    setWinners([]);
    setResult(null);

    let gameResult: CoinResult;
    try {
      const { data, error } = await supabase.rpc('play_game', {
        p_game_type: 'coin_flip',
        p_user_id: user.id,
      });
      if (error) {
        console.error('[MaiCoinFlip] play_game rpc error', error);
        gameResult = simulateResult();
      } else if (!data || (Array.isArray(data) && data.length === 0)) {
        gameResult = simulateResult();
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        const won = row.result === 'win';
        const payout = won ? (row.reward_amount || 0) : 0;
        const allIndices = Array.from({ length: 12 }, (_, i) => i);
        const shuffled = allIndices.sort(() => Math.random() - 0.5);
        const winIndices = won ? shuffled.slice(0, 6) : [];
        gameResult = { winners: winIndices, won, payout };
      }
    } catch (err) {
      console.error('[MaiCoinFlip] play_game exception', err);
      gameResult = simulateResult();
    }

    if (user?.id) {
      try {
        await Promise.all([
          refreshWallet(user.id),
          loadTokenTransactions(user.id),
          loadSessions(user.id),
        ]);
      } catch (err) {
        console.warn('[MaiCoinFlip] refresh failed', err);
      }
    }

    setTimeout(() => {
      setFlipped(true);
      setWinners(gameResult.winners);
      setResult({ won: gameResult.won, payout: gameResult.payout });
      setFlipping(false);
    }, 800);
  }, [user, wallet?.token_balance, flipping, refreshWallet, loadTokenTransactions, loadSessions]);

  return (
    <>
      <SEO title="Mai Coin Flip" description="Flip coins and win prizes on MaiTalent.fun!" />
      <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h1 className="neon-text-pink" style={{ fontSize: '2rem', marginBottom: '0.5rem', textShadow: '0 0 10px #ff00ff, 0 0 20px #ff00ff' }}>
          Mai Coin Flip
        </h1>

        {user && (
          <p style={{ color: '#00ff88', marginBottom: '1rem' }}>
            Tokens: <strong>{wallet?.token_balance ?? 0}</strong>
          </p>
        )}

        {!user && (
          <div className="card neon-border" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ color: '#ff66cc' }}>Sign in to play!</p>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}
        >
          {Array.from({ length: 12 }, (_, i) => {
            const isWinner = winners.includes(i);
            return (
              <div
                key={i}
                className="neon-border"
                style={{
                  aspectRatio: '1',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  background: flipped
                    ? isWinner
                      ? 'linear-gradient(135deg, #00ff88, #00cc66)'
                      : 'linear-gradient(135deg, #333, #222)'
                    : 'linear-gradient(135deg, #1a1a2e, #16213e)',
                  color: flipped && isWinner ? '#000' : '#00aaff',
                  transform: flipping ? 'rotateY(720deg)' : flipped ? 'rotateY(180deg)' : 'rotateY(0)',
                  transition: 'transform 1s ease, background 0.5s ease',
                  boxShadow: flipped && isWinner ? '0 0 20px #00ff88' : '0 0 8px #00aaff',
                  cursor: 'default',
                }}
              >
                {flipped ? (isWinner ? '🏆' : 'TC') : 'TC'}
              </div>
            );
          })}
        </div>

        {result && (
          <div
            className="card neon-border"
            style={{
              padding: '1rem',
              marginBottom: '1rem',
              background: result.won ? 'rgba(0,255,136,0.1)' : 'rgba(255,0,80,0.1)',
            }}
          >
            <p
              className={result.won ? 'neon-text-green' : 'neon-text-pink'}
              style={{ fontSize: '1.3rem', fontWeight: 'bold' }}
            >
              {result.won ? `You Win $${result.payout.toFixed(2)}!` : 'Try Again!'}
            </p>
          </div>
        )}

        <button
          className="btn btn-primary neon-border"
          onClick={playGame}
          disabled={!user || (wallet?.token_balance ?? 0) < 15 || flipping}
          style={{
            padding: '0.75rem 2rem',
            fontSize: '1.1rem',
            opacity: !user || (wallet?.token_balance ?? 0) < 15 || flipping ? 0.5 : 1,
            cursor: !user || (wallet?.token_balance ?? 0) < 15 || flipping ? 'not-allowed' : 'pointer',
          }}
        >
          {flipping ? 'Flipping...' : 'Flip Coins! (15 Tokens)'}
        </button>
      </div>
    </>
  );
}
