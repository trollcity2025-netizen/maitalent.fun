import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import SEO from '../components/SEO';

interface PublicProfile {
  id: string;
  username: string;
  created_at: string;
}

export default function PublicProfilePage() {
  const { userId } = useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState({ games: 0, won: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    const { data: prof } = await supabase.from('user_profiles').select('id, username, created_at').eq('id', userId).single();
    setProfile(prof);
    if (prof) {
      const { data: sessions } = await supabase.from('game_sessions').select('result, reward_amount').eq('user_id', userId);
      if (sessions) {
        setStats({
          games: sessions.length,
          won: sessions.filter((s: { result: string }) => s.result === 'win').reduce((sum: number, s: { reward_amount: number }) => sum + s.reward_amount, 0),
        });
      }
    }
    setLoading(false);
  };

  if (loading) return <div className="page container"><p className="neon-text-blue">Loading...</p></div>;
  if (!profile) return <div className="page container"><p>User not found</p></div>;

  return (
    <>
      <SEO title={`${profile.username}'s Profile`} />
      <div className="page container">
        <h1 className="section-title neon-text-pink">{profile.username}</h1>
        <div className="card neon-border" style={{ maxWidth: 500, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #ff00e5, #39ff14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 'bold' }}>
              {profile.username.charAt(0).toUpperCase()}
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>Member since {new Date(profile.created_at).toLocaleDateString()}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ textAlign: 'center', padding: 16, background: '#0d0d2b', borderRadius: 8 }}>
              <p style={{ fontSize: 28, fontWeight: 'bold', fontFamily: 'var(--font-display)' }}>{stats.games}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Games Played</p>
            </div>
            <div style={{ textAlign: 'center', padding: 16, background: '#0d0d2b', borderRadius: 8 }}>
              <p style={{ fontSize: 28, fontWeight: 'bold', fontFamily: 'var(--font-display)', color: '#39ff14' }}>${stats.won.toFixed(2)}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Total Won</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
