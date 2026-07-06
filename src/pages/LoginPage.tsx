import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import SEO from '../components/SEO';

export default function LoginPage() {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [realName, setRealName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [ssnLast4, setSsnLast4] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp } = useAuthStore();
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      const pending = localStorage.getItem('pendingPromoCode');
      if (pending) {
        navigate(`/redeem?code=${encodeURIComponent(pending)}`);
      } else {
        navigate('/dashboard');
      }
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!realName.trim() || !dateOfBirth || !address.trim() || !city.trim() || !state.trim() || !zip.trim() || !ssnLast4.trim()) {
      setError('All fields are required for identity verification.');
      return;
    }
    if (ssnLast4.trim().length !== 4 || !/^\d{4}$/.test(ssnLast4.trim())) {
      setError('SSN last 4 must be exactly 4 digits.');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, username, realName, dateOfBirth, address, city, state, zip, ssnLast4);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      const pending = localStorage.getItem('pendingPromoCode');
      if (pending) {
        navigate(`/redeem?code=${encodeURIComponent(pending)}`);
      } else {
        navigate('/dashboard');
      }
    }
  };

  return (
    <div className="grid-bg" style={{ minHeight: 'calc(100vh - 140px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <SEO
        title="Sign In - MaiTalent.fun"
        description="Sign in or create an account on MaiTalent.fun to start playing arcade games and earning rewards."
      />

      <div className="card neon-border" style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h1 className="neon-text-blue" style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '24px' }}>
          {tab === 'signin' ? 'Sign In' : 'Sign Up'}
        </h1>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', marginBottom: '24px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333366' }}>
          <button
            onClick={() => { setTab('signin'); setError(''); }}
            style={{
              flex: 1, padding: '10px',
              background: tab === 'signin' ? 'var(--neon-blue)' : 'transparent',
              color: tab === 'signin' ? '#000' : 'var(--text-secondary)',
              border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '12px',
              textTransform: 'uppercase', letterSpacing: '1px',
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab('signup'); setError(''); }}
            style={{
              flex: 1, padding: '10px',
              background: tab === 'signup' ? 'var(--neon-pink)' : 'transparent',
              color: tab === 'signup' ? '#fff' : 'var(--text-secondary)',
              border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '12px',
              textTransform: 'uppercase', letterSpacing: '1px',
            }}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <p style={{ color: '#ff4444', fontSize: '0.85rem', marginBottom: '16px', textAlign: 'center' }}>
            {error}
          </p>
        )}

        {tab === 'signin' ? (
          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ borderColor: 'var(--neon-blue)' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ borderColor: 'var(--neon-blue)' }}
            />
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{ borderColor: 'var(--neon-pink)' }}
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ borderColor: 'var(--neon-pink)' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ borderColor: 'var(--neon-pink)' }}
            />
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{ borderColor: 'var(--neon-pink)' }}
            />

            <div style={{ borderTop: '1px solid #333366', margin: '8px 0', paddingTop: 12 }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12, textAlign: 'center' }}>
                Identity Verification (required for premium games)
              </p>
            </div>

            <input
              type="text"
              placeholder="Full Legal Name"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              required
              style={{ borderColor: 'var(--neon-pink)' }}
            />
            <input
              type="date"
              placeholder="Date of Birth"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              required
              style={{ borderColor: 'var(--neon-pink)' }}
            />
            <input
              type="text"
              placeholder="Street Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              style={{ borderColor: 'var(--neon-pink)' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <input
                type="text"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                style={{ borderColor: 'var(--neon-pink)' }}
              />
              <input
                type="text"
                placeholder="State"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                style={{ borderColor: 'var(--neon-pink)' }}
              />
              <input
                type="text"
                placeholder="ZIP Code"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                required
                style={{ borderColor: 'var(--neon-pink)' }}
              />
            </div>
            <input
              type="text"
              placeholder="SSN Last 4 Digits"
              value={ssnLast4}
              onChange={(e) => setSsnLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              required
              maxLength={4}
              style={{ borderColor: 'var(--neon-pink)' }}
            />

            <button type="submit" className="btn btn-pink" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link to="/" style={{ color: 'var(--neon-blue)', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
