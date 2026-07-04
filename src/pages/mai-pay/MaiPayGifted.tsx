import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO';

interface GiftedCrown {
  id: string;
  from_user_id: string;
  from_username: string;
  amount: number;
  reason?: string;
  created_at: string;
}

export default function MaiPayGifted() {
  const { user } = useAuthStore();
  const [gifts, setGifts] = useState<GiftedCrown[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalGifted, setTotalGifted] = useState(0);

  useEffect(() => {
    loadGifts();
  }, [user?.id]);

  const loadGifts = async () => {
    if (!user?.id) return;
    setLoading(true);

    // Try to load from a gifted_crowns table, fallback to profiles
    const { data, error } = await supabase
      .from('gifted_crowns')
      .select('*')
      .eq('to_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data || data.length === 0) {
      // Fallback: check profiles for gifted_crowns field
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('gifted_crowns')
        .eq('id', user.id)
        .single();

      if (profile?.gifted_crowns && Array.isArray(profile.gifted_crowns)) {
        const giftedData = profile.gifted_crowns as any[];
        const mapped: GiftedCrown[] = giftedData.map((g: any, i: number) => ({
          id: `gifted-${i}`,
          from_user_id: g.from_id || '',
          from_username: g.from_username || 'Anonymous',
          amount: g.amount || 0,
          reason: g.reason || '',
          created_at: g.date || new Date().toISOString(),
        }));
        setGifts(mapped);
        setTotalGifted(mapped.reduce((sum, g) => sum + g.amount, 0));
      } else {
        setGifts([]);
        setTotalGifted(0);
      }
    } else {
      // Enrich with from_username
      const enriched = await Promise.all(
        data.map(async (g: any) => {
          const { data: fromProfile } = await supabase
            .from('user_profiles')
            .select('username')
            .eq('id', g.from_user_id)
            .single();
          return {
            id: g.id,
            from_user_id: g.from_user_id,
            from_username: fromProfile?.username || 'Anonymous',
            amount: g.amount,
            reason: g.reason,
            created_at: g.created_at,
          } as GiftedCrown;
        })
      );
      setGifts(enriched);
      setTotalGifted(enriched.reduce((sum, g) => sum + g.amount, 0));
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid var(--neon-purple)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-slow 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      <SEO title="Gifted Crowns" />

      <h2 className="neon-text-purple" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: '24px', textAlign: 'center' }}>
        Gifted Crowns
      </h2>

      {/* Total */}
      <div className="card neon-border" style={{ textAlign: 'center', padding: '20px', marginBottom: '24px', maxWidth: '350px', margin: '0 auto 24px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎁</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '4px' }}>Total Crowns Gifted</p>
        <p className="neon-text-purple" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.8rem' }}>
          {totalGifted.toLocaleString()}
        </p>
      </div>

      {/* Gift List */}
      {gifts.length === 0 ? (
        <div className="card neon-border" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👑</div>
          <p style={{ color: 'var(--text-secondary)' }}>No gifted crowns yet.</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '8px' }}>
            Crowns gifted by other users or admins will appear here.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '12px 10px', color: 'var(--text-secondary)' }}>From</th>
                <th style={{ textAlign: 'right', padding: '12px 10px', color: 'var(--text-secondary)' }}>Amount</th>
                <th style={{ textAlign: 'left', padding: '12px 10px', color: 'var(--text-secondary)' }}>Reason</th>
                <th style={{ textAlign: 'left', padding: '12px 10px', color: 'var(--text-secondary)' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {gifts.map((gift) => (
                <tr key={gift.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 10px' }}>
                    <span className="neon-text-pink" style={{ fontWeight: 600 }}>
                      {gift.from_username}
                    </span>
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }} className="neon-text-purple">
                    +{gift.amount.toLocaleString()} 👑
                  </td>
                  <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>
                    {gift.reason || '—'}
                  </td>
                  <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>
                    {new Date(gift.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
