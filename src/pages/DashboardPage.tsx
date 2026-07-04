import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import { useGameStore } from '../store/gameStore';
import { Coins, Zap, Gamepad2, Clock, Wallet, Flame } from 'lucide-react';
import SEO from '../components/SEO';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuthStore();
  const { wallet, loadWallet, loading: walletLoading, tokenTransactions, loadTokenTransactions, hypeCoins } = useWalletStore();
  const { sessions, loadSessions, loading: sessionsLoading } = useGameStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }
    if (user?.id) {
      loadWallet(user.id);
      loadSessions(user.id);
      loadTokenTransactions(user.id);
    }
  }, [user?.id, authLoading]);

  if (authLoading || walletLoading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 140px)' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          border: '3px solid rgba(0, 229, 255, 0.2)',
          borderTopColor: 'var(--accent-cyan)',
          animation: 'spin-slow 0.8s linear infinite',
        }} />
      </div>
    );
  }

  if (!user) return null;

  const cashBalance = (wallet?.cash_balance ?? wallet?.total_won ?? 0);

  const stats = [
    { label: 'Troll Coins', value: wallet?.coin_balance ?? 0, icon: Coins, color: 'var(--accent-cyan)' },
    { label: 'Tokens', value: wallet?.token_balance ?? 0, icon: Zap, color: 'var(--accent-green)' },
    { label: 'Cash Balance', value: `$${cashBalance.toFixed(2)}`, icon: Wallet, color: 'var(--accent-gold)' },
    { label: 'Games Played', value: sessions.length, icon: Gamepad2, color: 'var(--accent-purple)' },
    { label: 'Hype Coins', value: hypeCoins ?? 0, icon: Flame, color: 'var(--accent-magenta)' },
  ];

  const recentSessions = sessions.slice(0, 5);

  const gameLabels: Record<string, string> = {
    coin_flip: 'Coin Flip',
    treasure_hunt: 'Treasure Hunt',
    lucky_spin: 'Lucky Spin',
    card_pick: 'Card Pick',
    ladder_climb: 'Ladder Climb',
  };

  return (
    <div className="page">
      <SEO title="Dashboard" description="Your MaiTalent dashboard overview." />

      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{
            fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 900, marginBottom: '6px',
            fontFamily: 'var(--font-display)',
          }}>
            Welcome back, <span className="text-gradient">{user.username}</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Here's your arcade overview.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid-stats" style={{ marginBottom: '32px' }}>
          {stats.map((stat) => (
            <div key={stat.label} className="card stat-card">
              <div style={{
                width: '38px', height: '38px', borderRadius: 'var(--radius-sm)',
                background: `${stat.color}15`, border: `1px solid ${stat.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <stat.icon size={18} color={stat.color} />
              </div>
              <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div style={{
          display: 'flex', gap: '10px', marginBottom: '40px', flexWrap: 'wrap',
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)', padding: '16px',
        }}>
          <Link to="/games" className="btn btn-primary">Play Games</Link>
          <Link to="/coin-store" className="btn btn-magenta">Buy Coins</Link>
          <Link to="/mai-pay" className="btn btn-green">MAI Pay</Link>
          <Link to="/transactions" className="btn btn-purple">Transaction History</Link>
        </div>

        {/* Recent Activity */}
        <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h2 style={{
              fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-display)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <Clock size={16} style={{ color: 'var(--text-muted)' }} />
              Recent Activity
            </h2>
          </div>

          {sessionsLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading sessions...
            </div>
          ) : recentSessions.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Gamepad2 size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px', opacity: 0.4 }} />
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.95rem' }}>No games played yet.</p>
              <Link to="/games" className="btn btn-primary">Play Your First Game</Link>
            </div>
          ) : (
            <div>
              {recentSessions.map((session, idx) => (
                <div key={session.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px',
                  borderBottom: idx < recentSessions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  transition: 'background 0.2s',
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>
                      {gameLabels[session.game_type] || session.game_type}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {new Date(session.created_at).toLocaleDateString()} · {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: session.result === 'win' ? 'var(--accent-green)' : 'var(--accent-magenta)',
                    }}>
                      {session.result}
                    </span>
                    {session.result === 'win' && session.reward_amount > 0 && (
                      <p style={{ color: 'var(--accent-gold)', fontSize: '0.75rem', marginTop: '2px', fontWeight: 600 }}>
                        +${session.reward_amount.toFixed(2)} cash
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Token Audit */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h2 style={{
              fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-display)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <Zap size={16} style={{ color: 'var(--text-muted)' }} />
              Token Audit
            </h2>
            <Link to="/transactions" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>
              View All
            </Link>
          </div>

          {tokenTransactions.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Zap size={28} style={{ marginBottom: '8px', opacity: 0.4 }} />
              <p style={{ fontSize: '0.9rem' }}>No token transactions yet. Start playing!</p>
            </div>
          ) : (
            <div>
              {tokenTransactions.slice(0, 5).map((tx, idx) => (
                <div key={tx.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 20px',
                  borderBottom: idx < Math.min(tokenTransactions.length, 5) - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'capitalize' }}>
                      {tx.type.replace('_', ' ')}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                      {new Date(tx.created_at).toLocaleDateString()} · {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span style={{
                    fontWeight: 700,
                    color: tx.amount > 0 ? 'var(--accent-green)' : 'var(--accent-magenta)',
                    fontSize: '0.85rem',
                  }}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
