import { Link, useLocation } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useProfileStore } from '../store/useProfileStore';

const NAV_LINKS = [
  { label: 'Home',       path: '/dashboard'  },
  { label: 'Forge',      path: '/logger'     },
  { label: 'Sentinel',   path: '/nutrition'  },
  { label: 'Biometrics', path: '/biometrics' },
  { label: 'Codex',      path: '/exercises'  },
  { label: 'Oracle',     path: '/coach'      },
];

function getInitials(displayName, email) {
  if (displayName?.trim()) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
}

export default function AppNav() {
  const { pathname } = useLocation();
  const { session }  = useSession();
  const profile      = useProfileStore(s => s.profile);
  const initials     = getInitials(profile?.display_name, session?.user?.email);

  return (
    <nav className="border-b border-stone-800/60 bg-stone-950/40 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link
            to="/dashboard"
            className="font-anton text-2xl uppercase tracking-tight text-stone-100 no-underline"
            style={{ fontFamily: 'Anton, sans-serif' }}
          >
            <span className="text-orange-500">▲</span> IRONLAB
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(m => (
              <Link
                key={m.path}
                to={m.path}
                className={`px-3 py-1.5 text-xs uppercase tracking-wider font-mono transition-colors no-underline ${
                  pathname === m.path
                    ? 'text-orange-300 bg-orange-500/10 border border-orange-500/30'
                    : 'text-stone-500 hover:text-stone-200 border border-transparent hover:border-stone-700'
                }`}
              >
                {m.label}
              </Link>
            ))}
          </div>
        </div>
        <Link
          to="/settings"
          title="Settings"
          className="w-7 h-7 rounded-full flex items-center justify-center font-anton text-xs text-stone-950 shrink-0 hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #fbbf24, #ff5a2a)' }}
        >
          {initials}
        </Link>
      </div>
    </nav>
  );
}
