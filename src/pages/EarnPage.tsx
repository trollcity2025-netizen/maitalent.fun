import SEO from '../components/SEO';

const earnMethods = [
  {
    title: '🎥 Start a Broadcast',
    reward: '+10 Tokens',
    description:
      'Start a live broadcast on MaiTrollCity.com to begin earning tokens.',
  },
  {
    title: '⏱ Broadcast for 1 Hour',
    reward: '+20 Tokens',
    description:
      'Stay live for at least one hour to receive an additional token reward.',
  },
  {
    title: '🔥 Broadcast for 4 Hours',
    reward: '+40 Tokens',
    description:
      'Complete four hours of broadcasting to unlock a larger reward. Maximum broadcast rewards are limited to 80 tokens per day.',
  },
  {
    title: '👀 Watch Live Broadcasts',
    reward: '+10 Tokens',
    description:
      'Watch live broadcasts on MaiTrollCity.com and earn 10 tokens for each eligible broadcast. Daily limit: 40 tokens.',
  },
  {
    title: '📤 Share Your Link',
    reward: '+10 Tokens',
    description:
      'Share your unique MaiTrollCity referral link. If the shared link remains active after one hour, youll receive your reward.',
  },
];

export default function EarnPage() {
  return (
    <>
      <SEO
        title="Earn Tokens"
        description="Earn free MaiTalent.fun tokens through MaiTrollCity.com."
      />

      <div className="page container" style={{ maxWidth: 1100 }}>
        <div
          className="card neon-border"
          style={{
            textAlign: 'center',
            padding: 40,
            marginBottom: 30,
          }}
        >
          <h1 className="section-title neon-text-blue">
            Earn More Tokens
          </h1>

          <p
            style={{
              color: 'var(--text-secondary)',
              maxWidth: 700,
              margin: '16px auto',
              lineHeight: 1.7,
            }}
          >
            Need more tokens for MaiTalent.fun? Visit
            <strong> MaiTrollCity.com </strong>
            to earn free tokens by broadcasting, watching live streams, and
            sharing your unique link. Once you've earned rewards, you'll receive
            a secure promo card that can be redeemed here.
          </p>

          <a
            href="https://maitrollcity.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{
              textDecoration: 'none',
              display: 'inline-block',
              marginTop: 12,
            }}
          >
            Go to MaiTrollCity.com
          </a>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 20,
            gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
          }}
        >
          {earnMethods.map((item) => (
            <div
              key={item.title}
              className="card neon-border"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <h3 style={{ margin: 0 }}>{item.title}</h3>

              <div
                style={{
                  fontWeight: 700,
                  color: 'var(--primary)',
                  fontSize: '1.1rem',
                }}
              >
                {item.reward}
              </div>

              <p
                style={{
                  margin: 0,
                  color: 'var(--text-secondary)',
                  flex: 1,
                }}
              >
                {item.description}
              </p>
            </div>
          ))}
        </div>

        <div
          className="card neon-border"
          style={{
            marginTop: 30,
            padding: 24,
          }}
        >
          <h2>Daily Limits</h2>

          <ul style={{ lineHeight: 2 }}>
            <li>Broadcast rewards: Maximum 80 tokens per day.</li>
            <li>Viewing rewards: Maximum 40 tokens per day.</li>
            <li>Promo cards are issued every 4 hours.</li>
            <li>Maximum of 4 promo cards can be earned each day.</li>
          </ul>
        </div>

        <div
          className="card neon-border"
          style={{
            marginTop: 24,
            padding: 24,
          }}
        >
          <h2>How It Works</h2>

          <ol style={{ lineHeight: 2 }}>
            <li>Visit MaiTrollCity.com.</li>
            <li>Complete eligible earning activities.</li>
            <li>Receive your unique promo card.</li>
            <li>Redeem the promo card on MaiTalent.fun.</li>
            <li>Your tokens are added after validation.</li>
          </ol>
        </div>

        <div
          className="card"
          style={{
            marginTop: 24,
            border: '1px solid #f59e0b',
            background: 'rgba(245,158,11,.08)',
          }}
        >
          <strong>Important</strong>

          <p
            style={{
              marginTop: 10,
              color: 'var(--text-secondary)',
            }}
          >
            Promo cards are unique to each user and cannot be copied, shared,
            reused, or redeemed multiple times. Tokens are only granted after
            MaiTrollCity.com verifies that the earning activity is valid.
          </p>
        </div>
      </div>
    </>
  );
}