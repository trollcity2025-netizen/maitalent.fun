import SEO from '../components/SEO';
import { Link } from 'react-router-dom';

const sections = [
  {
    title: 'No Purchase Necessary',
    icon: '🆓',
    content: `MaiTalent.fun is a free-to-play sweepstakes platform. No purchase or payment of any kind is required to enter or win. Every user receives free tokens upon registration and through daily bonuses, which can be used to play any game on the platform. Purchasing coins is entirely optional and does not increase your chances of winning.`,
  },
  {
    title: 'Sweepstakes Rules',
    icon: '🎰',
    content: `MaiTalent.fun operates as a sweepstakes promotion, not gambling. All games use certified random number generators (RNG) to determine outcomes. Prizes are awarded based on chance, not skill. This promotion is void where prohibited by law. Odds of winning vary by game and are displayed within each game before play. Sweepstakes entries (tokens) have no cash value and cannot be redeemed for cash directly — only prizes won through gameplay may be eligible for cashout.`,
  },
  {
    title: 'Eligibility',
    icon: '✅',
    content: `You must be at least 18 years of age and a legal resident of the United States to participate. Employees, officers, and directors of MaiTalent.fun, their immediate family members, and those living in the same household are not eligible. By using this platform, you represent and warrant that you meet all eligibility requirements. Additional state-specific restrictions may apply.`,
  },
  {
    title: 'Responsible Play',
    icon: '🛡️',
    content: `We are committed to responsible gaming. MaiTalent.fun provides tools to help you manage your play, including daily and weekly play limits, self-exclusion options, and cooling-off periods. We encourage all users to set personal limits and take breaks. If you feel your play is becoming problematic, please visit our Responsible Play page or contact the National Council on Problem Gambling at 1-800-522-4700.`,
  },
  {
    title: 'Privacy & Data',
    icon: '🔒',
    content: `We respect your privacy. Personal information collected during registration and gameplay is used solely to operate the platform, process cashouts, and comply with legal obligations. We do not sell your personal data to third parties. Game sessions may be logged with IP addresses and device information to prevent fraud and ensure fair play. For full details, please review our Privacy Policy.`,
  },
];

export default function TermsPage() {
  return (
    <div className="page container">
      <SEO title="Terms & Rules" />

      <h1 className="section-title neon-text-blue" style={{ fontFamily: 'var(--font-display)' }}>
        Terms & Rules
      </h1>

      <p className="mx-auto mb-10 max-w-2xl text-center text-[var(--text-secondary)]">
        Please read these terms carefully before using MaiTalent.fun. By using the platform, you agree to these rules.
      </p>

      <div className="mx-auto max-w-3xl space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="card neon-border">
            <h2 className="mb-3 flex items-center gap-3 text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              <span className="text-2xl">{section.icon}</span>
              {section.title}
            </h2>
            <p className="leading-relaxed text-[var(--text-secondary)]">{section.content}</p>
          </div>
        ))}

        <div className="mt-8 text-center">
          <Link to="/responsible-play" className="btn btn-outline">
            View Responsible Play Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
