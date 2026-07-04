import type { ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';

interface PublicViewProps {
  children: ReactNode;
  showPrompt?: boolean;
}

export default function PublicView({ children, showPrompt = true }: PublicViewProps) {
  const { user } = useAuthStore();

  return (
    <>
      {children}
      {!user && showPrompt && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-pink-500/30 bg-black/95 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <p className="text-sm text-gray-300">
              <span className="font-bold text-pink-400">Sign in</span> to play games and earn rewards!
            </p>
            <div className="flex gap-2">
              <Link
                to="/login"
                className="rounded-lg bg-gradient-to-r from-pink-500 to-blue-500 px-4 py-2 text-sm font-bold text-white"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="rounded-lg border border-pink-500/50 px-4 py-2 text-sm font-bold text-pink-400"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
