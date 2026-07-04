import { Link } from 'react-router-dom';
import { Coins, Zap, Gift, Trophy, Clock, Star, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';

const games = [
  {
    id: 'mai-coin-flip',
    name: 'Coin Flip',
    tagline: 'Classic 50/50',
    description: 'Call it — heads or tails? A timeless game with a neon twist.',
    emoji: '🪙',
    color: '#00e5ff',
    accent: '#2979ff',
    icon: Coins,
  },
  {
    id: 'mai-treasure-hunt',
    name: 'Treasure Hunt',
    tagline: 'Pick Your Chest',
    description: 'Find the hidden reward among the chests. Every choice matters.',
    emoji: '🏴‍☠️',
    color: '#ff2d95',
    accent: '#c0186e',
    icon: Gift,
  },
  {
    id: 'mai-lucky-spin',
    name: 'Lucky Spin',
    tagline: 'Spin & Win',
    description: 'Spin the wheel of fortune and claim your prize.',
    emoji: '🎡',
    color: '#00e676',
    accent: '#00b359',
    icon: Zap,
  },
  {
    id: 'mai-card-pick',
    name: 'Card Pick',
    tagline: 'Choose Wisely',
    description: 'Pick the right card from the deck for a big payout.',
    emoji: '🃏',
    color: '#7c4dff',
    accent: '#651fff',
    icon: Star,
  },
  {
    id: 'mai-ladder-climb',
    name: 'Ladder Climb',
    tagline: 'Risk It All',
    description: 'Climb the ladder round by round. Cash out or challenge the next step.',
    emoji: '🪜',
    color: '#ff9100',
    accent: '#e65100',
    icon: Trophy,
  },
];

export default function GameLobbyPage() {
  return (
    <div className="page">
      <SEO title="Game Lobby" description="Choose your game and start playing at MaiTalent.fun." />

      <div className="container">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div className="badge card-glass" style={{ marginBottom: '16px', display: 'inline-flex' }}>
            <Clock size={12} style={{ color: 'var(--accent-cyan)' }} />
            Available Now
          </div>
          <h1 className="section-title" style={{
            fontSize: 'clamp(1.6rem, 4vw, 2.5rem)',
            marginBottom: '12px',
          }}>
            Game <span className="text-gradient">Lobby</span>
          </h1>
          <p style={{
            color: 'var(--text-secondary)', fontSize: '1rem',
            maxWidth: '520px', margin: '0 auto', lineHeight: 1.6,
          }}>
            Choose your game and start playing. Every game is free to enter — no purchase necessary.
          </p>
        </div>

        {/* Games Grid */}
        <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {games.map((game) => (
            <Link key={game.id} to={`/games/${game.id}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
              <div className="card" style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                border: '1px solid rgba(255,255,255,0.06)',
                padding: '28px 22px',
                transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${game.color}55`;
                  e.currentTarget.style.background = 'var(--bg-card-hover)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = `0 0 40px ${game.color}18`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.background = 'var(--bg-card)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Game header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: 'var(--radius-sm)',
                    background: `linear-gradient(135deg, ${game.color}22, ${game.accent}18)`,
                    border: `1px solid ${game.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <game.icon size={20} color={game.color} />
                  </div>
                  <span className="badge" style={{
                    background: `${game.color}12`,
                    border: `1px solid ${game.color}30`,
                    color: game.color,
                    fontSize: '0.6rem',
                  }}>
                    {game.tagline}
                  </span>
                </div>

                {/* Emoji */}
                <div className="animate-float" style={{
                  fontSize: '2.8rem', textAlign: 'center',
                  margin: '8px 0 16px',
                }}>{game.emoji}</div>

                {/* Text */}
                <h2 style={{
                  fontSize: '1.05rem', fontWeight: 800, marginBottom: '6px',
                  fontFamily: 'var(--font-display)', textAlign: 'center',
                }}>{game.name}</h2>
                <p style={{
                  color: 'var(--text-secondary)', fontSize: '0.85rem',
                  lineHeight: 1.6, textAlign: 'center', flex: 1,
                  marginBottom: '20px',
                }}>{game.description}</p>

                {/* CTA */}
                <div style={{
                  marginTop: 'auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  width: '100%', padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${game.color}40`,
                  background: `${game.color}12`,
                  color: game.color,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontFamily: 'var(--font-display)',
                  transition: 'all 0.2s ease',
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = game.color;
                    e.currentTarget.style.color = 'var(--bg-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `${game.color}12`;
                    e.currentTarget.style.color = game.color;
                  }}
                >
                  <span>Play Now</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
