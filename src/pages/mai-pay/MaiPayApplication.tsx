import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO';

export default function MaiPayApplication() {
  const { user } = useAuthStore();
  const [paypalEmail, setPaypalEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [approved, setApproved] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    checkApplication();
  }, [user?.id]);

  const checkApplication = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('mai_pay_applications')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data?.status === 'approved') {
      setApproved(true);
    }
    setLoading(false);
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!validateEmail(paypalEmail)) {
      setMessage({ type: 'error', text: 'Please enter a valid PayPal email address.' });
      return;
    }
    if (!agreed) {
      setMessage({ type: 'error', text: 'You must agree to the terms.' });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase
      .from('mai_pay_applications')
      .insert({
        user_id: user!.id,
        paypal_email: paypalEmail,
        status: 'pending',
      });

    if (error) {
      if (error.code === '23505') {
        setMessage({ type: 'error', text: 'You already have an application on file.' });
      } else {
        setMessage({ type: 'error', text: 'Failed to submit. Please try again.' });
      }
    } else {
      setMessage({ type: 'success', text: 'Application submitted! We\'ll review it shortly.' });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid var(--neon-blue)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-slow 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="card neon-border" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <SEO title="MAI Pay Application" />

      <h2 className="neon-text-blue" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: '24px', textAlign: 'center' }}>
        MAI Pay Application
      </h2>

      {approved ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
          <p className="neon-text-green" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.3rem' }}>
            You are approved for MAI Pay!
          </p>
          <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>
            You can now cash out your Troll Coins via PayPal.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '8px' }}>
              PayPal Email *
            </label>
            <input
              type="email"
              value={paypalEmail}
              onChange={(e) => setPaypalEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'var(--bg-input)',
                border: '2px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ marginTop: '3px' }}
              />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                I agree to the MAI Pay terms: a 2.9% PayPal fee applies to cashouts.
                Minimum cashout is $5. Processing may take 1-5 business days.
              </span>
            </label>
          </div>

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

          <button
            type="submit"
            className="btn btn-green"
            disabled={submitting}
            style={{ width: '100%' }}
          >
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      )}
    </div>
  );
}
