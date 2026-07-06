import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import SEO from '../components/SEO';

export default function RedeemPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthStore();
  const { redeemPromoCode, loadWallet, loadTokenTransactions } = useWalletStore();

  const urlCode = searchParams.get('code') || '';
  const [code, setCode] = useState(urlCode);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (urlCode) {
      setCode(urlCode);
    }
  }, [urlCode]);

  useEffect(() => {
    if (!authLoading && user && code.trim()) {
      handleRedeem(code.trim());
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (!authLoading && !user && code.trim()) {
      localStorage.setItem('pendingPromoCode', code.trim());
    }
  }, [authLoading, user, code]);

  const handleRedeem = async (promoCode: string) => {
    if (!promoCode.trim()) return;
    setLoading(true);
    setMessage('');
    setSuccess(false);

    try {
      const result = await redeemPromoCode(user!.id, promoCode);
      setMessage(result.message);
      setSuccess(result.success);
      if (result.success) {
        await loadWallet(user!.id);
        await loadTokenTransactions(user!.id);
        localStorage.removeItem('pendingPromoCode');
      }
    } catch (e) {
      setMessage('Promo redemption failed.');
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      handleRedeem(code);
    } else {
      localStorage.setItem('pendingPromoCode', code.trim());
      navigate('/login');
    }
  };

  if (authLoading) {
    return (
      <div className="page container flex items-center justify-center" style={{ minHeight: 'calc(100vh - 140px)' }}>
        <SEO title="Redeem Promo - MaiTalent.fun" description="Redeem your MaiTrollCity promo code" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="page container" style={{ maxWidth: 600, margin: '0 auto', paddingTop: 40 }}>
      <SEO title="Redeem Promo - MaiTalent.fun" description="Redeem your MaiTrollCity promo code" />

      <div className="card neon-border" style={{ marginBottom: 24 }}>
        <h1 className="neon-text-blue" style={{ fontSize: '1.75rem', marginBottom: 8 }}>
          Redeem Promo Code
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
          Enter your MaiTrollCity promo code to add tokens to your account.
        </p>

        {!user ? (
          <div style={{ background: 'rgba(0,240,255,.08)', border: '1px solid var(--neon-blue)', borderRadius: 8, padding: 20, marginBottom: 24 }}>
            <p style={{ marginBottom: 12 }}>You must be signed in to redeem a promo code.</p>
            <Link to="/login" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
              Sign In to Redeem
            </Link>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter promo code"
            style={{ flex: 1, minWidth: 220, textTransform: 'uppercase' }}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !code.trim()}>
            {loading ? 'Redeeming...' : 'Redeem'}
          </button>
        </form>

        {message && (
          <p
            style={{
              marginTop: 16,
              color: success ? '#39ff14' : '#ff4444',
              fontWeight: 600,
            }}
          >
            {message}
          </p>
        )}

        {success && (
          <div style={{ marginTop: 20 }}>
            <Link to="/profile" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
              View Wallet
            </Link>
          </div>
        )}
      </div>

      <div className="card neon-border">
        <h3 style={{ marginBottom: 12 }}>How to Get Promo Codes</h3>
        <ul style={{ lineHeight: 2, color: 'var(--text-secondary)' }}>
          <li>Visit <strong>MaiTrollCity.com</strong></li>
          <li>Complete eligible earning activities</li>
          <li>Receive your unique promo card</li>
          <li>Paste or click the redeem link here</li>
        </ul>
      </div>
    </div>
  );
}
