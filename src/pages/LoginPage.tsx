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
      navigate('/dashboard');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, username);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="grid-bg" style={{ minHeight: 'calc(100vh - 140px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <SEO
        title="Sign In - MaiTalent.fun"
        description="Sign in or create an account on MaiTalent.fun to start playing arcade games and earning rewards."
      />

      <div className="card neon-border" style={{ maxWidth: '440px', width: '100%' }}>
        <h1 className="neon-text-blue" style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '24px' }}>
          {tab === 'signin' ? 'Sign In' : 'Sign Up'}
        </h1>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', marginBottom: '24px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333366' }}>
          <button
            onClick={() => { setTab('signin'); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              background: tab === 'signin' ? 'var(--neon-blue)' : 'transparent',
              color: tab === 'signin' ? '#000' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab('signup'); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              background: tab === 'signup' ? 'var(--neon-pink)' : 'transparent',
              color: tab === 'signup' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
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
          <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
            <button type="submit" className="btn btn-pink" disabled={loading} style={{ width: '100%' }}>
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
