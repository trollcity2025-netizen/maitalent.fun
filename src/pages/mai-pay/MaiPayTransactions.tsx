import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO';

interface Transaction {
  id: string;
  type: 'purchase' | 'cashout' | 'crown_redemption' | 'hype_conversion' | 'bonus' | 'refund';
  amount: number;
  status: string;
  reference?: string;
  created_at: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  purchase: { label: 'Purchase', color: 'var(--neon-blue)' },
  cashout: { label: 'Cashout', color: 'var(--neon-green)' },
  crown_redemption: { label: 'Crown Redemption', color: 'var(--neon-purple)' },
  hype_conversion: { label: 'Hype Conversion', color: 'var(--neon-pink)' },
  bonus: { label: 'Bonus', color: 'var(--neon-yellow)' },
  refund: { label: 'Refund', color: '#ff6666' },
};

const FILTER_TYPES = ['all', 'purchase', 'cashout', 'crown_redemption', 'hype_conversion', 'bonus', 'refund'];

export default function MaiPayTransactions() {
  const { user } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, [user?.id]);

  useEffect(() => {
    if (filter === 'all') {
      setFilteredTransactions(transactions);
    } else {
      setFilteredTransactions(transactions.filter((t) => t.type === filter));
    }
  }, [filter, transactions]);

  const loadTransactions = async () => {
    if (!user?.id) return;
    setLoading(true);

    // Load from coin_transactions
    const { data: coinTx } = await supabase
      .from('coin_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Load from crown_redemptions
    const { data: crownTx } = await supabase
      .from('crown_redemptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Load from cashout_requests
    const { data: payoutTx } = await supabase
      .from('cashout_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    const all: Transaction[] = [];

    if (coinTx) {
      all.push(...coinTx.map((t: any) => ({
        id: t.id,
        type: t.type === 'purchase' ? 'purchase' as const : t.type === 'refund' ? 'refund' as const : 'bonus' as const,
        amount: t.amount,
        status: t.status,
        reference: t.payment_id,
        created_at: t.created_at,
      })));
    }

    if (crownTx) {
      all.push(...crownTx.map((t: any) => ({
        id: t.id,
        type: 'crown_redemption' as const,
        amount: t.coins_received,
        status: 'completed',
        reference: `${t.crowns_used} crowns`,
        created_at: t.created_at,
      })));
    }

    if (payoutTx) {
      all.push(...payoutTx.map((t: any) => ({
        id: t.id,
        type: 'cashout' as const,
        amount: t.requested_amount,
        status: t.status,
        reference: t.paypal_payout_batch_id,
        created_at: t.requested_at,
      })));
    }

    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setTransactions(all);
    setLoading(false);
  };

  const handleExport = () => {
    const csv = [
      'Date,Type,Amount,Status,Reference',
      ...filteredTransactions.map(
        (t) => `${new Date(t.created_at).toISOString()},${t.type},${t.amount},${t.status},${t.reference || ''}`
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mai-pay-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid var(--neon-blue)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-slow 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      <SEO title="MAI Pay Transactions" />

      <h2 className="neon-text-blue" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: '24px', textAlign: 'center' }}>
        MAI Pay Transactions
      </h2>

      {/* Filters & Export */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {FILTER_TYPES.map((type) => (
            <button
              key={type}
              className={`btn ${filter === type ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilter(type)}
              style={{ fontSize: '0.7rem', padding: '6px 12px' }}
            >
              {type === 'all' ? 'All' : TYPE_LABELS[type]?.label || type}
            </button>
          ))}
        </div>
        <button className="btn btn-outline" onClick={handleExport} style={{ fontSize: '0.75rem', padding: '8px 14px' }}>
          📥 Export CSV
        </button>
      </div>

      {/* Transactions Table */}
      {filteredTransactions.length === 0 ? (
        <div className="card neon-border" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No transactions found.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '12px 10px', color: 'var(--text-secondary)' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '12px 10px', color: 'var(--text-secondary)' }}>Type</th>
                <th style={{ textAlign: 'right', padding: '12px 10px', color: 'var(--text-secondary)' }}>Amount</th>
                <th style={{ textAlign: 'center', padding: '12px 10px', color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '12px 10px', color: 'var(--text-secondary)' }}>Reference</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => {
                const typeInfo = TYPE_LABELS[tx.type] || { label: tx.type, color: 'var(--text-secondary)' };
                return (
                  <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 10px', color: typeInfo.color, fontWeight: 600 }}>
                      {typeInfo.label}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }} className="neon-text-green">
                      {tx.type === 'cashout' ? '-' : '+'}{tx.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'capitalize' }}>
                        {tx.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      {tx.reference || '—'}
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
