import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { LoginPage, OnboardingPage } from './pages/AuthPages';
import { HomePage } from './pages/HomePage';
import { PracticePage } from './pages/PracticePage';
import { MyListPage } from './pages/MyListPage';
import { ProgressPage } from './pages/ProgressPage';
import { SettingsPage } from './pages/SettingsPage';
import { KnownWordsPage } from './pages/KnownWordsPage';
import { SessionDetailPage } from './pages/SessionDetailPage';
import { useEffect } from 'react';
import { checkLocalReminder } from './lib/session';
import { useTranslation } from 'react-i18next';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, userData, loading } = useApp();
  const { t } = useTranslation();

  if (loading) return <div className="loading-screen">{t('loading')}</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (userData && !userData.profile.onboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useApp();

  useEffect(() => {
    checkLocalReminder();
    const interval = setInterval(checkLocalReminder, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="loading-screen">...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/onboarding" element={user ? <OnboardingPage /> : <Navigate to="/login" replace />} />
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/practice/:type" element={<ProtectedRoute><PracticePage /></ProtectedRoute>} />
      <Route path="/mylist" element={<ProtectedRoute><MyListPage /></ProtectedRoute>} />
      <Route path="/known" element={<ProtectedRoute><KnownWordsPage /></ProtectedRoute>} />
      <Route path="/progress" element={<ProtectedRoute><ProgressPage /></ProtectedRoute>} />
      <Route path="/progress/session/:sessionId" element={<ProtectedRoute><SessionDetailPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
