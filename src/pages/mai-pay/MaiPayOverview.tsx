import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useWalletStore } from '../../store/walletStore';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO';

export default function MaiPayOverview() {
  const { user } = useAuthStore();
  const { wallet, loadWallet, hypeCoins } = useWalletStore();
  const [totalCashedOut, setTotalCashedOut] = useState(0);
  const [pendingGiftCards, setPendingGiftCards] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadWallet(user.id);
      loadStats();
    }
  }, [user?.id]);

  const loadStats = async () => {
    if (!user?.id) return;
    setLoading(true);

    const { data: paidGiftCards } = await supabase
      .from('gift_card_redemptions')
      .select('amount_usd, status')
      .eq('user_id', user.id);

    if (paidGiftCards) {
      const total = paidGiftCards
        .filter((p) => p.status === 'sent' || p.status === 'completed')
        .reduce((sum, p) => sum + Number(p.amount_usd || 0), 0);
      setTotalCashedOut(total);
    }

    const { data: giftCards } = await supabase
      .from('gift_card_redemptions')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'pending');

    if (giftCards) {
      setPendingGiftCards(giftCards.length);
    }

    setLoading(false);
  };

  const coinBalance = wallet?.coin_balance ?? 0;

  const balanceCards = [
    { label: 'Troll Coins', value: coinBalance, color: 'neon-text-blue', icon: '🪙' },
    { label: 'Hype Coins', value: hypeCoins, color: 'neon-text-pink', icon: '⚡' },
    { label: 'Tokens', value: wallet?.token_balance ?? 0, color: 'neon-text-green', icon: '🪙' },
    { label: 'Cash Balance', value: `$${(wallet?.cash_balance ?? wallet?.total_won ?? 0).toFixed(2)}`, color: 'neon-text-yellow', icon: '💰' },
    { label: 'Crowns', value: user?.crowns ?? 0, color: 'neon-text-purple', icon: '👑' },
  ];

  const infoCards = [
    {
title: 'How MAI Pay Works',
        text: 'Use your cash balance to request Visa gift cards from $5 to $500.',
      },
    {
title: 'Crown Conversion',
        text: 'Crowns come from Mai Ladder Climb streaks and Daily Rewards. Convert 100 Crowns → 300 Troll Coins.',
      },
    {
title: 'Processing Time',
        text: 'Approved Visa Gift Card requests are processed within 30 Minutes to your gift card code.',
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid var(--neon-pink)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-slow 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      <SEO title="MAI Pay Overview" />

      <h2 className="neon-text-blue" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: '24px', textAlign: 'center' }}>
        MAI Pay Overview
      </h2>

      {/* Balance Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {balanceCards.map((card) => (
          <div key={card.label} className="card neon-border" style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>{card.icon}</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}>{card.label}</p>
            <p className={card.color} style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.3rem' }}>
              {card.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="card neon-border-pink" style={{ textAlign: 'center', padding: '20px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}>Total Cashed Out</p>
          <p className="neon-text-green" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.5rem' }}>
            ${totalCashedOut.toFixed(2)}
          </p>
        </div>
        <div className="card neon-border-pink" style={{ textAlign: 'center', padding: '20px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}>Pending Gift Cards</p>
          <p className="neon-text-pink" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.5rem' }}>
            {pendingGiftCards}
          </p>
        </div>
      </div>

      {/* Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {infoCards.map((info) => (
          <div key={info.title} className="card neon-border" style={{ padding: '20px' }}>
            <h3 className="neon-text-blue" style={{ fontSize: '1rem', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
              {info.title}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
              {info.text}
            </p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center' }}>
<Link to="/mai-pay" className="btn btn-green" onClick={() => {}}></Link>
       </div>
    </div>
  );
}
