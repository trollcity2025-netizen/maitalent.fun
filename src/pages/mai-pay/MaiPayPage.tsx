import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import SEO from '../../components/SEO';
import MaiPayApplication from './MaiPayApplication';
import MaiPayOverview from './MaiPayOverview';
import MaiPayCrowns from './MaiPayCrowns';
import MaiPayCashout from './MaiPayCashout';
import MaiPayRequests from './MaiPayRequests';
import MaiPayTransactions from './MaiPayTransactions';
import MaiPayGifted from './MaiPayGifted';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'application', label: 'Application' },
  { id: 'crowns', label: 'Crowns' },
  { id: 'gifted', label: 'Gifted' },
  { id: 'cashout', label: 'Cash Out' },
  { id: 'requests', label: 'Requests' },
  { id: 'transactions', label: 'Transactions' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function MaiPayPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const balances = [
    { label: 'Troll Coins', value: user?.troll_coins ?? 0, color: 'neon-text-blue' },
    { label: 'Hype Coins', value: user?.hype_coins ?? 0, color: 'neon-text-pink' },
    { label: 'Cashout Coins', value: user?.cashout_coins ?? 0, color: 'neon-text-green' },
    { label: 'Reserved Coins', value: user?.cashout_reserved_coins ?? 0, color: 'neon-text-yellow' },
    { label: 'Battle Crowns', value: user?.battle_crowns ?? 0, color: 'neon-text-purple' },
  ];

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <MaiPayOverview />;
      case 'application': return <MaiPayApplication />;
      case 'crowns': return <MaiPayCrowns />;
      case 'gifted': return <MaiPayGifted />;
      case 'cashout': return <MaiPayCashout />;
      case 'requests': return <MaiPayRequests />;
      case 'transactions': return <MaiPayTransactions />;
      default: return <MaiPayOverview />;
    }
  };

  return (
    <div className="grid-bg page">
      <SEO
        title="MAI Pay - Cash Out via PayPal"
        description="Cash out your Troll Coins via PayPal with MAI Pay. Convert crowns, submit payout requests, and track transactions."
        keywords="MAI Pay, cash out, PayPal, Troll Coins, payout"
      />

      <div className="container">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1
            className="neon-text-blue"
            style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: '8px' }}
          >
            MAI Pay
          </h1>
          <p
            className="neon-text-pink"
            style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.85rem' }}
          >
            Cash out your Troll Coins via PayPal
          </p>
        </div>

        {/* Balance Bar */}
        <div
          className="card neon-border"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            justifyContent: 'center',
            marginBottom: '32px',
            padding: '20px',
          }}
        >
          {balances.map((b) => (
            <div key={b.label} style={{ textAlign: 'center', minWidth: '100px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}>
                {b.label}
              </p>
              <p className={b.color} style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.2rem' }}>
                {b.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            justifyContent: 'center',
            marginBottom: '32px',
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ fontSize: '0.75rem', padding: '8px 16px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {renderTab()}
      </div>
    </div>
  );
}
