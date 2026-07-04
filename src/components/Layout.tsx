import { Outlet, Link } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <Navbar />
      <main style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        <Outlet />
      </main>
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'rgba(10, 14, 39, 0.8)',
        backdropFilter: 'blur(16px)',
        padding: '32px 0',
        position: 'relative',
        zIndex: 1,
      }}>
        <div className="container">
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 800,
                letterSpacing: '0.06em', color: 'var(--text-muted)',
              }}>MAI TALENT .FUN</span>
              <span style={{
                display: 'block', marginTop: '4px',
                fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.6,
              }}>© 2026 All rights reserved</span>
            </div>

            <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
              <Link to="/terms" style={{
                fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'none',
                transition: 'color 0.2s',
              }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-cyan)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                Terms of Service
              </Link>
              <Link to="/responsible-play" style={{
                fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'none',
                transition: 'color 0.2s',
              }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-cyan)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                Responsible Play
              </Link>
              <span style={{
                fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.5,
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
                padding: '4px 8px',
              }}>No Purchase Necessary</span>
            </nav>
          </div>

          <div style={{
            marginTop: '20px', paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            textAlign: 'center',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            opacity: 0.6,
          }}>
            MaiTalent.fun is a skill-based entertainment platform. Void where prohibited. Must be 18+ to participate.
          </div>
        </div>
      </footer>
    </div>
  );
}