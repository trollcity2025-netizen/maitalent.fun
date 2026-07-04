import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO';

export default function MaiPayApplication() {
  const { user, loadUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'none' | 'pending' | 'approved' | 'denied'>('none');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadApplication();
  }, [user?.id]);

  const loadApplication = async () => {
    if (!user?.id) return;
    setLoading(true);
    setEmail(user.email || '');
    const { data } = await supabase
      .from('mai_pay_applications')
      .select('status, paypal_email')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.status) setStatus(data.status);
    if (data?.paypal_email) setEmail(data.paypal_email);
    setLoading(false);
  };

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setMessage(null);
    if (!validateEmail(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }
    if (!agreed) {
      setMessage({ type: 'error', text: 'You must agree to the MAI Pay terms before applying.' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('mai_pay_applications').insert({
      user_id: user.id,
      paypal_email: email,
      status: 'pending',
    });
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setStatus('pending');
      setMessage({ type: 'success', text: 'MAI Pay application submitted. Once approved, use the Cashout tab to request $5-$500 Visa gift cards.' });
      await loadUser();
    }
    setSubmitting(false);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div style={{ width: 36, height: 36, border: '3px solid var(--neon-blue)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-slow 1s linear infinite' }} /></div>;
  }

  return (
    <div>
      <SEO title="MAI Pay Application" />
      <h2 className="neon-text-blue" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: 24, textAlign: 'center' }}>MAI Pay Application</h2>

      <div className="card neon-border" style={{ padding: 20, marginBottom: 24 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Apply once for MAI Pay approval. After approval, cashout requests are handled only through the Cashout tab as Visa gift cards from $5 to $500.
        </p>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 20, background: message.type === 'success' ? 'rgba(57,255,20,0.1)' : 'rgba(255,0,0,0.1)', border: `1px solid ${message.type === 'success' ? 'var(--neon-green)' : '#ff4444'}`, color: message.type === 'success' ? 'var(--neon-green)' : '#ff6666', fontSize: '0.85rem' }}>
          {message.text}
        </div>
      )}

      {status !== 'none' && (
        <div className="card neon-border-pink" style={{ padding: 16, marginBottom: 24, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Current Status</p>
          <p className={status === 'approved' ? 'neon-text-green' : status === 'denied' ? 'neon-text-pink' : 'neon-text-yellow'} style={{ fontFamily: 'var(--font-display)', fontWeight: 900, textTransform: 'uppercase' }}>{status}</p>
        </div>
      )}

      {status !== 'approved' && status !== 'pending' && (
        <form onSubmit={submitApplication} className="card neon-border" style={{ padding: 20 }}>
          <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 8 }}>Email for MAI Pay notices</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ marginBottom: 16 }} />
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 20 }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: 'auto', marginTop: 3 }} />
            I understand MAI Pay cashouts are Visa gift card requests from $5 to $500 and require admin processing before a code appears in Requests.
          </label>
          <button className="btn btn-primary" disabled={submitting} style={{ width: '100%' }}>{submitting ? 'Submitting...' : 'Submit Application'}</button>
        </form>
      )}
    </div>
  );
}
