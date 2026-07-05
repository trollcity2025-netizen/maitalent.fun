import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import { COIN_PACKAGES } from '../types';
import { CheckCircle, Loader2, ArrowRightLeft } from 'lucide-react';
import SEO from '../components/SEO';
import { supabase } from '../lib/supabase';

declare global {
  interface Window { paypal: any }
}

export default function CoinStorePage() {
  const { user } = useAuthStore();
  const { wallet, refreshWallet, convertTrollToTokens, convertHypeToTokens, hypeCoins } = useWalletStore();
  const [processing, setProcessing] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTrollConvert, setShowTrollConvert] = useState(false);
  const [showHypeConvert, setShowHypeConvert] = useState(false);
  const [trollAmount, setTrollAmount] = useState(100);
  const [hypeAmount, setHypeAmount] = useState(100);
  const [isPaypalReady, setIsPaypalReady] = useState(false);
  const captureInProgressRef = useRef(false);
  const capturedOrderIdsRef = useRef(new Set<string>());
  const paypalRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (!user) return;

    let intervalId: number | null = null;

    const initPayPal = async () => {
      if (window.paypal) {
        setIsPaypalReady(true);
        await renderPayPalButtons();
      } else {
        intervalId = window.setInterval(async () => {
          if (window.paypal) {
            setIsPaypalReady(true);
            await renderPayPalButtons();
            if (intervalId) window.clearInterval(intervalId);
          }
        }, 500);
      }
    };

    initPayPal();
    if (user?.id) refreshWallet(user.id);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [user, COIN_PACKAGES.length]);

  const renderPayPalButtons = async () => {
    COIN_PACKAGES.forEach((pkg) => {
      const container = paypalRefs.current[pkg.label];
      if (!container || container.dataset.rendered === 'true') return;

      window.paypal.Buttons({
        createOrder: async () => {
          setProcessing(pkg.label);
          setError(null);
          const tokens = Number(pkg.coins);
          const price = Number(pkg.price);
          const payload = { tokens, price, packageLabel: pkg.label };
          console.log('[CoinStore] Creating order', { tokens, price, label: pkg.label, payload });
          const { data, error } = await supabase.functions.invoke('coin-purchase', {
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' },
          });
          console.log('[CoinStore] Order result', { data, error });
          if (error || !data?.orderId) throw new Error(error?.message || 'Failed to create order');
          return data.orderId;
        },
        onApprove: async (data: any) => {
          const orderId = data.orderID || data.orderId;
          if (!orderId) {
            setError('Missing orderId');
            return;
          }

          if (captureInProgressRef.current || capturedOrderIdsRef.current.has(orderId)) {
            console.warn('Duplicate capture blocked:', orderId);
            return;
          }

          captureInProgressRef.current = true;
          capturedOrderIdsRef.current.add(orderId);

          try {
            const { data: result, error } = await supabase.functions.invoke('coin-capture', {
              body: JSON.stringify({ orderId }),
              headers: { 'Content-Type': 'application/json' },
            });

            if (result?.processing) {
              setError('Payment is still processing. Please wait a moment and refresh your wallet.');
              return;
            }

            if (error || !result?.success) throw new Error(error?.message || 'Payment failed');
            if (result?.coins == null) {
              setError('Payment completed, but no coins were returned. Please refresh your wallet.');
              return;
            }

            setSuccess(`${pkg.label} — ${result.tokens ?? result.coins} tokens added!`);
            await refreshWallet(user!.id);
            setTimeout(() => setSuccess(null), 4000);
          } catch (err: any) {
            setError(err.message);
          } finally {
            setProcessing(null);
            captureInProgressRef.current = false;
          }
        },
        onError: (err: any) => {
          console.error('[CoinStore] PayPal onError', err);
          setError('PayPal error. Please try again.');
          setProcessing(null);
        },
        onCancel: () => {
          setProcessing(null);
        },
        style: {
          layout: 'horizontal',
          color: 'blue',
          shape: 'rect',
          label: 'buynow',
          tagline: false,
        },
      }).render(container);

      container.dataset.rendered = 'true';
    });
  };

  const handleTrollConvert = async () => {
    if (!user || !wallet || trollAmount > wallet.coin_balance) {
      setError('Insufficient Troll Coins');
      return;
    }
    setProcessing('troll-convert');
    setError(null);
    try {
      await convertTrollToTokens(user.id, trollAmount);
      setSuccess(`Converted ${trollAmount} Troll Coins → ${Math.floor(trollAmount / 100)} Tokens!`);
      setShowTrollConvert(false);
      setTrollAmount(100);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleHypeConvert = async () => {
    if (!user || hypeAmount > hypeCoins) {
      setError('Insufficient Hype Coins');
      return;
    }
    setProcessing('hype-convert');
    setError(null);
    try {
      await convertHypeToTokens(user.id, hypeAmount);
      setSuccess(`Converted ${hypeAmount} Hype Coins → ${Math.floor(hypeAmount / 100)} Tokens!`);
      setShowHypeConvert(false);
      setHypeAmount(100);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="page">
      <SEO
        title="Troll Coin Store - MaiTalent.fun"
        description="Buy Troll Coins on MaiTalent.fun. 100 Troll Coins = $1 USD. Choose from 9 coin packages."
        keywords="buy Troll Coins, coin store, MaiTalent"
      />

      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 className="section-title" style={{ fontFamily: 'var(--font-display)' }}>
            Troll Coin <span className="text-gradient">Store</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
            100 Troll Coins = $1 USD · Secure checkout via PayPal
          </p>
        </div>

        {user && wallet && (
          <div style={{
            maxWidth: '600px', margin: '0 auto 32px', padding: '14px 20px',
            borderRadius: 'var(--radius-md)', background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)', textAlign: 'center',
            display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap',
          }}>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Troll Coins</span>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--accent-cyan)' }}>
                {wallet.coin_balance.toLocaleString()} 🪙
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tokens</span>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--accent-green)' }}>
                {wallet.token_balance.toLocaleString()}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hype Coins</span>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--accent-magenta)' }}>
                {hypeCoins.toLocaleString()} 🔥
              </div>
            </div>
          </div>
        )}

        {!user && (
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>Sign in to purchase Troll Coins</p>
            <Link to="/login" className="btn btn-primary">Sign In</Link>
          </div>
        )}

        {/* Conversion Section */}
        {user && wallet && (
          <div style={{
            maxWidth: '600px', margin: '0 auto 32px', padding: '20px',
            borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
          }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px', textAlign: 'center' }}>
              Convert to Tokens
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '16px' }}>
              100 Troll Coins = 50 Tokens · 100 Hype Coins = 50 Tokens
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => setShowTrollConvert(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowRightLeft size={16} />
                Troll Coins → Tokens
              </button>
              <button className="btn btn-magenta" onClick={() => setShowHypeConvert(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowRightLeft size={16} />
                Hype Coins → Tokens
              </button>
            </div>
          </div>
        )}

        {!isPaypalReady && user && (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
            <Loader2 className="animate-spin" style={{ margin: '0 auto 12px' }} />
            Loading PayPal...
          </div>
        )}

        {/* Status messages */}
        {success && (
          <div style={{
            maxWidth: '600px', margin: '0 auto 24px', padding: '14px 20px',
            borderRadius: 'var(--radius-md)', background: 'rgba(0,230,118,0.1)',
            border: '1px solid var(--accent-green)', textAlign: 'center',
            color: 'var(--accent-green)', fontSize: '0.9rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            <CheckCircle size={18} /> {success}
          </div>
        )}
        {error && (
          <div style={{
            maxWidth: '600px', margin: '0 auto 24px', padding: '14px 20px',
            borderRadius: 'var(--radius-md)', background: 'rgba(255,68,68,0.1)',
            border: '1px solid #ff4444', textAlign: 'center',
            color: '#ff6666', fontSize: '0.9rem',
          }}>
            {error}
          </div>
        )}

        {/* Coin Packages Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '20px',
        }}>
          {COIN_PACKAGES.map((pkg) => (
            <div key={pkg.coins} className="card" style={{
              textAlign: 'center', padding: '24px',
              border: '1px solid var(--border-subtle)',
              display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              <div style={{ fontSize: '2.5rem' }}>🪙</div>
              <h3 style={{
                fontFamily: 'var(--font-display)', fontSize: '1rem',
                fontWeight: 800, color: 'var(--text-primary)',
              }}>
                {pkg.label}
              </h3>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: '2rem',
                fontWeight: 900, color: 'var(--accent-green)',
              }}>
                ${pkg.price}
              </div>

              {user ? (
                <>
                  {processing === pkg.label ? (
                    <div style={{
                      padding: '14px', borderRadius: 'var(--radius-sm)',
                      background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.2)',
                      color: 'var(--accent-cyan)', fontSize: '0.8rem', fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}>
                      <Loader2 size={16} className="animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    <div ref={(el) => { paypalRefs.current[pkg.label] = el; }} style={{ minHeight: '40px' }} />
                  )}
                </>
              ) : (
                <Link to="/login" className="btn" style={{ width: '100%', textDecoration: 'none' }}>
                  Sign In to Buy
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Troll Coin Conversion Modal */}
        {showTrollConvert && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }} onClick={() => setShowTrollConvert(false)}>
            <div className="card" style={{ padding: '2rem', maxWidth: '400px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '16px', textAlign: 'center' }}>Convert Troll Coins → Tokens</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px', textAlign: 'center' }}>
                Rate: 100 Troll Coins = 1 Token
              </p>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Amount (Troll Coins)</label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={trollAmount}
                  onChange={(e) => setTrollAmount(Number(e.target.value))}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)', fontSize: '1rem',
                  }}
                />
              </div>
              <p style={{ color: 'var(--accent-green)', fontSize: '0.9rem', marginBottom: '16px', textAlign: 'center' }}>
                You will receive: <strong>{Math.floor(trollAmount / 100)} Tokens</strong>
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleTrollConvert} disabled={processing === 'troll-convert'}>
                  {processing === 'troll-convert' ? 'Converting...' : 'Convert'}
                </button>
                <button className="btn btn-outline" onClick={() => setShowTrollConvert(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Hype Coin Conversion Modal */}
        {showHypeConvert && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }} onClick={() => setShowHypeConvert(false)}>
            <div className="card" style={{ padding: '2rem', maxWidth: '400px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '16px', textAlign: 'center' }}>Convert Hype Coins → Tokens</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px', textAlign: 'center' }}>
                Rate: 100 Hype Coins = 1 Token
              </p>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Amount (Hype Coins)</label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={hypeAmount}
                  onChange={(e) => setHypeAmount(Number(e.target.value))}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)', fontSize: '1rem',
                  }}
                />
              </div>
              <p style={{ color: 'var(--accent-green)', fontSize: '0.9rem', marginBottom: '16px', textAlign: 'center' }}>
                You will receive: <strong>{Math.floor(hypeAmount / 100)} Tokens</strong>
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-magenta" style={{ flex: 1 }} onClick={handleHypeConvert} disabled={processing === 'hype-convert'}>
                  {processing === 'hype-convert' ? 'Converting...' : 'Convert'}
                </button>
                <button className="btn btn-outline" onClick={() => setShowHypeConvert(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
