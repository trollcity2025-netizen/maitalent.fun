import SEO from '../components/SEO';
import { Link } from 'react-router-dom';

const sections = [
  {
    title: 'Daily & Weekly Play Limits',
    icon: '⏱️',
    content: `MaiTalent.fun enforces daily and weekly play limits to help you stay in control. By default, users are limited to a set number of game sessions per day and per week. You can view and adjust your personal limits in your account settings. Once a limit is reached, you will be unable to start new game sessions until the next period begins.`,
  },
  {
    title: 'Self-Exclusion Options',
    icon: '🚫',
    content: `If you feel the need to take a break, MaiTalent.fun offers self-exclusion options. You can choose to exclude yourself from gameplay for periods of 7 days, 30 days, 90 days, or permanently. During the exclusion period, you will not be able to access any games on the platform. Self-exclusion can be activated from your account settings or by contacting our support team. Permanent exclusions cannot be reversed.`,
  },
  {
    title: 'Cooling-Off Periods',
    icon: '❄️',
    content: `Need a short break? Our cooling-off feature lets you temporarily pause your gameplay for 24 hours, 48 hours, or 72 hours. During a cooling-off period, you can still browse the platform and view your transaction history, but you won't be able to play games or make purchases. Cooling-off periods begin immediately upon activation and cannot be shortened once started.`,
  },
  {
    title: 'Resources for Help',
    icon: '📞',
    content: `If you or someone you know has a gambling problem, help is available. The National Council on Problem Gambling provides 24/7 confidential support:`,
    extra: (
      <div className="mt-4 rounded-lg border border-[var(--neon-green)]/30 bg-[var(--neon-green)]/5 p-4 text-center">
        <p className="text-lg font-bold text-[var(--neon-green)]" style={{ fontFamily: 'var(--font-display)' }}>
          1-800-522-4700
        </p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          National Council on Problem Gambling — 24/7 Helpline
        </p>
        <a
          href="https://www.ncpgambling.org"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-[var(--neon-blue)] underline hover:no-underline"
        >
          www.ncpgambling.org
        </a>
      </div>
    ),
  },
  {
    title: 'Our Commitment to Responsible Gaming',
    icon: '💚',
    content: `MaiTalent.fun is designed as a free-to-play sweepstakes platform. No purchase is ever necessary to participate. We believe gaming should be fun, safe, and accessible. We are committed to: providing transparent odds for every game; offering free entry paths for all promotions; enforcing play limits and self-exclusion tools; monitoring for signs of problematic play patterns; and never targeting vulnerable populations in our marketing. If you have concerns about your play or our platform, please don't hesitate to reach out to our support team.`,
  },
];

export default function ResponsiblePlayPage() {
  return (
    <div className="page container">
      <SEO title="Responsible Play" />

      <h1 className="section-title neon-text-green" style={{ fontFamily: 'var(--font-display)' }}>
        Responsible Play
      </h1>

      <p className="mx-auto mb-10 max-w-2xl text-center text-[var(--text-secondary)]">
        Your well-being matters to us. MaiTalent.fun provides tools and resources to help you play responsibly.
      </p>

      <div className="mx-auto max-w-3xl space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="card neon-border-green">
            <h2 className="mb-3 flex items-center gap-3 text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              <span className="text-2xl">{section.icon}</span>
              {section.title}
            </h2>
            <p className="leading-relaxed text-[var(--text-secondary)]">{section.content}</p>
            {section.extra}
          </div>
        ))}

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link to="/rules" className="btn btn-outline">
            View Terms & Rules
          </Link>
          <Link to="/" className="btn btn-primary">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
