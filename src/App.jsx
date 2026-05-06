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

function CompleteRegistration() {
  const { user, completeCompanySetup, cancelCompanySetup } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [companyError, setCompanyError] = useState('');
  const [loading, setLoading] = useState(false);

  const empresaValida = /^[a-zA-ZÀ-ÿ0-9\s]+$/.test(companyName) && companyName.trim().length > 0;

  const handleCompanyChange = (e) => {
    const val = e.target.value;
    if (/^[a-zA-ZÀ-ÿ0-9\s]*$/.test(val)) {
      setCompanyName(val);
      setCompanyError('');
    } else {
      setCompanyError('Não é permitido usar caracteres especiais no nome da empresa');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!empresaValida) return;
    setLoading(true);
    try {
      await completeCompanySetup(companyName);
    } catch (error) {
      alert('Erro ao criar empresa: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient">
      <div className="main-container">
        <header className="header">
          <svg width="200" height="60" viewBox="0 0 200 60" fill="none">
            <rect width="200" height="60" rx="8" fill="transparent"/>
          </svg>
        </header>
        <main className="form-wrapper">
          <nav className="form-tabs">
            <button className="tab-item active">Completar Cadastro</button>
          </nav>
          <section className="form-section">
            <h1 className="form-title">Completar seu cadastro</h1>
            <p className="form-subtitle">Sua conta Google foi autenticada. Agora, cadastre sua empresa.</p>

            <div style={{ textAlign: 'center', marginBottom: 20, padding: '12px', backgroundColor: '#F0F4FF', borderRadius: 8 }}>
              <p style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>
                <strong>Conta Google:</strong> {user?.email}
              </p>
              <p style={{ fontSize: 14, color: '#374151' }}>
                <strong>Nome:</strong> {user?.displayName || user?.email?.split('@')[0]}
              </p>
            </div>

            <form className="form" onSubmit={handleSubmit}>
              <div className="input-group">
                <label htmlFor="setupCompany">Nome da Empresa (sem caracteres especiais)</label>
                <div className={`input-container ${(!empresaValida && companyName.length > 0) || companyError ? 'error-border' : ''}`}>
                  <input
                    type="text"
                    id="setupCompany"
                    placeholder="Nome da empresa"
                    value={companyName}
                    onChange={handleCompanyChange}
                    autoFocus
                  />
                </div>
                {companyError && <p className="error-text" style={{ marginTop: 4, fontSize: 12 }}>{companyError}</p>}
              </div>

              <div className="btn-group">
                <button type="button" className="btn btn-secondary" onClick={cancelCompanySetup}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={!empresaValida || loading}>
                  {loading ? 'Criando...' : 'Criar conta →'}
                </button>
              </div>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}

function AppLayout() {
  const { user, empresaId, loading, needsCompanySetup } = useAuth();
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

  // Sem usuário autenticado → mostrar login
  if (!user) {
    return <Login />;
  }

  // Usuário autenticado mas sem empresa → mostrar formulário de completar cadastro
  if (needsCompanySetup || !empresaId) {
    return <CompleteRegistration />;
  }

  // Usuário autenticado com empresa → mostrar dashboard
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
