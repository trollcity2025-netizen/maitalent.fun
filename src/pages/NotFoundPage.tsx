import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function NotFoundPage() {
  return (
    <div className="page container flex flex-col items-center justify-center text-center">
      <SEO title="404 — Page Not Found" />

      <h1
        className="neon-text-pink animate-flicker mb-4"
        style={{ fontSize: '8rem', fontFamily: 'var(--font-display)', lineHeight: 1 }}
      >
        404
      </h1>

      <h2
        className="mb-4 text-2xl font-bold text-[var(--text-primary)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Page Not Found
      </h2>

      <p className="mb-8 max-w-md text-[var(--text-secondary)]">
        Oops! The page you're looking for doesn't exist or has been moved. Let's get you back on track.
      </p>

      <Link to="/" className="btn btn-primary">
        Back to Home
      </Link>
    </div>
  );
}
