import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
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
  const [underAgeBanner, setUnderAgeBanner] = useState(false);
  const [geoBannedBanner, setGeoBannedBanner] = useState(false);
  const [banLoading, setBanLoading] = useState(false);

  const { signIn, signUp } = useAuthStore();
  const navigate = useNavigate();

  const calculateAge = (dob: string) => {
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  const getDeviceFingerprint = () => {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('device_id', deviceId);
    }
    return `${deviceId}|${navigator.userAgent}`;
  };

  const getUserIP = async () => {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      return data.ip;
    } catch {
      return null;
    }
  };

  const getUserLocation = async () => {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true });
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
    } catch {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.latitude && data.longitude) {
          return { lat: data.latitude, lng: data.longitude, accuracy: 50000 };
        }
      } catch {}
    }
    return null;
  };

  const recordBan = async (banType: string, reason: string, meta: Record<string, unknown>) => {
    const ip = await getUserIP();
    const deviceFingerprint = getDeviceFingerprint();
    const location = await getUserLocation();
    await supabase.from('user_bans').insert({
      ban_type: banType,
      ip_address: ip,
      device_fingerprint: deviceFingerprint,
      latitude: location?.lat,
      longitude: location?.lng,
      reason,
      metadata: meta,
    });
  };

  const checkExistingBans = async (): Promise<boolean> => {
    const ip = await getUserIP();
    const deviceFingerprint = getDeviceFingerprint();
    const location = await getUserLocation();

    if (ip) {
      const { data: ipBanned } = await supabase.rpc('is_ip_banned', { p_ip: ip });
      if (ipBanned) return true;
    }

    const { data: devBanned } = await supabase.rpc('is_device_banned', { p_device_fingerprint: deviceFingerprint });
    if (devBanned) return true;

    if (location) {
      const { data: geoBanned } = await supabase.rpc('is_near_banned_location', { p_lat: location.lat, p_lng: location.lng, p_radius_meters: 61 });
      if (geoBanned) return true;
    }

    return false;
  };

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
    setUnderAgeBanner(false);
    setGeoBannedBanner(false);
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

    setBanLoading(true);
    try {
      const age = calculateAge(dateOfBirth);
      if (age < 21) {
        const meta = { dateOfBirth, realName, address, city, state, zip, ssnLast4, age, username: username || email.split('@')[0] };
        await recordBan('age_under_21', `Under 21 (Age: ${age}) - State: ${state}`, meta);
        setUnderAgeBanner(true);
        setBanLoading(false);
        return;
      }

      const isBanned = await checkExistingBans();
      if (isBanned) {
        const meta = { dateOfBirth, realName, address, city, state, zip, ssnLast4, age, username: username || email.split('@')[0] };
        await recordBan('geo_proximity', 'Within 200 feet of banned location/IP/device', meta);
        setGeoBannedBanner(true);
        setBanLoading(false);
        return;
      }

      setLoading(true);
      const { error } = await signUp(email, password, username, realName, dateOfBirth, address, city, state, zip, ssnLast4, {
        ip: await getUserIP(),
        deviceFingerprint: getDeviceFingerprint(),
        latitude: (await getUserLocation())?.lat,
        longitude: (await getUserLocation())?.lng,
      });
      setLoading(false);
      setBanLoading(false);
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
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during signup.');
      setLoading(false);
      setBanLoading(false);
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
            {underAgeBanner && (
              <div style={{ padding: 16, borderRadius: 8, background: 'rgba(255,68,68,0.15)', border: '1px solid #ff4444', color: '#ff6666', textAlign: 'center', fontSize: '0.9rem' }}>
                <strong>Under Age</strong><br />
                You must be 21 or older to use this platform. Your IP, device, and location have been recorded and access is restricted.
              </div>
            )}
            {geoBannedBanner && (
              <div style={{ padding: 16, borderRadius: 8, background: 'rgba(255,68,68,0.15)', border: '1px solid #ff4444', color: '#ff6666', textAlign: 'center', fontSize: '0.9rem' }}>
                <strong>Location Restricted</strong><br />
                Access from your current location is restricted due to proximity to a banned area. You may not sign up from this location.
              </div>
            )}
            {banLoading && (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.85rem' }}>Verifying location...</p>
            )}
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
