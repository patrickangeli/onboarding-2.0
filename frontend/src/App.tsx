import { useState, useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { HRDashboard } from './pages/HRDashboard';
import { CandidateApp } from './pages/CandidateApp';

export type AuthUser = {
  id: string;
  name: string;
  role: 'ADMIN' | 'HR' | 'PARTNER';
  company?: { id: string; name: string };
};

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [mode, setMode] = useState<'hr' | 'candidate'>('hr');

  useEffect(() => {
    const stored = sessionStorage.getItem('authUser');
    if (stored) setAuthUser(JSON.parse(stored));
    if (window.location.hash === '#candidato') setMode('candidate');
  }, []);

  const handleLogin = (user: AuthUser, token: string) => {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('authUser', JSON.stringify(user));
    setAuthUser(user);
  };

  const handleLogout = () => {
    sessionStorage.clear();
    setAuthUser(null);
  };

  if (mode === 'candidate') {
    return <CandidateApp onBack={() => setMode('hr')} />;
  }

  if (!authUser) {
    return <LoginPage onLogin={handleLogin} onCandidateAccess={() => setMode('candidate')} />;
  }

  return <HRDashboard user={authUser} onLogout={handleLogout} />;
}
