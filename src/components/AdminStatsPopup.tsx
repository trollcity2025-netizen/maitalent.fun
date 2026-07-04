import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { X, RefreshCw, Shield, Users, ShoppingCart, DollarSign, Coins, TrendingUp, Award } from 'lucide-react';

interface AdminStats {
  users_online: number;
  total_purchases: number;
  total_purchase_usd: number;
  total_coins_sold: number;
  total_tokens_held: number;
  total_winnings: number;
  updated_at: string;
}

export default function AdminStatsPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_admin_platform_stats');
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      if (data?.error) {
        setError(data.error);
        return;
      }
      setStats(data as AdminStats);
    } catch (err) {
      setError('Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchStats();
    }
  }, [isOpen, fetchStats]);

  useEffect(() => {
    if (!isOpen) return;

    const channel = supabase
      .channel('admin-stats-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pending_paypal_orders' },
        () => fetchStats()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pending_paypal_orders' },
        () => fetchStats()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'coin_transactions' },
        () => fetchStats()
      )
      .subscribe();

    const interval = setInterval(fetchStats, 45000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [isOpen, fetchStats]);

  if (!isOpen && !stats) return null;

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-magenta))',
            color: 'var(--bg-primary)',
            fontWeight: 700,
            fontSize: '0.8rem',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0, 229, 255, 0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 28px rgba(0, 229, 255, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 229, 255, 0.3)';
          }}
        >
          <Shield size={15} />
          Admin Stats
        </button>
      )}

      {isOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 199,
            }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              width: '380px',
              maxHeight: '80vh',
              overflow: 'auto',
              zIndex: 200,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
              animation: 'slideUp 0.2s ease-out',
            }}
          >
            <style>{`
              @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
              background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.1), rgba(217, 70, 239, 0.1))',
              borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Shield size={18} style={{ color: 'var(--accent-cyan)' }} />
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 800,
                  color: 'var(--text-primary)',
                }}>Admin Dashboard</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', padding: '4px', borderRadius: 'var(--radius-sm)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.2s, background 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Stats Grid */}
            <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <StatCard icon={<Users size={20} />} label="Users Online" value={stats?.users_online?.toLocaleString() ?? '—'} color="var(--accent-cyan)" loading={loading} />
              <StatCard icon={<ShoppingCart size={20} />} label="Total Purchases" value={stats?.total_purchases?.toLocaleString() ?? '—'} color="var(--accent-green)" loading={loading} />
              <StatCard icon={<DollarSign size={20} />} label="Total Purchase USD" value={stats?.total_purchase_usd ? `$${Number(stats.total_purchase_usd).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '—'} color="var(--accent-gold)" loading={loading} />
              <StatCard icon={<Coins size={20} />} label="Total Coins Sold" value={stats?.total_coins_sold?.toLocaleString() ?? '—'} color="var(--accent-magenta)" loading={loading} />
              <StatCard icon={<TrendingUp size={20} />} label="Total Tokens Held" value={stats?.total_tokens_held?.toLocaleString() ?? '—'} color="var(--accent-cyan)" loading={loading} />
              <StatCard icon={<Award size={20} />} label="Total Winnings" value={stats?.total_winnings ? `$${Number(stats.total_winnings).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '—'} color="var(--accent-gold)" loading={loading} />
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 20px', borderTop: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(10, 14, 39, 0.5)',
              borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
            }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Updated: {stats?.updated_at ? new Date(stats.updated_at).toLocaleTimeString() : '—'}
              </span>
              <button
                onClick={fetchStats}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)'; e.currentTarget.style.borderColor = 'var(--accent-cyan)'; e.currentTarget.style.color = 'var(--accent-cyan)'; }}}
                onMouseLeave={(e) => { if (!loading) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}}
              >
                <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                Refresh
              </button>
            </div>

            {error && (
              <div style={{
                margin: '16px 20px', padding: '10px 12px',
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-sm)', color: '#ef4444', fontSize: '0.75rem',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span>⚠</span> {error}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function StatCard({ icon, label, value, color, loading }: { icon: React.ReactNode; label: string; value: string; color: string; loading: boolean }) {
  return (
    <div style={{
      padding: '16px', borderRadius: 'var(--radius-md)',
      background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
          background: `${color}15`,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color, fontFamily: 'var(--font-display)', lineHeight: 1.2 }}>
        {loading ? (
          <span style={{ opacity: 0.5 }}>—</span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}