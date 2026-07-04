import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO';
import type { GiftCardRedemption } from '../../types';

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  pending: { bg: 'rgba(255,200,0,0.1)', border: '#cc9900', color: '#ffcc00', label: 'Submitted' },
  approved: { bg: 'rgba(57,255,20,0.1)', border: '#39ff14', color: '#39ff14', label: 'Approved' },
  sent: { bg: 'rgba(0,240,255,0.1)', border: '#00f0ff', color: '#00f0ff', label: 'Code Ready' },
  completed: { bg: 'rgba(57,255,20,0.1)', border: '#39ff14', color: '#39ff14', label: 'Completed' },
  denied: { bg: 'rgba(255,0,0,0.1)', border: '#ff4444', color: '#ff6666', label: 'Denied' },
};

export default function MaiPayRequests() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<GiftCardRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, [user?.id]);

  const loadRequests = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('gift_card_redemptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setRequests(data || []);
    setLoading(false);
  };

  const copyCode = async (id: string, code?: string) => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div style={{ width: 36, height: 36, border: '3px solid var(--neon-yellow)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-slow 1s linear infinite' }} /></div>;
  }

  return (
    <div>
      <SEO title="My MAI Pay Requests" />
      <h2 className="neon-text-blue" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: 24, textAlign: 'center' }}>My MAI Pay Requests</h2>

      {requests.length === 0 ? (
        <div className="card neon-border" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>📭</div>
          <p style={{ color: 'var(--text-secondary)' }}>No cashout requests yet.</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 8 }}>Submit from MAI Pay → Cashout.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '12px 10px', color: 'var(--text-secondary)' }}>Date</th>
                <th style={{ textAlign: 'right', padding: '12px 10px', color: 'var(--text-secondary)' }}>Amount</th>
                <th style={{ textAlign: 'center', padding: '12px 10px', color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '12px 10px', color: 'var(--text-secondary)' }}>Gift Card Code</th>
                <th style={{ textAlign: 'left', padding: '12px 10px', color: 'var(--text-secondary)' }}>Sent</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                const style = STATUS_STYLES[req.status] || STATUS_STYLES.pending;
                return (
                  <tr key={req.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>{new Date(req.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }} className="neon-text-green">${Number(req.amount_usd).toFixed(2)}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}><span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 12, background: style.bg, border: `1px solid ${style.border}`, color: style.color, fontSize: '0.75rem', fontWeight: 700 }}>{style.label}</span></td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>
                      {req.gift_card_code ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <code style={{ color: 'var(--neon-green)' }}>{req.gift_card_code}</code>
                          <button className="btn btn-outline" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => copyCode(req.id, req.gift_card_code)}>{copied === req.id ? 'Copied' : 'Copy Code'}</button>
                        </div>
                      ) : 'Waiting for admin'}
                    </td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>{req.sent_at ? new Date(req.sent_at).toLocaleDateString() : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
