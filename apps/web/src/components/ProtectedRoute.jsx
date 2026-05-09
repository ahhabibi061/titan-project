import { Navigate } from 'react-router-dom';
import { useSession } from '../hooks/useSession';

// Full-screen loader shown while the session check resolves (< 200ms in practice)
function LoadingScreen() {
  return (
    <div
      style={{ background: '#0a0908', minHeight: '100vh' }}
      className="flex items-center justify-center"
    >
      <div className="flex flex-col items-center gap-3">
        <span
          style={{
            fontFamily: 'Anton, sans-serif',
            fontSize: 28,
            letterSpacing: 4,
            color: '#ed7a2a',
          }}
        >
          IRONLAB
        </span>
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(237,122,42,0.4)', borderTopColor: '#ed7a2a' }}
        />
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  const { session, loading } = useSession();

  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/auth" replace />;

  return children;
}
