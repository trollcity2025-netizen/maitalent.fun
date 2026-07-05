import { useState, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import { useGameStore } from '../store/gameStore';
import { supabase } from '../lib/supabase';
import SEO from '../components/SEO';

const SEGMENTS = [
  { label: '$0.01', color: '#00aaff', type: 'cash' },
  { label: 'No Win', color: '#ff0080', type: 'none' },
  { label: '$0.05', color: '#00ff88', type: 'cash' },
  { label: 'Free Turn', color: '#00aaff', type: 'token' },
  { label: '$0.10', color: '#ff0080', type: 'cash' },
  { label: 'Bankrupt', color: '#00ff88', type: 'bankrupt' },
  { label: '$0.01', color: '#00aaff', type: 'cash' },
  { label: 'No Win', color: '#ff0080', type: 'none' },
  { label: '$0.05', color: '#00ff88', type: 'cash' },
  { label: 'No Turn', color: '#00aaff', type: 'no_turn' },
  { label: '$0.10', color: '#ff0080', type: 'cash' },
  { label: 'No Win', color: '#00ff88', type: 'none' },
];

const SEGMENT_ANGLE = 360 / SEGMENTS.length;
const GAME_COST = 15;

interface SpinResult {
  segment_index: number;
  won: boolean;
  payout: number;
  reward_type: string;
}

function simulateSpin(): SpinResult {
  const idx = Math.floor(Math.random() * SEGMENTS.length);
  const seg = SEGMENTS[idx];
  const payout = seg.type === 'cash' ? parseFloat(seg.label.slice(1)) : 0;
  return { segment_index: idx, won: payout > 0, payout, reward_type: seg.type };
}

export default function MaiLuckySpin() {
  const { user } = useAuthStore();
  const { wallet, refreshWallet, loadTokenTransactions } = useWalletStore();
  const { loadSessions } = useGameStore();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  const spin = useCallback(async () => {
    if (!user || (wallet?.token_balance ?? 0) < GAME_COST || spinning) return;
    setSpinning(true);
    setResult(null);
    setMessage(null);

    let spinResult: SpinResult;
    let backendSuccess = true;
    try {
      const { data, error } = await supabase.rpc('play_game', {
        p_game_type: 'lucky_spin',
        p_user_id: user.id,
      });
      if (error) {
        console.error('[MaiLuckySpin] play_game rpc error', error);
        backendSuccess = false;
        spinResult = simulateSpin();
      } else if (!data || (Array.isArray(data) && data.length === 0)) {
        backendSuccess = false;
        spinResult = simulateSpin();
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        const won = row.result === 'win';
        const payout = won ? (row.reward_amount || 0) : 0;
        // map reward_type to a segment index if possible, else random
        const segIndex = SEGMENTS.findIndex((s) => s.type === (row.reward_type || '') );
        const index = segIndex >= 0 ? segIndex : Math.floor(Math.random() * SEGMENTS.length);
        spinResult = {
          segment_index: index,
          won,
          payout,
          reward_type: row.reward_type || SEGMENTS[index].type,
        };
      }
    } catch (err) {
      console.error('[MaiLuckySpin] play_game exception', err);
      backendSuccess = false;
      spinResult = simulateSpin();
    }

    const targetSegment = spinResult.segment_index;
    const segmentCenter = targetSegment * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const fullSpins = 5 * 360;
    const targetAngle = fullSpins + (360 - segmentCenter);
    const newRotation = rotation + targetAngle;

    setRotation(newRotation);

    setTimeout(async () => {
      setResult(spinResult);
      setSpinning(false);

      let nextMessage: string | null = null;
      if (user?.id) {
        try {
          // if backend didn't award, perform fallback updates server-side
          if (!backendSuccess && spinResult.reward_type === 'cash' && spinResult.payout > 0) {
            try {
              const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('cash_balance,total_won')
                .eq('id', user.id)
                .single();

              if (profileError) {
                console.warn('[MaiLuckySpin] reward profile lookup failed:', profileError);
              } else {
                const { error: updateError } = await supabase
                  .from('user_profiles')
                  .update({
                    cash_balance: Number((Number(profile?.cash_balance ?? 0) + spinResult.payout).toFixed(2)),
                    total_won: Number((Number(profile?.total_won ?? 0) + spinResult.payout).toFixed(2)),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', user.id);

                if (updateError) {
                  console.warn('[MaiLuckySpin] reward update failed:', updateError);
                } else {
                  const coinAmount = Math.round(spinResult.payout * 100);
                  const { error: transactionError } = await supabase.from('coin_transactions').insert({
                    user_id: user.id,
                    type: 'reward',
                    amount: coinAmount,
                    price_usd: spinResult.payout,
                    status: 'completed',
                  });
                  if (transactionError) console.warn('[MaiLuckySpin] reward transaction failed:', transactionError);
                }
              }
            } catch (err) {
              console.error('[MaiLuckySpin] reward processing exception:', err);
            }
          }

          if (spinResult.reward_type === 'token') {
            // backend should have awarded; fallback in case
            await supabase.from('user_profiles').update({ tokens: (wallet?.token_balance ?? 0) + 1 }).eq('id', user.id);
            await supabase.from('token_transactions').insert({ user_id: user.id, type: 'reward', amount: 1, source: 'free' });
            nextMessage = '+1 Free Token!';
          } else if (spinResult.reward_type === 'gift_card' || spinResult.reward_type === 'no_turn') {
            if (Math.random() < 0.30) {
              const minutes = [1, 3, 5][Math.floor(Math.random() * 3)];
              const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
              await supabase.from('user_profiles').update({ no_turn_until: until }).eq('id', user.id);
              nextMessage = `No Turn protection for ${minutes} minute${minutes > 1 ? 's' : ''}!`;
            } else {
              nextMessage = 'No Turn bonus missed. Keep playing!';
            }
          } else if (spinResult.reward_type === 'bankrupt') {
            const bankruptable = (wallet?.token_balance ?? 0);
            if (bankruptable > 0) {
              await supabase.from('user_profiles').update({ tokens: 0 }).eq('id', user.id);
              await supabase.from('token_transactions').insert({ user_id: user.id, type: 'play', amount: -bankruptable, source: 'free' });
              nextMessage = 'BANKRUPT! All free tokens lost.';
            }
          }
        } catch (err) {
          console.warn('[MaiLuckySpin] fallback updates failed', err);
        }

        try {
          await Promise.all([
            refreshWallet(user.id),
            loadTokenTransactions(user.id),
            loadSessions(user.id),
          ]);
        } catch (err) {
          console.warn('[MaiLuckySpin] refresh failed', err);
        }

        if (nextMessage) {
          setMessage(nextMessage);
          setTimeout(() => setMessage(null), 3000);
        }
      }
    }, 4000);
  }, [user, wallet?.token_balance, spinning, rotation, refreshWallet, loadTokenTransactions, message]);

  return (
    <>
      <SEO title="Mai Lucky Spin" description="Spin the wheel and win big prizes!" />
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
        <h1 className="neon-text-pink" style={{ fontSize: '2rem', textShadow: '0 0 10px #ff00ff, 0 0 20px #ff00ff' }}>
          Mai Lucky Spin
        </h1>

        {user && <p style={{ color: '#00ff88', marginBottom: '1rem' }}>Tokens: <strong>{wallet?.token_balance ?? 0}</strong></p>}
        {!user && (
          <div className="card neon-border" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ color: '#ff66cc' }}>Sign in to play!</p>
          </div>
        )}

        {message && (
          <div className="card neon-border" style={{ padding: '0.75rem', marginBottom: '1rem', background: 'rgba(0,229,255,0.1)' }}>
            <p className="neon-text-cyan" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{message}</p>
          </div>
        )}

        {/* Pointer */}
        <div style={{ position: 'relative', width: '280px', height: '280px', margin: '0 auto 1rem' }}>
          <div
            style={{
              position: 'absolute',
              top: '-12px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '14px solid transparent',
              borderRight: '14px solid transparent',
              borderTop: '24px solid #ff0080',
              zIndex: 10,
              filter: 'drop-shadow(0 0 6px #ff0080)',
            }}
          />
          <div
            ref={wheelRef}
            style={{
              width: '280px',
              height: '280px',
              borderRadius: '50%',
              position: 'relative',
              overflow: 'hidden',
              border: '4px solid #00aaff',
              boxShadow: '0 0 20px #00aaff, inset 0 0 20px rgba(0,170,255,0.3)',
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
            }}
          >
            {SEGMENTS.map((seg, i) => {
              const angle = i * SEGMENT_ANGLE;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    width: '50%',
                    height: '50%',
                    top: '50%',
                    left: '50%',
                    transformOrigin: '0% 0%',
                    transform: `rotate(${angle}deg)`,
                    clipPath: 'polygon(0 0, 100% 0, 86.6% 50%)',
                    background: seg.color,
                    opacity: 0.85,
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: '30%',
                      left: '55%',
                      transform: `rotate(${SEGMENT_ANGLE / 2}deg)`,
                      fontSize: '0.65rem',
                      fontWeight: 'bold',
                      color: '#fff',
                      textShadow: '0 0 4px #000',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {seg.label}
                  </span>
                </div>
              );
            })}
            {/* Center hub */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, #222, #000)',
                border: '3px solid #ff0080',
                boxShadow: '0 0 10px #ff0080',
                zIndex: 5,
              }}
            />
          </div>
        </div>

        {result && (
          <div className="card neon-border" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <p className={result.won ? 'neon-text-green' : result.reward_type === 'bankrupt' ? 'neon-text-pink' : 'neon-text-blue'} style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>
              {result.reward_type === 'token' ? '+1 Free Token!' : (result.reward_type === 'gift_card' || result.reward_type === 'no_turn') ? 'No Turn Chance!' : result.reward_type === 'bankrupt' ? 'BANKRUPT!' : result.won ? `You Win $${result.payout.toFixed(2)}!` : 'Try Again!'}
            </p>
          </div>
        )}

        <button
          className="btn btn-primary neon-border"
          onClick={spin}
          disabled={!user || (wallet?.token_balance ?? 0) < 1 || spinning}
          style={{
            padding: '0.75rem 2rem',
            fontSize: '1.1rem',
            opacity: !user || (wallet?.token_balance ?? 0) < 1 || spinning ? 0.5 : 1,
            cursor: !user || (wallet?.token_balance ?? 0) < 1 || spinning ? 'not-allowed' : 'pointer',
          }}
        >
          {spinning ? 'Spinning...' : `Spin the Wheel! (${GAME_COST} Tokens)`}
        </button>
      </div>
    </>
  );
}
