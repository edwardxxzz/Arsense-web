import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Ambientes from './pages/Ambientes';
import Ambiente from './pages/Ambiente';
import Perifericos from './pages/Perifericos';
import Alertas from './pages/Alertas';
import Relatorios from './pages/Relatorios';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import DadosPessoais from './components/DadosPessoais';
import { useState } from 'react';

function AppLayout() {
  const { user, loading } = useAuth();
  const [showProfile, setShowProfile] = useState(false);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
        <div style={{ textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 36 36" fill="none" style={{ marginBottom: 16 }}>
            <circle cx="18" cy="18" r="18" fill="#2563EB"/>
            <path d="M10 18L16 12L22 18L16 24Z" fill="white"/>
            <path d="M16 12L22 18L28 12" stroke="white" strokeWidth="2" fill="none"/>
          </svg>
          <p style={{ color: '#64748B', fontSize: 14 }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Sidebar />
      <div className="main-content">
        <TopHeader onOpenProfile={() => setShowProfile(true)} />
        <Routes>
          <Route path="/home" element={<Dashboard />} />
          <Route path="/ambientes" element={<Ambientes />} />
          <Route path="/ambiente" element={<Ambiente />} />
          <Route path="/perifericos" element={<Perifericos />} />
          <Route path="/alertas" element={<Alertas />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </div>

      {showProfile && <DadosPessoais onClose={() => setShowProfile(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppLayout />
    </AuthProvider>
  );
}
