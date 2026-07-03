import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO';

interface PayoutRequest {
  id: string;
  requested_amount: number;
  coin_amount: number;
  paypal_email: string;
  status: 'pending' | 'approved' | 'paid' | 'denied' | 'refunded';
  requested_at: string;
  approved_at?: string;
  paid_at?: string;
  denied_reason?: string;
}

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  pending: { bg: 'rgba(255,200,0,0.1)', border: '#cc9900', color: '#ffcc00', label: 'Pending' },
  approved: { bg: 'rgba(57,255,20,0.1)', border: '#39ff14', color: '#39ff14', label: 'Approved' },
  paid: { bg: 'rgba(0,240,255,0.1)', border: '#00f0ff', color: '#00f0ff', label: 'Paid' },
  denied: { bg: 'rgba(255,0,0,0.1)', border: '#ff4444', color: '#ff6666', label: 'Denied' },
  refunded: { bg: 'rgba(150,150,150,0.1)', border: '#888', color: '#aaa', label: 'Refunded' },
};

export default function MaiPayRequests() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, [user?.id]);

  const loadRequests = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('cashout_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('requested_at', { ascending: false });
    setRequests(data || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid var(--neon-yellow)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-slow 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      <SEO title="My Cashout Requests" />

      <h2 className="neon-text-blue" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: '24px', textAlign: 'center' }}>
        My Cashout Requests
      </h2>

      {requests.length === 0 ? (
        <div className="card neon-border" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📭</div>
          <p style={{ color: 'var(--text-secondary)' }}>No cashout requests yet.</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '8px' }}>
            Submit a request from the Cash Out tab to get started.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '12px 10px', color: 'var(--text-secondary)' }}>Date</th>
                <th style={{ textAlign: 'right', padding: '12px 10px', color: 'var(--text-secondary)' }}>Amount</th>
                <th style={{ textAlign: 'right', padding: '12px 10px', color: 'var(--text-secondary)' }}>Coins</th>
                <th style={{ textAlign: 'left', padding: '12px 10px', color: 'var(--text-secondary)' }}>PayPal</th>
                <th style={{ textAlign: 'center', padding: '12px 10px', color: 'var(--text-secondary)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                const style = STATUS_STYLES[req.status] || STATUS_STYLES.pending;
                return (
                  <tr key={req.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>
                      {new Date(req.requested_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }} className="neon-text-green">
                      ${req.requested_amount.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {req.coin_amount.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>
                      {req.paypal_email}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          background: style.bg,
                          border: `1px solid ${style.border}`,
                          color: style.color,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {style.label}
                      </span>
                      {req.status === 'denied' && req.denied_reason && (
                        <p style={{ color: '#ff6666', fontSize: '0.7rem', marginTop: '6px' }}>
                          {req.denied_reason}
                        </p>
                      )}
                    </td>
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
