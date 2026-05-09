import { Link, useLocation } from 'react-router-dom';

const NAV_LINKS = [
  { label: 'Home',       path: '/dashboard'  },
  { label: 'IRONLAB',    path: '/logger'     },
  { label: 'Sentinel',   path: '/nutrition'  },
  { label: 'Biometrics', path: '/biometrics' },
  { label: 'Codex',      path: '/exercises'  },
  { label: 'Oracle',     path: '/coach'      },
];

export default function AppNav() {
  const { pathname } = useLocation();

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
          className="w-8 h-8 flex items-center justify-center text-stone-500 hover:text-orange-400 border border-transparent hover:border-stone-700 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="8" cy="8" r="2.5" />
            <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" />
          </svg>
        </Link>
      </div>
    </nav>
  );
}
