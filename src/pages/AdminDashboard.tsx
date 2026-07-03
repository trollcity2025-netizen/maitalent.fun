import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import SEO from '../components/SEO';
import type { AdminGameSettings, CashoutRequest, Profile, MaiPayApplication, GiftCardRedemption, PendingPaypalOrder } from '../types';

type Tab = 'overview' | 'users' | 'cashouts' | 'applications' | 'settings' | 'audit' | 'trivia' | 'giftcards' | 'coin-purchases';

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [users, setUsers] = useState<Profile[]>([]);
  const [cashouts, setCashouts] = useState<CashoutRequest[]>([]);
  const [applications, setApplications] = useState<MaiPayApplication[]>([]);
  const [giftCards, setGiftCards] = useState<GiftCardRedemption[]>([]);
  const [settings, setSettings] = useState<AdminGameSettings[]>([]);
  const [coinPurchases, setCoinPurchases] = useState<(PendingPaypalOrder & { profile?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { if (user) loadData(); }, [user, tab]);

  const loadData = async () => {
    setLoading(true);
    if (tab === 'users' || tab === 'overview') {
      const { data: u } = await supabase.from('user_profiles').select('*').limit(100);
      setUsers(u || []);
    }
    if (tab === 'cashouts' || tab === 'overview') {
      const { data: c } = await supabase.from('cashout_requests').select('*').order('requested_at', { ascending: false }).limit(50);
      setCashouts(c || []);
    }
    if (tab === 'applications') {
      const { data: a } = await supabase.from('mai_pay_applications').select('*').order('created_at', { ascending: false }).limit(50);
      setApplications(a || []);
    }
    if (tab === 'giftcards' || tab === 'overview') {
      const { data: g } = await supabase.from('gift_card_redemptions').select('*').order('created_at', { ascending: false }).limit(50);
      setGiftCards(g || []);
    }
    if (tab === 'settings') {
      const { data: s } = await supabase.from('admin_game_settings').select('*');
      setSettings(s || []);
    }
    if (tab === 'coin-purchases') {
      const { data: orders } = await supabase
        .from('pending_paypal_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      const userIds = [...new Set((orders || []).map(o => o.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('user_profiles').select('id, username, email').in('id', userIds)
        : { data: [] as Profile[] };
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setCoinPurchases((orders || []).map(o => ({ ...o, profile: profileMap.get(o.user_id) })));
    }
    setLoading(false);
  };

  const handleFreeze = async (userId: string, frozen: boolean) => {
    await supabase.from('user_profiles').update({ frozen }).eq('id', userId);
    loadData();
  };

  const handleCashoutAction = async (id: string, action: 'approved' | 'denied' | 'paid' | 'payout') => {
    if (action === 'payout') {
      try {
        const { data, error } = await supabase.functions.invoke('paypal-payout', {
          body: { cashoutRequestId: id },
        });
        if (error || !data?.success) throw new Error(error?.message || 'Payout failed');
        alert(`Payout sent! Batch ID: ${data.batchId}`);
      } catch (err: any) {
        alert(`Payout error: ${err.message}`);
        return;
      }
      loadData();
      return;
    }

    await supabase.from('cashout_requests').update({
      status: action, approved_by: user?.id,
      ...(action === 'approved' ? { approved_at: new Date().toISOString() } : {}),
      ...(action === 'paid' ? { paid_at: new Date().toISOString() } : {}),
    }).eq('id', id);
    loadData();
  };

  const handleApplicationAction = async (id: string, action: 'approved' | 'denied') => {
    const update: any = { status: action, reviewed_by: user?.id, reviewed_at: new Date().toISOString() };
    if (action === 'approved') {
      update.cashout_approved = true;
    }
    await supabase.from('mai_pay_applications').update(update).eq('id', id);
    await supabase.from('user_profiles').update({ cashout_approved: action === 'approved' }).eq('id', (applications.find(a => a.id === id))?.user_id);
    loadData();
  };

  const handleGiftCardAction = async (id: string, action: 'approved' | 'denied' | 'sent') => {
    const update: any = { status: action, updated_at: new Date().toISOString() };
    if (action === 'approved') {
      update.approved_by = user?.id;
      update.approved_at = new Date().toISOString();
    }
    if (action === 'sent') {
      update.sent_by = user?.id;
      update.sent_at = new Date().toISOString();
    }
    await supabase.from('gift_card_redemptions').update(update).eq('id', id);
    loadData();
  };

  const sendGiftCardEmail = async (redemption: GiftCardRedemption) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-gift-card-email', {
        body: { redemptionId: redemption.id, email: redemption.email, amount: redemption.amount_usd },
      });
      if (error || !data?.success) throw new Error(error?.message || 'Email send failed');
      alert(`Gift card email sent to ${redemption.email}`);
      handleGiftCardAction(redemption.id, 'sent');
    } catch (err: any) {
      alert(`Email error: ${err.message}`);
    }
  };

  const handleUpdateSetting = async (id: string, field: string, value: number | boolean) => {
    await supabase.from('admin_game_settings').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id);
    loadData();
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCashouts = cashouts.filter(c => c.status === 'pending');
  const pendingApplications = applications.filter(a => a.status === 'pending');

  return (
    <>
      <SEO title="Admin Dashboard" />
      <div className="page container">
        <h1 className="section-title neon-text-pink">Admin Dashboard</h1>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          {(['overview', 'users', 'cashouts', 'applications', 'settings', 'audit', 'trivia', 'giftcards', 'coin-purchases'] as Tab[]).map((t) => (
            <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(t)} style={{ fontSize: 12, padding: '8px 16px' }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {loading && <p style={{ textAlign: 'center' }} className="neon-text-blue">Loading...</p>}
        {tab === 'overview' && !loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div className="card neon-border" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 32, fontWeight: 'bold', fontFamily: 'var(--font-display)' }}>{users.length}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Total Users</p>
            </div>
            <div className="card neon-border-pink" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 32, fontWeight: 'bold', fontFamily: 'var(--font-display)', color: '#ff00e5' }}>{pendingCashouts.length}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Pending Cashouts</p>
            </div>
            <div className="card neon-border-green" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 32, fontWeight: 'bold', fontFamily: 'var(--font-display)', color: '#39ff14' }}>${pendingCashouts.reduce((s, c) => s + c.requested_amount, 0).toFixed(2)}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Pending Amount</p>
            </div>
            <div className="card neon-border" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 32, fontWeight: 'bold', fontFamily: 'var(--font-display)', color: '#ffd740' }}>{pendingApplications.length}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Pending Applications</p>
            </div>
          </div>
        )}
        {tab === 'users' && !loading && (
          <div className="card neon-border">
            <input type="text" placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ marginBottom: 16 }} />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid #333366' }}>
                  <th style={{ padding: 12, textAlign: 'left' }}>Username</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>Email</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>Status</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>Actions</th>
                </tr></thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #1a1a2e' }}>
                      <td style={{ padding: 12 }}><a href={`/user/${u.id}`} style={{ color: 'var(--neon-blue)' }}>{u.username}</a></td>
                      <td style={{ padding: 12 }}>{u.email}</td>
                      <td style={{ padding: 12 }}><span style={{ color: u.frozen ? '#ff4444' : '#39ff14' }}>{u.frozen ? 'Frozen' : 'Active'}</span></td>
                      <td style={{ padding: 12 }}>
                        <button className="btn btn-outline" style={{ fontSize: 10, padding: '4px 12px' }} onClick={() => handleFreeze(u.id, !u.frozen)}>
                          {u.frozen ? 'Unfreeze' : 'Freeze'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'cashouts' && !loading && (
          <div className="card neon-border">
            {cashouts.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No cashout requests</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '1px solid #333366' }}>
                    <th style={{ padding: 12, textAlign: 'left' }}>User</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Amount</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>PayPal</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Status</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {cashouts.map((c) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #1a1a2e' }}>
                        <td style={{ padding: 12 }}>{c.user_id.slice(0, 8)}...</td>
                        <td style={{ padding: 12 }}>${c.requested_amount.toFixed(2)}</td>
                        <td style={{ padding: 12, fontSize: 12 }}>{c.paypal_email}</td>
                        <td style={{ padding: 12 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: c.status === 'pending' ? '#ffff0033' : c.status === 'approved' ? '#39ff1433' : c.status === 'paid' ? '#00f0ff33' : '#ff444433', color: c.status === 'pending' ? '#ffff00' : c.status === 'approved' ? '#39ff14' : c.status === 'paid' ? '#00f0ff' : '#ff4444' }}>
                            {c.status}
                          </span>
                        </td>
                         <td style={{ padding: 12 }}>
                           {c.status === 'approved' && (
                             <button className="btn btn-primary" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => handleCashoutAction(c.id, 'payout')}>Pay Out</button>
                           )}
                           {c.status === 'pending' && (
                             <div style={{ display: 'flex', gap: 4 }}>
                               <button className="btn btn-green" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => handleCashoutAction(c.id, 'approved')}>Approve</button>
                               <button className="btn" style={{ fontSize: 10, padding: '4px 8px', background: '#ff4444', color: '#fff' }} onClick={() => handleCashoutAction(c.id, 'denied')}>Deny</button>
                             </div>
                           )}
                           {c.status === 'paid' && (
                             <span style={{ fontSize: 11, color: 'var(--neon-green)' }}>✓ Paid</span>
                           )}
                         </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {tab === 'applications' && !loading && (
          <div className="card neon-border">
            {applications.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No applications yet</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '1px solid #333366' }}>
                    <th style={{ padding: 12, textAlign: 'left' }}>User</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>PayPal Email</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Status</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Submitted</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {applications.map((a) => (
                      <tr key={a.id} style={{ borderBottom: '1px solid #1a1a2e' }}>
                        <td style={{ padding: 12 }}>{a.user_id.slice(0, 8)}...</td>
                        <td style={{ padding: 12, fontSize: 12 }}>{a.paypal_email}</td>
                        <td style={{ padding: 12 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: a.status === 'pending' ? '#ffff0033' : a.status === 'approved' ? '#39ff1433' : '#ff444433', color: a.status === 'pending' ? '#ffff00' : a.status === 'approved' ? '#39ff14' : '#ff4444' }}>
                            {a.status}
                          </span>
                        </td>
                        <td style={{ padding: 12, fontSize: 12 }}>{new Date(a.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: 12 }}>
                          {a.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-green" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => handleApplicationAction(a.id, 'approved')}>Approve</button>
                              <button className="btn" style={{ fontSize: 10, padding: '4px 8px', background: '#ff4444', color: '#fff' }} onClick={() => handleApplicationAction(a.id, 'denied')}>Deny</button>
                            </div>
                          )}
                          {a.status !== 'pending' && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.reviewed_at ? new Date(a.reviewed_at).toLocaleDateString() : '—'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {tab === 'settings' && !loading && (
          <div className="card neon-border">
            <h2 style={{ marginBottom: 16 }}>Game Settings</h2>
{settings.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No settings configured yet.</p> : (
               settings.map((s: AdminGameSettings) => (
                <div key={s.id} style={{ padding: 16, background: '#0d0d2b', borderRadius: 8, marginBottom: 12 }}>
                  <h3 style={{ textTransform: 'capitalize', marginBottom: 12 }}>{s.game_type.replace(/_/g, ' ')}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Win Probability: {(s.win_probability * 100).toFixed(0)}%</label>
                      <input type="range" min="0" max="100" value={s.win_probability * 100} onChange={(e) => handleUpdateSetting(s.id, 'win_probability', parseInt(e.target.value) / 100)} style={{ padding: 0 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Max Daily Payout: ${s.max_daily_payout}</label>
                      <input type="number" value={s.max_daily_payout} onChange={(e) => handleUpdateSetting(s.id, 'max_daily_payout', parseFloat(e.target.value))} style={{ padding: '8px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Enabled</label>
                      <input type="checkbox" checked={s.is_enabled} onChange={(e) => handleUpdateSetting(s.id, 'is_enabled', e.target.checked)} style={{ width: 'auto' }} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        {tab === 'audit' && !loading && (
          <div className="card neon-border">
            <h2 style={{ marginBottom: 16 }}>Audit Logs</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Audit logs are recorded for all balance-changing actions.</p>
          </div>
        )}
        {tab === 'trivia' && !loading && <TriviaManager />}
        {tab === 'giftcards' && !loading && (
          <div className="card neon-border">
            <h2 style={{ marginBottom: 16 }}>Gift Card Redemptions</h2>
            {giftCards.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No gift card redemptions</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '1px solid #333366' }}>
                    <th style={{ padding: 12, textAlign: 'left' }}>User Email</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Amount</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Progress Used</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Status</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Date</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {giftCards.map((g) => (
                      <tr key={g.id} style={{ borderBottom: '1px solid #1a1a2e' }}>
                        <td style={{ padding: 12 }}>{g.email}</td>
                        <td style={{ padding: 12 }}>${g.amount_usd.toFixed(2)}</td>
                        <td style={{ padding: 12 }}>{g.gift_card_progress_used.toLocaleString()}</td>
                        <td style={{ padding: 12 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: g.status === 'pending' ? '#ffff0033' : g.status === 'approved' ? '#39ff1433' : g.status === 'sent' ? '#00f0ff33' : '#ff444433', color: g.status === 'pending' ? '#ffff00' : g.status === 'approved' ? '#39ff14' : g.status === 'sent' ? '#00f0ff' : '#ff4444' }}>
                            {g.status}
                          </span>
                        </td>
                        <td style={{ padding: 12, fontSize: 12 }}>{new Date(g.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: 12 }}>
                          {g.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              <button className="btn btn-green" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => handleGiftCardAction(g.id, 'approved')}>Approve</button>
                              <button className="btn" style={{ fontSize: 10, padding: '4px 8px', background: '#ff4444', color: '#fff' }} onClick={() => handleGiftCardAction(g.id, 'denied')}>Deny</button>
                              <button className="btn btn-primary" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => sendGiftCardEmail(g)}>Send Email</button>
                            </div>
                          )}
                          {g.status === 'approved' && (
                            <button className="btn btn-primary" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => sendGiftCardEmail(g)}>Send Email</button>
                          )}
                          {g.status === 'sent' && (
                            <span style={{ fontSize: 11, color: 'var(--neon-green)' }}>✓ Sent</span>
                          )}
                          {g.status === 'denied' && (
                            <span style={{ fontSize: 11, color: '#ff4444' }}>Denied</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {tab === 'coin-purchases' && !loading && (
          <div className="card neon-border">
            <h2 style={{ marginBottom: 16 }}>Coin Pack Purchases</h2>
            {coinPurchases.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No coin purchases yet</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '1px solid #333366' }}>
                    <th style={{ padding: 12, textAlign: 'left' }}>User</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Coins</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Price USD</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>PayPal Capture</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Status</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Date</th>
                  </tr></thead>
                  <tbody>
                    {coinPurchases.map((p) => (
                      <tr key={p.order_id} style={{ borderBottom: '1px solid #1a1a2e' }}>
                        <td style={{ padding: 12 }}>
                          {p.profile ? (
                            <a href={`/user/${p.user_id}`} style={{ color: 'var(--neon-blue)' }}>{p.profile.username}</a>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>{p.user_id.slice(0, 8)}...</span>
                          )}
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.profile?.email}</div>
                        </td>
                        <td style={{ padding: 12, fontWeight: 600 }}>{p.coins.toLocaleString()} 🪙</td>
                        <td style={{ padding: 12 }}>${p.price_usd.toFixed(2)}</td>
                        <td style={{ padding: 12, fontSize: 12, fontFamily: 'monospace' }}>{p.capture_id || '—'}</td>
                        <td style={{ padding: 12 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: p.status === 'captured' ? '#39ff1433' : p.status === 'pending' ? '#ffff0033' : p.status === 'cancelled' ? '#00f0ff33' : '#ff444433', color: p.status === 'captured' ? '#39ff14' : p.status === 'pending' ? '#ffff00' : p.status === 'cancelled' ? '#00f0ff' : '#ff4444' }}>
                            {p.status}
                          </span>
                        </td>
                        <td style={{ padding: 12, fontSize: 12 }}>{new Date(p.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function TriviaManager() {
  const [questions, setQuestions] = useState<{ id: string; question: string; options: string[]; correct_index: number; category: string }[]>([]);
  const [newQ, setNewQ] = useState({ question: '', options: ['', '', '', ''], correct_index: 0, category: 'general' });

  useEffect(() => { loadQuestions(); }, []);

  const loadQuestions = async () => {
    const { data } = await supabase.from('trivia_questions').select('*').limit(50);
    setQuestions(data || []);
  };

  const addQuestion = async () => {
    if (!newQ.question || newQ.options.some(o => !o)) return;
    await supabase.from('trivia_questions').insert(newQ);
    setNewQ({ question: '', options: ['', '', '', ''], correct_index: 0, category: 'general' });
    loadQuestions();
  };

  const deleteQuestion = async (id: string) => {
    await supabase.from('trivia_questions').delete().eq('id', id);
    loadQuestions();
  };

  return (
    <div className="card neon-border">
      <h2 style={{ marginBottom: 16 }}>Trivia Questions ({questions.length})</h2>
      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        <input placeholder="Question" value={newQ.question} onChange={(e) => setNewQ({ ...newQ, question: e.target.value })} />
        {newQ.options.map((opt, i) => (
          <input key={i} placeholder={`Option ${i + 1}`} value={opt} onChange={(e) => { const o = [...newQ.options]; o[i] = e.target.value; setNewQ({ ...newQ, options: o }); }} />
        ))}
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={newQ.correct_index} onChange={(e) => setNewQ({ ...newQ, correct_index: parseInt(e.target.value) })}>
            <option value={0}>Option 1 is correct</option>
            <option value={1}>Option 2 is correct</option>
            <option value={2}>Option 3 is correct</option>
            <option value={3}>Option 4 is correct</option>
          </select>
          <input placeholder="Category" value={newQ.category} onChange={(e) => setNewQ({ ...newQ, category: e.target.value })} style={{ maxWidth: 150 }} />
        </div>
        <button className="btn btn-primary" onClick={addQuestion}>Add Question</button>
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {questions.map((q) => (
          <div key={q.id} style={{ padding: 12, background: '#0d0d2b', borderRadius: 8, marginBottom: 8 }}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>{q.question}</p>
            <p style={{ fontSize: 12, color: '#39ff14' }}>Answer: {q.options[q.correct_index]}</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Category: {q.category}</p>
            <button className="btn" style={{ fontSize: 10, padding: '4px 8px', background: '#ff4444', color: '#fff', marginTop: 4 }} onClick={() => deleteQuestion(q.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
