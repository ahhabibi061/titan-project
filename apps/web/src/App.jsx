import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useProfile } from './hooks/useProfile';
import ProtectedRoute from './components/ProtectedRoute';

// Runs inside BrowserRouter so useSession's auth listener is active.
// Fetches the profile once and writes it to the global Zustand store.
function ProfileBootstrap() {
  useProfile();
  return null;
}
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import LoggerPage from './pages/LoggerPage';
import NutritionPage from './pages/NutritionPage';
import ExercisesPage from './pages/ExercisesPage';
import BiometricsPage from './pages/BiometricsPage';
import CoachPage from './pages/CoachPage';
import SettingsPage from './pages/SettingsPage';
import TutorialOverlay from './components/TutorialOverlay';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ProfileBootstrap />
        <TutorialOverlay />
        <Routes>
          {/* Public */}
          <Route path="/auth" element={<AuthPage />} />

          {/* Protected — require active Supabase session */}
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
          <Route path="/dashboard"  element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/logger"     element={<ProtectedRoute><LoggerPage /></ProtectedRoute>} />
          <Route path="/nutrition"  element={<ProtectedRoute><NutritionPage /></ProtectedRoute>} />
          <Route path="/exercises"  element={<ProtectedRoute><ExercisesPage /></ProtectedRoute>} />
          <Route path="/biometrics" element={<ProtectedRoute><BiometricsPage /></ProtectedRoute>} />
          <Route path="/coach"      element={<ProtectedRoute><CoachPage /></ProtectedRoute>} />
          <Route path="/settings"   element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

          {/* Catch-all → auth */}
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
