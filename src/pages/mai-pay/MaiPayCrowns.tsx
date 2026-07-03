import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO';

interface CrownRedemption {
  id: string;
  crowns_used: number;
  coins_received: number;
  created_at: string;
}

export default function MaiPayCrowns() {
  const { user } = useAuthStore();
  const [crownBalance, setCrownBalance] = useState(user?.battle_crowns ?? 0);
  const [convertAmount, setConvertAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<CrownRedemption[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadHistory();
  }, [user?.id]);

  const loadHistory = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('crown_redemptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setHistory(data || []);
  };

  const handleConvert = async () => {
    setMessage(null);
    const crowns = parseInt(convertAmount);
    if (isNaN(crowns) || crowns <= 0) {
      setMessage({ type: 'error', text: 'Enter a valid number of crowns.' });
      return;
    }
    if (crowns > crownBalance) {
      setMessage({ type: 'error', text: 'Insufficient crown balance.' });
      return;
    }
    if (crowns % 100 !== 0) {
      setMessage({ type: 'error', text: 'Crowns must be converted in multiples of 100.' });
      return;
    }

    setLoading(true);
    const coinsReceived = (crowns / 100) * 500;

    // Insert redemption record
    const { error: insertError } = await supabase
      .from('crown_redemptions')
      .insert({
        user_id: user!.id,
        crowns_used: crowns,
        coins_received: coinsReceived,
      });

    if (insertError) {
      setMessage({ type: 'error', text: 'Conversion failed. Please try again.' });
      setLoading(false);
      return;
    }

    // Update user profile crown balance and add coins
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        battle_crowns: crownBalance - coinsReceived + coinsReceived - crowns,
        troll_coins: (user?.troll_coins ?? 0) + coinsReceived,
      })
      .eq('id', user!.id);

    if (updateError) {
      // Fallback: try RPC
      await supabase.rpc('convert_crowns', {
        p_user_id: user!.id,
        p_crowns: crowns,
      });
    }

    setCrownBalance((prev) => prev - crowns);
    setMessage({ type: 'success', text: `Converted ${crowns} Crowns → ${coinsReceived} Troll Coins!` });
    setConvertAmount('');
    loadHistory();
    setLoading(false);
  };

  return (
    <div>
      <SEO title="Battle Crowns" />

      <h2 className="neon-text-blue" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: '24px', textAlign: 'center' }}>
        Battle Crowns
      </h2>

      {/* Crown Balance */}
      <div className="card neon-border" style={{ textAlign: 'center', padding: '24px', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>👑</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '4px' }}>Current Balance</p>
        <p className="neon-text-purple" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '2rem' }}>
          {crownBalance.toLocaleString()} Crowns
        </p>
      </div>

      {/* Conversion */}
      <div className="card neon-border-pink" style={{ maxWidth: '500px', margin: '0 auto 32px', padding: '24px' }}>
        <h3 className="neon-text-pink" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: '16px', textAlign: 'center' }}>
          Convert Crowns
        </h3>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
          100 Crowns → 500 Troll Coins
        </p>

        <input
          type="number"
          value={convertAmount}
          onChange={(e) => setConvertAmount(e.target.value)}
          placeholder="Enter crowns (multiples of 100)"
          min="100"
          step="100"
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'var(--bg-input)',
            border: '2px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: '16px',
          }}
        />

        {message && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              background: message.type === 'success' ? 'rgba(57,255,20,0.1)' : 'rgba(255,0,0,0.1)',
              border: `1px solid ${message.type === 'success' ? 'var(--neon-green)' : '#ff4444'}`,
              color: message.type === 'success' ? 'var(--neon-green)' : '#ff6666',
              fontSize: '0.85rem',
            }}
          >
            {message.text}
          </div>
        )}

        <button
          className="btn btn-pink"
          onClick={handleConvert}
          disabled={loading || !convertAmount}
          style={{ width: '100%' }}
        >
          {loading ? 'Converting...' : 'Convert Crowns'}
        </button>
      </div>

      {/* Info */}
      <div className="card neon-border" style={{ padding: '20px', marginBottom: '24px', maxWidth: '600px', margin: '0 auto 24px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
          💡 <strong>How to earn Crowns:</strong> Battle Crowns are earned through gameplay — winning matches,
          completing challenges, and participating in events. Convert them to Troll Coins to boost your cashout balance!
        </p>
      </div>

      {/* Redemption History */}
      <div className="card neon-border" style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
        <h3 className="neon-text-blue" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, marginBottom: '16px' }}>
          Redemption History
        </h3>

        {history.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
            No conversions yet. Convert your crowns above!
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--text-secondary)' }}>Date</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--text-secondary)' }}>Crowns Used</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--text-secondary)' }}>Coins Received</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }} className="neon-text-purple">
                      {row.crowns_used}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }} className="neon-text-blue">
                      +{row.coins_received}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
