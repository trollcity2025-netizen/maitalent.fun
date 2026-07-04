import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import { useGameStore } from '../store/gameStore';
import { supabase } from '../lib/supabase';
import SEO from '../components/SEO';
import type { CashoutRequest } from '../types';

type TabKey = 'coins' | 'tokens' | 'sessions' | 'cashouts';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'coins', label: 'Coins' },
  { key: 'tokens', label: 'Tokens' },
  { key: 'sessions', label: 'Game Sessions' },
  { key: 'cashouts', label: 'Cashouts' },
];

export default function TransactionHistoryPage() {
  const { user } = useAuthStore();
  const { coinTransactions, tokenTransactions, loadCoinTransactions, loadTokenTransactions } = useWalletStore();
  const { sessions, loadSessions } = useGameStore();
  const [activeTab, setActiveTab] = useState<TabKey>('coins');
  const [cashouts, setCashouts] = useState<CashoutRequest[]>([]);
  const [loadingCashouts, setLoadingCashouts] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadCoinTransactions(user.id);
    loadTokenTransactions(user.id);
    loadSessions(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === 'cashouts' && user?.id) {
      setLoadingCashouts(true);
      supabase
        .from('cashout_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('requested_at', { ascending: false })
        .limit(50)
        .then(({ data }) => {
          setCashouts(data || []);
          setLoadingCashouts(false);
        });
    }
  }, [activeTab, user?.id]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'text-[var(--neon-green)]',
      approved: 'text-[var(--neon-green)]',
      paid: 'text-[var(--neon-green)]',
      pending: 'text-[var(--neon-yellow)]',
      failed: 'text-[var(--neon-pink)]',
      denied: 'text-[var(--neon-pink)]',
      refunded: 'text-[var(--neon-orange)]',
      win: 'text-[var(--neon-green)]',
      loss: 'text-[var(--neon-pink)]',
    };
    return (
      <span className={`font-semibold uppercase ${colors[status] || 'text-[var(--text-secondary)]'}`}>
        {status}
      </span>
    );
  };

  const renderCoinsTab = () => {
    if (coinTransactions.length === 0) return <EmptyState message="No coin transactions yet." />;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-glow)] text-[var(--text-secondary)]">
              <th className="pb-3 pr-4">Type</th>
              <th className="pb-3 pr-4">Amount</th>
              <th className="pb-3 pr-4">Price</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {coinTransactions.map((tx) => (
              <tr key={tx.id} className="border-b border-[var(--border-glow)]/30">
                <td className="py-3 pr-4 capitalize">{tx.type.replace('_', ' ')}</td>
                <td className="py-3 pr-4 font-bold text-[var(--neon-blue)]">{tx.amount.toLocaleString()}</td>
                <td className="py-3 pr-4">${(tx.price_usd ?? 0).toFixed(2)}</td>
                <td className="py-3 pr-4">{statusBadge(tx.status)}</td>
                <td className="py-3 text-[var(--text-secondary)]">{formatDate(tx.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTokensTab = () => {
    if (tokenTransactions.length === 0) return <EmptyState message="No token transactions yet." />;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-glow)] text-[var(--text-secondary)]">
              <th className="pb-3 pr-4">Type</th>
              <th className="pb-3 pr-4">Amount</th>
              <th className="pb-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {tokenTransactions.map((tx) => (
              <tr key={tx.id} className="border-b border-[var(--border-glow)]/30">
                <td className="py-3 pr-4 capitalize">{tx.type.replace('_', ' ')}</td>
                <td className="py-3 pr-4 font-bold text-[var(--neon-pink)]">{tx.amount.toLocaleString()}</td>
                <td className="py-3 text-[var(--text-secondary)]">{formatDate(tx.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSessionsTab = () => {
    if (sessions.length === 0) return <EmptyState message="No game sessions yet." />;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-glow)] text-[var(--text-secondary)]">
              <th className="pb-3 pr-4">Game</th>
              <th className="pb-3 pr-4">Cost</th>
              <th className="pb-3 pr-4">Result</th>
              <th className="pb-3 pr-4">Reward</th>
              <th className="pb-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-[var(--border-glow)]/30">
                <td className="py-3 pr-4 capitalize">{s.game_type.replace('_', ' ')}</td>
                <td className="py-3 pr-4">{s.token_cost} token{s.token_cost !== 1 ? 's' : ''}</td>
                <td className="py-3 pr-4">{statusBadge(s.result)}</td>
                <td className="py-3 pr-4">
                  {s.reward_type === 'none' ? '—' : `${s.reward_amount} ${s.reward_type.replace('_', ' ')}`}
                </td>
                <td className="py-3 text-[var(--text-secondary)]">{formatDate(s.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderCashoutsTab = () => {
    if (loadingCashouts) return <LoadingSpinner />;
    if (cashouts.length === 0) return <EmptyState message="No cashout requests yet." />;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-glow)] text-[var(--text-secondary)]">
              <th className="pb-3 pr-4">Amount</th>
              <th className="pb-3 pr-4">Coins</th>
              <th className="pb-3 pr-4">PayPal</th>
              <th className="pb-3 pr-4">Visa Gift Code</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3">Requested</th>
            </tr>
          </thead>
          <tbody>
            {cashouts.map((c) => (
              <tr key={c.id} className="border-b border-[var(--border-glow)]/30">
                <td className="py-3 pr-4 font-bold text-[var(--neon-green)]">${c.requested_amount.toFixed(2)}</td>
                <td className="py-3 pr-4">{c.coin_amount.toLocaleString()}</td>
                <td className="py-3 pr-4 text-[var(--text-secondary)]">{c.paypal_email}</td>
                <td className="py-3 pr-4">
                  {c.visa_gift_code ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="font-mono text-xs bg-[var(--bg-input)] px-2 py-1 rounded">{c.visa_gift_code}</span>
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                        onClick={() => navigator.clipboard.writeText(c.visa_gift_code!)}
                      >
                        Copy
                      </button>
                    </div>
                  ) : '—'}
                </td>
                <td className="py-3 pr-4">{statusBadge(c.status)}</td>
                <td className="py-3 text-[var(--text-secondary)]">{formatDate(c.requested_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const tabContent: Record<TabKey, () => React.ReactNode> = {
    coins: renderCoinsTab,
    tokens: renderTokensTab,
    sessions: renderSessionsTab,
    cashouts: renderCashoutsTab,
  };

  return (
    <div className="page container">
      <SEO title="Transaction History" />

      <h1 className="section-title neon-text-pink" style={{ fontFamily: 'var(--font-display)' }}>
        Transaction History
      </h1>

      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`btn ${activeTab === tab.key ? 'btn-primary' : 'btn-outline'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card neon-border">{tabContent[activeTab]()}</div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--neon-blue)] border-t-transparent" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-[var(--text-secondary)]">
      <span className="mb-3 text-4xl">📭</span>
      <p>{message}</p>
    </div>
  );
}
