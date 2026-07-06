import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useWalletStore } from '../../store/walletStore';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO';

const CASHOUT_OPTIONS = [5, 10, 15, 20, 25, 50, 100, 250, 500];
const PROCESSING_FEE_PERCENT = 0.029; // 2.9%

// Gift card type options mapping codes to display names
const GIFT_CARD_TYPES = {
  visa: { label: 'Visa Gift Card', min: 5, max: 500 },
  amzn: { label: 'Amazon Gift Card', min: 25, max: 200 },
  'gc-com': { label: 'Google Com Card', min: 5, max: 100 },
};

export default function MaiPayCashout() {
  const { user, loadUser } = useAuthStore();
  const { wallet, loadWallet } = useWalletStore();
  const [amount, setAmount] = useState<number>(5);
  const [giftCardType, setGiftCardType] = useState<'visa' | 'amzn' | 'gc-com'>('visa');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user?.id) loadWallet(user.id);
  }, [user?.id]);

  const cashBalance = wallet?.cash_balance ?? 0;
  const processingFee = Number((amount * PROCESSING_FEE_PERCENT).toFixed(2));
  const totalDeduction = Number((amount + processingFee).toFixed(2));
  const isApproved = user?.cashout_approved ?? false;

  const submitCashout = async () => {
    if (!user?.id) return;
    setMessage(null);

    if (user.frozen) {
      setMessage({ type: 'error', text: 'Account is frozen. Contact support before requesting a cashout.' });
      return;
    }
    if (!isApproved) {
      setMessage({ type: 'error', text: 'You must be approved for MAI Pay before requesting a cashout.' });
      return;
    }
    if (user.id_verification_status !== 'approved') {
      setMessage({ type: 'error', text: 'You must verify your identity before requesting a cashout.' });
      return;
    }
    // Check amount limits based on selected gift card type
    const { min, max } = GIFT_CARD_TYPES[giftCardType];
    if (amount < min || amount > max) {
      setMessage({ type: 'error', text: `Cashout requests for ${GIFT_CARD_TYPES[giftCardType].label} must be between $${min} and $${max}.` });
      return;
    }
    if (cashBalance < totalDeduction) {
      setMessage({ type: 'error', text: `Insufficient cash balance. Required (including 2.9% fee): $${totalDeduction.toFixed(2)}, Available: $${cashBalance.toFixed(2)}` });
      return;
    }

    setLoading(true);
    try {
      const newCashBalance = Number((cashBalance - totalDeduction).toFixed(2));
      const newTotalWon = Math.max(0, Number(((wallet?.total_won ?? 0) - totalDeduction).toFixed(2)));
      
      const { error: balanceError } = await supabase
        .from('user_profiles')
        .update({ 
          cash_balance: newCashBalance,
          total_won: newTotalWon,
          updated_at: new Date().toISOString() 
        })
        .eq('id', user.id);

      if (balanceError) throw balanceError;

      const { error: requestError } = await supabase.from('gift_card_redemptions').insert({
        user_id: user.id,
        amount_usd: amount,
        gift_card_code: giftCardType,
        gift_card_progress_used: 0,
        email: user.email,
        status: 'pending',
      });

      if (requestError) {
        // Refund on failure
        const refundCashBalance = Number((newCashBalance + totalDeduction).toFixed(2));
        const refundTotalWon = Number(((wallet?.total_won ?? 0)).toFixed(2));
        await supabase
          .from('user_profiles')
          .update({ 
            cash_balance: refundCashBalance,
            total_won: refundTotalWon,
            updated_at: new Date().toISOString() 
          })
          .eq('id', user.id);
        throw requestError;
      }

      await Promise.all([loadWallet(user.id), loadUser()]);
      setMessage({ type: 'success', text: `Cashout request submitted for a $${amount.toFixed(2)} ${GIFT_CARD_TYPES[giftCardType].label} gift card. Fee: $${processingFee.toFixed(2)}. Total deducted: $${totalDeduction.toFixed(2)}. Track it in Requests.` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to submit cashout request.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <SEO title="MAI Pay Cashout" />
      <h2 className="neon-text-pink" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: 24, textAlign: 'center' }}>
        Cashout
      </h2>

      <div className="card neon-border" style={{ padding: 20, marginBottom: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Available Cash Balance</p>
        <p className="neon-text-green" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '2rem' }}>${cashBalance.toFixed(2)}</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Request Visa gift cards from $5 to $500.</p>
        {amount >= 5 && amount <= 500 && (
          <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <p>Gift Card: ${amount.toFixed(2)} | Fee (2.9%): ${processingFee.toFixed(2)} | Total: ${totalDeduction.toFixed(2)}</p>
          </div>
        )}
      </div>

      {!isApproved && (
        <div style={{ padding: 16, borderRadius: 8, background: 'rgba(255,0,0,0.1)', border: '1px solid #ff4444', marginBottom: 24, textAlign: 'center' }}>
          <p style={{ color: '#ff6666', fontSize: '0.9rem' }}>⚠️ You must be approved for MAI Pay before requesting a cashout.</p>
        </div>
      )}

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 20, background: message.type === 'success' ? 'rgba(57,255,20,0.1)' : 'rgba(255,0,0,0.1)', border: `1px solid ${message.type === 'success' ? 'var(--neon-green)' : '#ff4444'}`, color: message.type === 'success' ? 'var(--neon-green)' : '#ff6666', fontSize: '0.85rem' }}>
          {message.text}
        </div>
      )}

      <div className="card neon-border" style={{ padding: 20, marginBottom: 24 }}>
        <h3 className="neon-text-blue" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: 16 }}>Dollar Amount</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10, marginBottom: 16 }}>
          {CASHOUT_OPTIONS.map((option) => (
            <button key={option} className={`btn ${amount === option ? 'btn-pink' : 'btn-outline'}`} onClick={() => setAmount(option)}>
              ${option}
            </button>
          ))}
        </div>
        <input type="number" min={5} max={500} step={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} placeholder="Enter $5 - $500" />
      </div>

      <div className="card neon-border" style={{ padding: 20, marginBottom: 24 }}>
        <h3 className="neon-text-blue" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: 16 }}>Gift Card Type</h3>
        <select
          value={giftCardType}
          onChange={(e) => setGiftCardType(e.target.value as 'visa' | 'amzn' | 'gc-com')}
          style={{
            width: '100%',
            maxWidth: 420,
            padding: '10px 12px',
            borderRadius: 4,
            border: '1px solid #e5e7eb',
            fontSize: '0.875rem',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
          }}
        >
          {Object.entries(GIFT_CARD_TYPES).map(([code, config]) => (
            <option key={code} value={code}>
              {config.label}
            </option>
          ))}
        </select>
      </div>

      <button className="btn btn-pink" onClick={submitCashout} disabled={loading || !isApproved || amount < 5 || amount > 500 || cashBalance < totalDeduction} style={{ width: '100%', maxWidth: 420, display: 'block', margin: '0 auto' }}>
        {loading ? 'Submitting...' : 'Submit Cashout Request'}
      </button>
    </div>
  );
}
