import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import SEO from '../components/SEO';

export default function DailyRewardsPage() {
  const { user, loadUser } = useAuthStore();
  const [claimedToday, setClaimedToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    checkClaim();
  }, [user?.id]);

  const checkClaim = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('daily_reward_claims')
      .select('id')
      .eq('user_id', user.id)
      .eq('claim_date', today)
      .maybeSingle();
    setClaimedToday(!!data);
    setLoading(false);
  };

  const claim = async () => {
    if (!user?.id || claimedToday) return;
    setLoading(true);
    const { error: insertError } = await supabase.from('daily_reward_claims').insert({ user_id: user.id, claim_date: today, crowns_awarded: 100 });
    if (insertError) {
      setMessage(insertError.code === '23505' ? 'Daily reward already claimed today.' : insertError.message);
      setClaimedToday(true);
      setLoading(false);
      return;
    }
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ crowns: (user.crowns ?? 0) + 100, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (updateError) setMessage(updateError.message);
    else {
      setClaimedToday(true);
      setMessage('Daily reward claimed! +100 Crowns');
      await loadUser();
    }
    setLoading(false);
  };

  return (
    <div className="page container" style={{ maxWidth: 760 }}>
      <SEO title="Daily Rewards" />
      <h1 className="section-title neon-text-blue">Daily Rewards</h1>
      <div className="card neon-border" style={{ padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: 16 }}>👑</div>
        <h2 className="neon-text-pink" style={{ fontFamily: 'var(--font-display)', marginBottom: 12 }}>Claim 100 Crowns Daily</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Come back every day and claim 100 Crowns. Crowns can be converted to Troll Coins inside MAI Pay.</p>
        {message && <p className="neon-text-green" style={{ marginBottom: 16 }}>{message}</p>}
        <button className="btn btn-primary" onClick={claim} disabled={loading || claimedToday}>{loading ? 'Checking...' : claimedToday ? 'Claimed Today' : 'Claim 100 Crowns'}</button>
      </div>
    </div>
  );
}
