import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import { useState, useEffect } from 'react';
import { Menu, X, Coins, LogOut, Shield, Home, Gamepad2, ShoppingBag, CreditCard, LayoutDashboard, Wallet, Flame, Gift, Crown } from 'lucide-react';

export default function Navbar() {
  const { user, isAdmin, signOut } = useAuthStore();
  const wallet = useWalletStore((state) => state.wallet);
  const loadWallet = useWalletStore((state) => state.loadWallet);
  const hypeCoins = useWalletStore((state) => state.hypeCoins);
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (user?.id) loadWallet(user.id);
  }, [user?.id]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navLinks = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/games', label: 'Games', icon: Gamepad2 },
    { to: '/earn', label: 'Earn', icon: Gift },
    { to: '/daily-rewards', label: 'Daily', icon: Crown },
    { to: '/coin-store', label: 'Coin Store', icon: ShoppingBag },
    { to: '/mai-pay', label: 'MAI Pay', icon: CreditCard },
  ];

  const authLinks = user ? [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] : [];
  const adminLinks = isAdmin ? [{ to: '/admin', label: 'Admin', icon: Shield }] : [];
  const allLinks = [...navLinks, ...authLinks, ...adminLinks];
  const isActive = (path: string) => location.pathname === path;

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(10, 14, 39, 0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-magenta))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, color: 'var(--bg-primary)', fontSize: '1rem',
            boxShadow: '0 0 20px rgba(0, 229, 255, 0.3)',
          }}>M</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 800,
              letterSpacing: '0.04em', color: 'var(--text-primary)',
            }}>MAI TALENT</span>
            <span style={{
              fontSize: '0.6rem', letterSpacing: '0.12em',
              color: 'var(--accent-magenta)', fontWeight: 600,
              fontFamily: 'var(--font-display)',
            }}>.FUN</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav style={{ display: 'none', alignItems: 'center', gap: '4px' }} className="desktop-nav">
          {allLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem', fontWeight: 600,
                color: isActive(to) ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                background: isActive(to) ? 'rgba(0, 229, 255, 0.08)' : 'transparent',
                border: isActive(to) ? '1px solid rgba(0, 229, 255, 0.2)' : '1px solid transparent',
                transition: 'all 0.2s ease',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive(to)) {
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(to)) {
                  const path = e.currentTarget.getAttribute('href') || '';
                  const active = location.pathname === path;
                  e.currentTarget.style.color = active ? 'var(--accent-cyan)' : 'var(--text-secondary)';
                  e.currentTarget.style.background = active ? 'rgba(0, 229, 255, 0.08)' : 'transparent';
                }
              }}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop Right Section */}
        <div style={{ display: 'none', alignItems: 'center', gap: '10px' }} className="desktop-actions">
          {user && wallet && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '6px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Coins size={14} style={{ color: '#ffd740' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffd740' }}>
                  {wallet.coin_balance.toLocaleString()}
                </span>
              </div>
              <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                  {wallet.token_balance.toLocaleString()}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Tokens</span>
              </div>
              <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Wallet size={14} style={{ color: 'var(--accent-gold)' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
                  ${(wallet.cash_balance ?? wallet.total_won ?? 0).toFixed(2)}
                </span>
              </div>
              <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Flame size={14} style={{ color: 'var(--accent-magenta)' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-magenta)' }}>
                  {hypeCoins}
                </span>
              </div>
            </div>
          )}

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Link to="/profile" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                {user.username || user.email || 'Profile'}
              </Link>
              <button onClick={handleSignOut} className="btn btn-outline btn-sm" style={{ gap: '6px' }}>
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-sm" style={{ textDecoration: 'none' }}>Sign In</Link>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          className="mobile-toggle"
          style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '8px' }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="mobile-menu" style={{
          borderTop: '1px solid var(--border-subtle)',
          background: 'rgba(10, 14, 39, 0.98)',
          backdropFilter: 'blur(20px)',
          padding: '16px',
        }}>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
            {allLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem', fontWeight: 600,
                  color: isActive(to) ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  background: isActive(to) ? 'rgba(0, 229, 255, 0.08)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={17} />
                {label}
              </Link>
            ))}
          </nav>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
            {user && wallet && (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: '8px',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                marginBottom: '12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Coins</span>
                  <span style={{ color: '#ffd740', fontWeight: 700 }}>{wallet.coin_balance.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Tokens</span>
                  <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{wallet.token_balance.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Cash</span>
                  <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>${(wallet.cash_balance ?? wallet.total_won ?? 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Hype</span>
                  <span style={{ color: 'var(--accent-magenta)', fontWeight: 700 }}>{hypeCoins}</span>
                </div>
              </div>
            )}

            {user ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Link to="/profile" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                  {user.username || user.email || 'Profile'}
                </Link>
                <button onClick={handleSignOut} className="btn btn-outline" style={{ width: '100%', gap: '8px' }}>
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn" style={{ width: '100%', textAlign: 'center', textDecoration: 'none' }}>
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Responsive overrides */}
      <style>{`
        @media (min-width: 769px) {
          .desktop-nav { display: flex !important; }
          .desktop-actions { display: flex !important; }
          .mobile-toggle { display: none !important; }
        }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .desktop-actions { display: none !important; }
          .mobile-toggle { display: block !important; }
        }
      `}</style>
    </header>
  );
}
