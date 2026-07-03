import { Link } from 'react-router-dom';
import { TrendingUp, Wallet, Gamepad2, Shield, Zap, Users, Trophy, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';

const steps = [
  {
    icon: Wallet,
    title: 'Claim Your Free Tokens',
    desc: 'Create an account and receive free tokens to start playing — no purchase necessary.',
  },
  {
    icon: Gamepad2,
    title: 'Pick a Game',
    desc: 'Choose from five original Mai games: Coin Flip, Treasure Hunt, Lucky Spin, Card Pick, and Ladder Climb.',
  },
  {
    icon: TrendingUp,
    title: 'Play & Cash Out',
    desc: 'Win Troll Coins and tokens. Cash out via PayPal starting at just $5 minimum.',
  },
];

const gameHighlights = [
  { id: 'mai-coin-flip', name: 'Coin Flip', emoji: '🪙', color: '#00e5ff', desc: 'Call it — heads or tails? A classic 50/50 with a neon twist.' },
  { id: 'mai-treasure-hunt', name: 'Treasure Hunt', emoji: '🏴‍☠️', color: '#ff2d95', desc: 'Pick the right chest and uncover hidden rewards. Choose wisely!' },
  { id: 'mai-lucky-spin', name: 'Lucky Spin', emoji: '🎡', color: '#00e676', desc: 'Spin the wheel and let fate decide your prize.' },
  { id: 'mai-card-pick', name: 'Card Pick', emoji: '🃏', color: '#7c4dff', desc: 'Pick the right card for a shot at big rewards.' },
  { id: 'mai-ladder-climb', name: 'Ladder Climb', emoji: '🪜', color: '#ff9100', desc: 'Climb round by round. Cash out or risk it all.' },
];

const stats = [
  { label: '5 Unique Games', value: 'Original', icon: Gamepad2 },
  { label: '$5 Min Cashout', value: 'Low Barrier', icon: Wallet },
  { label: '99.8% Payout', value: 'Fair Play', icon: Shield },
  { label: 'Instant Play', value: '24 / 7', icon: Zap },
];

export default function LandingPage() {
  return (
    <div>
      <SEO
        title="MaiTalent.fun — Arcade Rewards Platform"
        description="Play original arcade games, earn Troll Coins, and cash out via PayPal. Five unique games, $5 minimum cashout."
        keywords="arcade games, rewards, Troll Coins, PayPal cashout, gaming platform"
      />

      {/* HERO */}
      <section className="section" style={{ paddingTop: '96px', paddingBottom: '72px', textAlign: 'center' }}>
        <div className="bg-atmosphere" />
        <div className="container">
          <div style={{ maxWidth: '820px', margin: '0 auto' }}>
            <div className="badge card-glass" style={{ marginBottom: '24px', display: 'inline-flex' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 10px var(--accent-green)' }} />
              Skill-based arcade rewards platform
            </div>

            <h1 style={{
              fontSize: 'clamp(2.4rem, 6vw, 4.5rem)',
              fontWeight: 900,
              marginBottom: '24px',
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
            }}>
              <span className="text-gradient">PLAY.</span>{' '}
              <span style={{ color: 'var(--text-primary)' }}>WIN.</span>{' '}
              <span className="text-gradient">CASH OUT.</span>
            </h1>

            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '1.2rem',
              lineHeight: 1.7,
              maxWidth: '560px',
              margin: '0 auto 40px',
            }}>
              Five original Mai games, real rewards, and instant PayPal payouts.
              No purchase necessary to play — tokens are on us.
            </p>

            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/games" className="btn btn-lg btn-primary">
                <Gamepad2 size={18} />
                Start Playing
              </Link>
              <Link to="/coin-store" className="btn btn-lg btn-outline">
                Get Troll Coins
                <ArrowRight size={16} />
              </Link>
            </div>

            {/* Stats row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '16px',
              marginTop: '64px',
              padding: '28px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-surface)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--border-subtle)',
            }}>
              {stats.map((stat) => (
                <div key={stat.label} style={{ textAlign: 'center' }}>
                  <stat.icon size={20} style={{ color: 'var(--accent-cyan)', marginBottom: '8px' }} />
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {stat.value}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 className="section-title text-gradient">How It Works</h2>
            <p className="section-subtitle">Get started in three simple steps.</p>
          </div>

          <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {steps.map((step, i) => (
              <div key={step.title} className="card" style={{ textAlign: 'center', position: 'relative' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                  boxShadow: '0 0 20px rgba(0, 229, 255, 0.3)',
                }}>
                  <step.icon size={22} color="#0a0e27" />
                </div>
                <div style={{
                  position: 'absolute', top: '12px', right: '16px',
                  fontFamily: 'var(--font-display)', fontSize: '0.65rem',
                  color: 'var(--text-muted)', fontWeight: 700,
                }}>0{i + 1}</div>
                <h3 style={{ fontSize: '1rem', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>{step.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED GAMES */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 className="section-title">Featured <span className="text-gradient">Games</span></h2>
            <p className="section-subtitle">Five original games. One arcade. Endless fun.</p>
          </div>

          <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {gameHighlights.map((game) => (
              <Link key={game.id} to={`/games/${game.id}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div className="card" style={{
                  textAlign: 'center',
                  borderColor: `${game.color}44`,
                  transition: 'all 0.3s ease',
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = game.color;
                    e.currentTarget.style.boxShadow = `0 0 30px ${game.color}33`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = `${game.color}44`;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div className="animate-float" style={{ fontSize: '3rem', marginBottom: '12px' }}>{game.emoji}</div>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '6px', fontFamily: 'var(--font-display)' }}>{game.name}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>{game.desc}</p>
                </div>
              </Link>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <Link to="/games" className="btn btn-primary">
              View All Games
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 className="section-title">Why <span className="text-gradient">MaiTalent.fun</span></h2>
            <p className="section-subtitle">Built for fair play, fast payouts, and maximum fun.</p>
          </div>

          <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {[
              { icon: Wallet, title: 'Low Minimum Cashout', desc: '$5 is all you need. Get paid fast via PayPal.', color: 'var(--accent-cyan)' },
              { icon: Shield, title: 'Fair & Transparent', desc: 'Provably fair outcomes. Real results, no tricks.', color: 'var(--accent-green)' },
              { icon: Zap, title: 'Instant Rewards', desc: 'Winnings hit your account immediately after each round.', color: 'var(--accent-orange)' },
              { icon: Users, title: 'No Purchase Necessary', desc: 'Entry tokens are free. Play as much as you want.', color: 'var(--accent-purple)' },
              { icon: TrendingUp, title: 'Multiple Reward Types', desc: 'Cash, gift cards, bonus tokens, and free turns.', color: 'var(--accent-magenta)' },
              { icon: Trophy, title: 'Skill-Based Play', desc: 'Your choices determine your fate. No luck required.', color: 'var(--accent-cyan)' },
            ].map((feature) => (
              <div key={feature.title} className="card" style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{
                  flexShrink: 0,
                  width: '40px', height: '40px', borderRadius: 'var(--radius-sm)',
                  background: `${feature.color}18`,
                  border: `1px solid ${feature.color}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <feature.icon size={20} color={feature.color} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '4px', fontFamily: 'var(--font-display)' }}>{feature.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="section" style={{ textAlign: 'center' }}>
        <div className="container">
          <div style={{
            maxWidth: '720px', margin: '0 auto', padding: '56px 32px',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.08), rgba(124, 77, 255, 0.08), rgba(255, 45, 149, 0.06))',
            border: '1px solid var(--border-glow)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(circle at 30% 50%, rgba(0, 229, 255, 0.1), transparent 50%)',
              pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative' }}>
              <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.5rem)', marginBottom: '16px', fontWeight: 900 }}>
                Ready to <span className="text-gradient">Play?</span>
              </h2>
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: '1.1rem',
                lineHeight: 1.6,
                marginBottom: '32px',
                maxWidth: '480px',
                margin: '0 auto 32px',
              }}>
                Claim your free tokens and start winning real rewards today.
              </p>
              <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/games" className="btn btn-lg btn-primary">
                  <Gamepad2 size={18} />
                  Play Now
                </Link>
                <Link to="/coin-store" className="btn btn-lg btn-magenta">
                  Get Coins
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
