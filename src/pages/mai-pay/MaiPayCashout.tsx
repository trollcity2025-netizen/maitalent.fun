import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO';

const CASHOUT_TIERS = [
  { amount: 5, coins: 1000 },
  { amount: 10, coins: 2000 },
  { amount: 20, coins: 4000 },
  { amount: 50, coins: 10000 },
  { amount: 100, coins: 20000 },
  { amount: 200, coins: 40000 },
  { amount: 300, coins: 60000 },
  { amount: 500, coins: 100000 },
  { amount: 1000, coins: 200000 },
];

const GIFT_CARD_OPTIONS = [5, 10, 15, 20];

export default function MaiPayCashout() {
  const { user } = useAuthStore();
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedGiftCard, setSelectedGiftCard] = useState<number | null>(null);
  const [paypalEmail, setPaypalEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<{ amount: number; requested_at: string } | null>(null);
  const [pendingGiftCard, setPendingGiftCard] = useState<{ amount: number; created_at: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadUserData();
  }, [user?.id]);

  const loadUserData = async () => {
    if (!user?.id) return;
    setLoading(true);

    // Get PayPal email from profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('paypal_email')
      .eq('id', user.id)
      .single();
    if (profile?.paypal_email) setPaypalEmail(profile.paypal_email);

    // Check for pending request
    const { data: pending } = await supabase
      .from('cashout_requests')
      .select('requested_amount, requested_at')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(1)
      .single();

    if (pending) {
      setPendingRequest({ amount: pending.requested_amount, requested_at: pending.requested_at });
    }

    // Check for pending gift card redemption
    const { data: pendingGift } = await supabase
      .from('gift_card_redemptions')
      .select('amount_usd, created_at')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (pendingGift) {
      setPendingGiftCard({ amount: pendingGift.amount_usd, created_at: pendingGift.created_at });
    }

    setLoading(false);
  };

  const isApproved = user?.cashout_approved ?? false;
  const cashoutBalance = user?.cashout_coins ?? 0;
  const giftCardProgress = user?.gift_card_progress ?? 0;

  const getSelectedAmount = () => {
    if (selectedTier !== null) return selectedTier;
    const custom = parseFloat(customAmount);
    return isNaN(custom) ? 0 : custom;
  };

  const getCoinsRequired = (amount: number) => amount * 100 * 2; // 2x earning value

  const getGiftCardProgressCost = (amountUsd: number) => amountUsd * 1000; // 1000 progress points per $1

  const handleSubmit = async () => {
    setMessage(null);
    const amount = getSelectedAmount();

    if (!isApproved) {
      setMessage({ type: 'error', text: 'You must be approved for MAI Pay before cashing out. Check the Application tab.' });
      return;
    }
    if (!paypalEmail) {
      setMessage({ type: 'error', text: 'PayPal email is required. Please set it in your profile.' });
      return;
    }
    if (amount < 5) {
      setMessage({ type: 'error', text: 'Minimum cashout is $5.' });
      return;
    }
    if (pendingRequest) {
      setMessage({ type: 'error', text: 'You already have a pending cashout request. Wait for it to be processed.' });
      return;
    }

    const coinsNeeded = getCoinsRequired(amount);
    if (coinsNeeded > cashoutBalance) {
      setMessage({ type: 'error', text: `Insufficient cashout balance. You need ${coinsNeeded.toLocaleString()} coins for $${amount}.` });
      return;
    }

    setSubmitting(true);
    const fee = amount * 0.029;
    const netAmount = amount - fee;

    const { error } = await supabase
      .from('cashout_requests')
      .insert({
        user_id: user!.id,
        requested_amount: netAmount,
        coin_amount: coinsNeeded,
        paypal_email: paypalEmail,
        status: 'pending',
      });

    if (error) {
      if (error.code === '23505') {
        setMessage({ type: 'error', text: 'You already have a pending request.' });
      } else {
        setMessage({ type: 'error', text: 'Failed to submit request. Please try again.' });
      }
    } else {
      // Update reserved balance
      await supabase
        .from('user_profiles')
        .update({ cashout_reserved_coins: (user?.cashout_reserved_coins ?? 0) + coinsNeeded })
        .eq('id', user!.id);

      setMessage({ type: 'success', text: `Cashout request for $${amount.toFixed(2)} submitted! ($${netAmount.toFixed(2)} after 2.9% fee)` });
      setPendingRequest({ amount: netAmount, requested_at: new Date().toISOString() });
    }
    setSubmitting(false);
  };

  const handleGiftCardSubmit = async () => {
    if (!selectedGiftCard) return;
    setMessage(null);
    const progressNeeded = getGiftCardProgressCost(selectedGiftCard);

    if (!isApproved) {
      setMessage({ type: 'error', text: 'You must be approved for MAI Pay before redeeming gift cards. Check the Application tab.' });
      return;
    }
    if (giftCardProgress < progressNeeded) {
      setMessage({ type: 'error', text: `Insufficient gift card progress. You need ${progressNeeded.toLocaleString()} progress for $${selectedGiftCard}.` });
      return;
    }
    if (pendingGiftCard) {
      setMessage({ type: 'error', text: 'You already have a pending gift card request. Wait for it to be processed.' });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase
      .from('gift_card_redemptions')
      .insert({
        user_id: user!.id,
        amount_usd: selectedGiftCard,
        gift_card_progress_used: progressNeeded,
        email: user!.email,
        status: 'pending',
      });

    if (error) {
      setMessage({ type: 'error', text: 'Failed to submit gift card request. Please try again.' });
    } else {
      await supabase
        .from('user_profiles')
        .update({ gift_card_progress: giftCardProgress - progressNeeded })
        .eq('id', user!.id);
      setMessage({ type: 'success', text: `Gift card redemption for $${selectedGiftCard.toFixed(2)} submitted!` });
      setPendingGiftCard({ amount: selectedGiftCard, created_at: new Date().toISOString() });
      setSelectedGiftCard(null);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid var(--neon-green)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-slow 1s linear infinite' }} />
      </div>
    );
  }

  const selectedAmount = getSelectedAmount();
  const coinsRequired = getCoinsRequired(selectedAmount);
  const fee = selectedAmount * 0.029;

  return (
    <div>
      <SEO title="Cash Out" />

      <h2 className="neon-text-green" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: '24px', textAlign: 'center' }}>
        Cash Out
      </h2>

      {/* Pending Banner */}
      {pendingRequest && (
        <div
          className="card neon-border-pink"
          style={{ padding: '16px', marginBottom: '24px', textAlign: 'center' }}
        >
          <p className="neon-text-yellow" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
            ⏳ Pending Cashout: ${pendingRequest.amount.toFixed(2)}
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
            Submitted {new Date(pendingRequest.requested_at).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Requirements */}
      {!isApproved && (
        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            background: 'rgba(255,0,0,0.1)',
            border: '1px solid #ff4444',
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#ff6666', fontSize: '0.9rem' }}>
            ⚠️ You must be approved for MAI Pay before cashing out. Visit the Application tab.
          </p>
        </div>
      )}

      {/* Cashout Tiers */}
      <div className="card neon-border" style={{ padding: '20px', marginBottom: '24px' }}>
        <h3 className="neon-text-blue" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: '16px' }}>
          Cashout Tiers
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>
          2x earning value required • 2.9% PayPal fee deducted
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
          {CASHOUT_TIERS.map((tier) => (
            <button
              key={tier.amount}
              className={`btn ${selectedTier === tier.amount ? 'btn-green' : 'btn-outline'}`}
              onClick={() => { setSelectedTier(tier.amount); setCustomAmount(''); }}
              style={{ padding: '12px 8px', fontSize: '0.8rem' }}
            >
              <div style={{ fontWeight: 900 }}>${tier.amount}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{tier.coins.toLocaleString()} coins</div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Amount */}
      <div className="card neon-border-pink" style={{ padding: '20px', marginBottom: '24px' }}>
        <h3 className="neon-text-pink" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: '16px' }}>
          Custom Amount
        </h3>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>$</span>
          <input
            type="number"
            value={customAmount}
            onChange={(e) => { setCustomAmount(e.target.value); setSelectedTier(null); }}
            placeholder="Min $5"
            min="5"
            step="1"
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'var(--bg-input)',
              border: '2px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Summary */}
      {selectedAmount >= 5 && (
        <div className="card neon-border" style={{ padding: '20px', marginBottom: '24px' }}>
          <h3 className="neon-text-blue" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: '12px' }}>
            Cashout Summary
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)' }}>Amount</p>
              <p className="neon-text-green" style={{ fontWeight: 700 }}>${selectedAmount.toFixed(2)}</p>
            </div>
            <div>
              <p style={{ color: 'var(--text-secondary)' }}>Coins Required</p>
              <p className="neon-text-blue" style={{ fontWeight: 700 }}>{coinsRequired.toLocaleString()}</p>
            </div>
            <div>
              <p style={{ color: 'var(--text-secondary)' }}>PayPal Fee (2.9%)</p>
              <p style={{ color: '#ff6666', fontWeight: 700 }}>-${fee.toFixed(2)}</p>
            </div>
            <div>
              <p style={{ color: 'var(--text-secondary)' }}>You Receive</p>
              <p className="neon-text-green" style={{ fontWeight: 900, fontSize: '1.1rem' }}>
                ${(selectedAmount - fee).toFixed(2)}
              </p>
            </div>
          </div>
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              PayPal: <span style={{ color: 'var(--text-primary)' }}>{paypalEmail || 'Not set'}</span>
            </p>
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            background: message.type === 'success' ? 'rgba(57,255,20,0.1)' : 'rgba(255,0,0,0.1)',
            border: `1px solid ${message.type === 'success' ? 'var(--neon-green)' : '#ff4444'}`,
            color: message.type === 'success' ? 'var(--neon-green)' : '#ff6666',
            fontSize: '0.85rem',
          }}
        >
          {message.text}
        </div>
      )}

      {/* Submit */}
      <button
        className="btn btn-green"
        onClick={handleSubmit}
        disabled={submitting || selectedAmount < 5 || !isApproved || !!pendingRequest}
        style={{ width: '100%', maxWidth: '400px', display: 'block', margin: '0 auto' }}
      >
{submitting ? 'Submitting...' : 'Submit Cashout Request'}
       </button>

       {/* Gift Card Redemption */}
       <div style={{ marginTop: '48px', borderTop: '2px solid var(--border)', paddingTop: '32px' }}>
         <h2 className="neon-text-pink" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: '24px', textAlign: 'center' }}>
           Gift Card Redemption
         </h2>

         {pendingGiftCard && (
           <div className="card neon-border-pink" style={{ padding: '16px', marginBottom: '24px', textAlign: 'center' }}>
             <p className="neon-text-yellow" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
               ⏳ Pending Gift Card: ${pendingGiftCard.amount.toFixed(2)}
             </p>
             <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
               Submitted {new Date(pendingGiftCard.created_at).toLocaleDateString()}
             </p>
           </div>
         )}

         <div className="card neon-border" style={{ padding: '20px', marginBottom: '24px' }}>
           <h3 className="neon-text-pink" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: '16px' }}>
             Gift Card Options
           </h3>
           <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>
             Use your Gift Card Progress to redeem for gift cards. No fees apply.
           </p>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px', marginBottom: '16px' }}>
             {GIFT_CARD_OPTIONS.map((amount) => (
               <button
                 key={amount}
                 className={`btn ${selectedGiftCard === amount ? 'btn-pink' : 'btn-outline'}`}
                 onClick={() => setSelectedGiftCard(amount)}
                 style={{ padding: '12px 8px', fontSize: '0.85rem' }}
               >
                 ${amount}
               </button>
             ))}
           </div>
           <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
             Your Progress: <span className="neon-text-pink" style={{ fontWeight: 700 }}>{giftCardProgress.toLocaleString()}</span> / {selectedGiftCard ? (selectedGiftCard * 1000).toLocaleString() : '5,000'} needed
           </p>
         </div>

         {selectedGiftCard && (
           <div className="card neon-border-pink" style={{ padding: '20px', marginBottom: '24px' }}>
             <h3 className="neon-text-pink" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: '12px' }}>
               Gift Card Summary
             </h3>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem' }}>
               <div>
                 <p style={{ color: 'var(--text-secondary)' }}>Amount</p>
                 <p className="neon-text-pink" style={{ fontWeight: 700 }}>${selectedGiftCard.toFixed(2)}</p>
               </div>
               <div>
                 <p style={{ color: 'var(--text-secondary)' }}>Progress Required</p>
                 <p className="neon-text-pink" style={{ fontWeight: 700 }}>{(selectedGiftCard * 1000).toLocaleString()}</p>
               </div>
             </div>
           </div>
         )}

         <button
           className="btn btn-pink"
           onClick={handleGiftCardSubmit}
           disabled={submitting || !selectedGiftCard || !isApproved || !!pendingGiftCard || giftCardProgress < (selectedGiftCard ?? 5) * 1000}
           style={{ width: '100%', maxWidth: '400px', display: 'block', margin: '0 auto' }}
         >
           {!selectedGiftCard ? 'Select Amount' : !isApproved ? 'Not Approved' : giftCardProgress < (selectedGiftCard ?? 5) * 1000 ? 'Insufficient Progress' : pendingGiftCard ? 'Pending Request' : 'Redeem Gift Card'}
         </button>
       </div>
     </div>
   );
 }
