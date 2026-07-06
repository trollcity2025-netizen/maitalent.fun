import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import SEO from '../components/SEO';
import type { GameSession } from '../types';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const { wallet, loadWallet, redeemPromoCode } = useWalletStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sessions, setSessions] = useState<GameSession[]>([]);

  // ID verification state
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idUploading, setIdUploading] = useState(false);
  const [idMessage, setIdMessage] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    setUsername(user.username);
    loadSessions();
    loadWallet(user.id);
  }, [user, loadWallet]);

  const loadSessions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setSessions(data || []);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('user_profiles')
      .update({ username })
      .eq('id', user.id);
    if (error) setMessage('Error: ' + error.message);
    else setMessage('Profile updated!');
    setSaving(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleRedeemPromo = async () => {
    if (!user || !promoCode.trim()) return;
    setPromoLoading(true);
    const result = await redeemPromoCode(user.id, promoCode.trim());
    setMessage(result.message);
    setPromoLoading(false);
    setPromoCode('');
    setTimeout(() => setMessage(''), 4000);
  };

  const getVerificationStatus = () => {
    if (!user) return { status: 'unknown', daysUntilExpiry: 0, needsReverification: false };
    const status = user.id_verification_status || 'not_submitted';
    if (status !== 'approved') return { status, daysUntilExpiry: 0, needsReverification: true };

    if (!user.id_verified_at) return { status, daysUntilExpiry: 0, needsReverification: true };

    const verifiedAt = new Date(user.id_verified_at);
    const now = new Date();
    const daysSince = Math.floor((now.getTime() - verifiedAt.getTime()) / (1000 * 60 * 60 * 24));
    const daysUntilExpiry = Math.max(0, 30 - daysSince);
    const needsReverification = daysSince >= 30;

    return { status, daysUntilExpiry, needsReverification };
  };

  const verification = getVerificationStatus();

  const handleIdUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idFile || !user) return;
    setIdUploading(true);
    setIdMessage('');

    try {
      const fileExt = idFile.name.split('.').pop();
      const filePath = `${user.id}/id-verification.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('id-verification')
        .upload(filePath, idFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('id-verification')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          id_document_url: publicUrl,
          id_verification_status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setIdMessage('ID document submitted for review.');
      setIdFile(null);
    } catch (err: any) {
      setIdMessage('Error uploading ID: ' + err.message);
    } finally {
      setIdUploading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <SEO title="My Profile" description="Manage your MaiTalent.fun profile" />
      <div className="page container">
        <h1 className="section-title neon-text-blue">My Profile</h1>

        <div className="card neon-border" style={{ maxWidth: 600, margin: '0 auto 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, #00f0ff, #ff00e5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 'bold'
            }}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ marginBottom: 4 }}>{user.username}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{user.email}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                Member since {new Date(user.created_at ?? new Date().toISOString()).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Email</label>
            <input type="email" value={user.email} disabled style={{ opacity: 0.6 }} />
          </div>

          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
          {message && <p style={{ marginTop: 12, color: message.includes('Error') ? '#ff4444' : '#39ff14' }}>{message}</p>}
        </div>

        {/* ID Verification Section */}
        <div className="card neon-border" style={{ maxWidth: 600, margin: '0 auto 24px' }}>
          <h3 style={{ marginBottom: 12 }}>Identity Verification</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 16 }}>
            Verify your identity to unlock premium games. Verification is required once every 30 days.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <span className="badge" style={{
              background: verification.status === 'approved' ? 'rgba(57,255,20,.1)' : verification.status === 'pending' ? 'rgba(255,255,0,.1)' : 'rgba(255,68,68,.1)',
              border: `1px solid ${verification.status === 'approved' ? '#39ff1440' : verification.status === 'pending' ? '#ffff0040' : '#ff444440'}`,
              color: verification.status === 'approved' ? '#39ff14' : verification.status === 'pending' ? '#ffff00' : '#ff4444',
            }}>
              {verification.status === 'approved' ? 'Verified' : verification.status === 'pending' ? 'Pending Review' : 'Not Verified'}
            </span>
            {verification.status === 'approved' && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {verification.needsReverification
                  ? 'Re-verification required (30 days elapsed)'
                  : `Expires in ${verification.daysUntilExpiry} days`}
              </span>
            )}
          </div>

          {(verification.status !== 'approved' || verification.needsReverification) && (
            <form onSubmit={handleIdUpload} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: '0.85rem' }}>
                  Upload Government-Issued ID
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setIdFile(e.target.files?.[0] || null)}
                  style={{ fontSize: '0.85rem' }}
                  disabled={idUploading}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  Accepted formats: JPG, PNG, WEBP. Max 5MB.
                </p>
              </div>
              <button type="submit" className="btn btn-primary" disabled={idUploading || !idFile}>
                {idUploading ? 'Uploading...' : 'Submit ID for Verification'}
              </button>
              {idMessage && (
                <p style={{ color: idMessage.includes('Error') ? '#ff4444' : '#39ff14', fontSize: '0.85rem' }}>
                  {idMessage}
                </p>
              )}
            </form>
          )}

          {verification.status === 'approved' && !verification.needsReverification && (
            <p style={{ fontSize: '0.85rem', color: '#39ff14' }}>
              Your identity is verified. You have access to premium games.
            </p>
          )}
        </div>

        <div className="card neon-border" style={{ maxWidth: 600, margin: '0 auto 24px' }}>
          <h3 style={{ marginBottom: 12 }}>Redeem Troll City Promo</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Enter promo code"
              style={{ flex: 1, minWidth: 220 }}
            />
            <button className="btn btn-primary" onClick={handleRedeemPromo} disabled={promoLoading || !promoCode.trim()}>
              {promoLoading ? 'Redeeming...' : 'Redeem'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="card neon-border-green" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 32, fontWeight: 'bold', fontFamily: 'var(--font-display)' }}>{wallet?.coin_balance || 0}</p>
            <p style={{ color: 'var(--text-secondary)' }}>Troll Coins</p>
          </div>
          <div className="card neon-border-pink" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 32, fontWeight: 'bold', fontFamily: 'var(--font-display)' }}>{wallet?.token_balance ?? 0}</p>
            <p style={{ color: 'var(--text-secondary)' }}>Game Tokens</p>
          </div>
          <div className="card neon-border" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 32, fontWeight: 'bold', fontFamily: 'var(--font-display)' }}>${wallet?.total_won?.toFixed(2) || '0.00'}</p>
            <p style={{ color: 'var(--text-secondary)' }}>Total Won</p>
          </div>
        </div>

        <h2 style={{ marginBottom: 16 }}>Recent Activity</h2>
        <div className="card neon-border">
          {sessions.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No games played yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessions.map((s) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: '#0d0d2b', borderRadius: 8 }}>
                  <span style={{ textTransform: 'capitalize' }}>{s.game_type.replace(/-/g, ' ')}</span>
                  <span style={{ color: s.result === 'win' ? '#39ff14' : '#ff4444', fontWeight: 600 }}>
                    {s.result === 'win' ? `+$${s.reward_amount.toFixed(2)}` : 'No win'}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{new Date(s.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
