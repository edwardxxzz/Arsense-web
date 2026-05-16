import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import logoImg from '../assets/logo.png';
import googleImg from '../assets/google.png';

export default function Login() {
  const navigate = useNavigate();
  const {
    googlePendingData, clearGooglePending, completeCompanySetup,
    cancelCompanySetup, user, startRegistration, finishRegistration,
    empresaId, loading: authLoading
  } = useAuth();
  const [activeTab, setActiveTab] = useState('login');

  const effectiveTab = googlePendingData ? 'cadastro' : activeTab;

  useEffect(() => {
    if (user && empresaId && !googlePendingData) {
      navigate('/home');
    }
  }, [user, empresaId, googlePendingData, navigate]);

  const isGoogleSignup = !!googlePendingData;

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [erroLogin, setErroLogin] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Cadastro Passo 1
  const [step, setStep] = useState(1);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regCompanyError, setRegCompanyError] = useState('');

  // Cadastro Passo 2
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regTerms, setRegTerms] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  // Recuperação
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  // Google
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  useEffect(() => {
    if (googlePendingData) {
      setRegName(googlePendingData.displayName || '');
      setRegEmail(googlePendingData.email || '');
      setStep(1);
    }
  }, [googlePendingData]);

  // Validações login
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail);
  const podeLogar = emailValido && loginPassword.length >= 8 && !loginLoading;

  // Validações cadastro passo 1
  const nomeValido = regName.trim().length >= 2;
  const emailCorpValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail);
  const empresaValida = /^[a-zA-ZÀ-ÿ0-9\s]+$/.test(regCompany) && regCompany.trim().length > 0;

  const handleCompanyChange = (e) => {
    const val = e.target.value;
    if (/^[a-zA-ZÀ-ÿ0-9\s]*$/.test(val)) {
      setRegCompany(val);
      setRegCompanyError('');
    } else {
      setRegCompanyError('Não é permitido usar caracteres especiais no nome da empresa');
    }
  };
  const podeContinuar = emailCorpValido && nomeValido && empresaValida;

  // Validações cadastro passo 2
  const senhaForte = regPassword.length >= 8;
  const senhasIguais = regPassword === regConfirmPassword;
  const erroConfirmacao = regConfirmPassword.length > 0 && !senhasIguais;
  const podeCriarConta = senhaForte && senhasIguais && regTerms && !regLoading;

  // ✅ CORRIGIDO: trata o caso em que o email só tem Google vinculado
  const handleLogin = async (e) => {
    e.preventDefault();
    setErroLogin(false);
    setGoogleError('');
    if (!podeLogar) return;
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (error) {
      if (
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/user-not-found'
      ) {
        // Verifica se o email está vinculado apenas ao Google
        try {
          const methods = await fetchSignInMethodsForEmail(auth, loginEmail);
          if (methods.includes('google.com') && !methods.includes('password')) {
            setGoogleError('Este e-mail está vinculado ao Google. Use o botão "Entrar com o Google".');
            setLoginLoading(false);
            return;
          }
        } catch (_) {
          // Se a verificação falhar, mostra erro genérico
        }
      }
      setErroLogin(true);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterStep1 = (e) => {
    e.preventDefault();
    if (podeContinuar) setStep(2);
  };

  const handleRegisterStep2 = async (e) => {
    e.preventDefault();
    if (!podeCriarConta) return;

    setRegLoading(true);
    try {
      if (isGoogleSignup) {
        await completeCompanySetup(regCompany, regPassword, regName);
        navigate('/home');
      } else {
        startRegistration();

        const userCredential = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
        const uid = userCredential.user.uid;
        const nomeEmpresa = regCompany;

        await setDoc(doc(db, 'empresas', nomeEmpresa), {
          nome: nomeEmpresa,
          criadoEm: new Date().toISOString(),
        }, { merge: true });

        await setDoc(doc(db, 'empresas', nomeEmpresa, 'usuarios', uid), {
          dataLogin: new Date().toISOString(),
          email: regEmail,
          emailLowercase: regEmail.toLowerCase().trim(),
          senha: 'Gerenciada pelo Firebase Auth',
          userId: uid,
          userName: regName,
          authProvider: 'password',
        });

        await setDoc(doc(db, 'empresas', nomeEmpresa, 'centrais', 'macRPI'), {
          ip_local: '',
          nome: '',
          online: false,
        });

        await setDoc(doc(db, 'empresas', nomeEmpresa, 'ambientes', 'ambiente_1'), {
          config: { andar: '', area: '', nome: '', tipo: '' },
          dados: { central_id: 'central 1', criadoEM: new Date().toISOString(), nome: 'ambiente 1', receptor_id: 'receptor1' },
          sensores: { iluminação: 0, presenca: false, temperatura: 0, umidade: 0 },
        }, { merge: true });

        await setDoc(doc(db, 'empresas', nomeEmpresa, 'ambientes', 'ambiente_1', 'historico', 'registro_inicial'), {
          co2: 0, qualidade_ar: 100, temperatura: 0, umidade: 0,
          timestamp: new Date().toISOString(), luminosidade: 0, presenca: 0,
        });

        await setDoc(doc(db, 'empresas', nomeEmpresa, 'ambientes', 'ambiente_1', 'perifericos', 'ar_condicionado'), {
          geral: { ligado: false, marca: '', modelo: '', temperatura: 24 },
        });

        await setDoc(doc(db, 'empresas', nomeEmpresa, 'ambientes', 'ambiente_1', 'agendamentos', 'registro_inicial'), {
          timestamp: new Date().toISOString(), status: 'inicializado', observacao: 'Registro inicial',
        });

        // Alertas
        await setDoc(doc(db, 'empresas', nomeEmpresa, 'alertas', 'inicial'), {
          criadoEm: new Date().toISOString(),
          nome: 'inicial',
        });

        await addDoc(collection(db, 'empresas', nomeEmpresa, 'historico_geral'), {
          co2_medio: 0,
          hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          indice_conforto: 0, qual_do_ar: 0, temperatura_media: 0,
          timestamp: Date.now(), luminosidade: 0, presenca: 0,
        });

        finishRegistration(nomeEmpresa, {
          dataLogin: new Date().toISOString(),
          email: regEmail,
          emailLowercase: regEmail.toLowerCase().trim(),
          userId: uid,
          userName: regName,
          authProvider: 'password',
          docId: uid,
        });

        navigate('/home');
      }
    } catch (error) {
      alert('Erro ao criar conta: ' + error.message);
    } finally {
      setRegLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setGoogleError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // onAuthStateChanged no AuthContext resolve tudo automaticamente
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') {
        // Usuário fechou o popup — sem mensagem de erro
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        setGoogleError('Já existe uma conta com este email. Entre com email e senha.');
      } else {
        setGoogleError('Erro ao entrar com Google. Tente novamente.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleCancel = () => {
    cancelCompanySetup();
    setRegName('');
    setRegEmail('');
    setRegCompany('');
    setRegPassword('');
    setRegConfirmPassword('');
    setRegTerms(false);
    setStep(1);
  };

  const handleRecovery = async (e) => {
    e.preventDefault();
    try {
      await sendPasswordResetEmail(auth, recoveryEmail);
      setRecoverySuccess(true);
    } catch (error) {
      alert('Email não encontrado ou inválido');
    }
  };

  const switchTab = (tab) => {
    if (isGoogleSignup) return;
    setActiveTab(tab);
    if (tab === 'cadastro') setStep(1);
  };

  return (
    <div className="bg-gradient">
      <div className="main-container">
        <header className="header">
          <img src={logoImg} alt="Logo @rsense" className="logo-img" />
        </header>

        {/* ============ TAB: ENTRAR ============ */}
        {effectiveTab === 'login' && (
          <main className="form-wrapper">
            <nav className="form-tabs">
              <button className="tab-item active">Entrar</button>
              <button className="tab-item" onClick={() => switchTab('cadastro')}>Cadastrar</button>
              <button className="tab-item" onClick={() => switchTab('recuperar')}>Recuperar</button>
            </nav>

            <section className="form-section">
              <h1 className="form-title">Bem-vindo de volta</h1>
              <p className="form-subtitle">Entre na sua conta para continuar</p>

              {erroLogin && (
                <p className="error-text" style={{ textAlign: 'center', marginBottom: '10px' }}>
                  Usuário ou senha incorretos
                </p>
              )}

              <form className="form" onSubmit={handleLogin}>
                <div className="input-group">
                  <label htmlFor="email">Email</label>
                  <div className={`input-container ${(!emailValido && loginEmail.length > 0) || erroLogin ? 'error-border' : ''}`}>
                    <input
                      type="email"
                      id="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={e => { setLoginEmail(e.target.value); setErroLogin(false); setGoogleError(''); }}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <div className="label-with-link">
                    <label htmlFor="password">Senha</label>
                    <span
                      className="forgot-password-link"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setActiveTab('recuperar')}
                    >
                      Esqueceu a senha?
                    </span>
                  </div>
                  <div className={`input-container password-input-container ${erroLogin ? 'error-border' : ''}`}>
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      id="password"
                      placeholder="●●●●●●"
                      value={loginPassword}
                      onChange={e => { setLoginPassword(e.target.value); setErroLogin(false); setGoogleError(''); }}
                      required
                    />
                    <span className="password-icon" onClick={() => setShowLoginPassword(!showLoginPassword)}>
                      {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </span>
                  </div>
                </div>

                <div className="input-checkbox">
                  <input type="checkbox" id="keepConnected" />
                  <label htmlFor="keepConnected">Manter conectado</label>
                </div>

                <button type="submit" className="btn btn-primary" disabled={!podeLogar}>
                  {loginLoading ? 'Entrando...' : 'Entrar →'}
                </button>
              </form>

              {googleError && (
                <p className="error-text" style={{ textAlign: 'center', marginBottom: '10px' }}>
                  {googleError}
                </p>
              )}

              <div className="separator"><span>ou continue com</span></div>
              <button
                type="button"
                className="btn btn-social-google"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
              >
                <img src={googleImg} alt="Google" style={{ width: 20, height: 20 }} />
                {googleLoading ? 'Entrando...' : 'Entrar com o Google'}
              </button>
            </section>
          </main>
        )}

        {/* ============ TAB: CADASTRO ============ */}
        {effectiveTab === 'cadastro' && (
          <main className="form-wrapper">
            <nav className="form-tabs">
              <button className="tab-item" onClick={() => switchTab('login')}>Entrar</button>
              <button className="tab-item active">Cadastrar</button>
              <button className="tab-item" onClick={() => switchTab('recuperar')}>Recuperar</button>
            </nav>

            <section className="form-section">
              <h1 className="form-title">Criar sua conta</h1>
              <p className="form-subtitle">
                {isGoogleSignup
                  ? 'Complete seu cadastro com os dados da empresa'
                  : 'Preencha seus dados para começar'}
              </p>

              {isGoogleSignup && (
                <div style={{ textAlign: 'center', marginBottom: 16, padding: '10px', backgroundColor: '#F0F4FF', borderRadius: 8, fontSize: 13, color: '#374151' }}>
                  Conta Google autenticada: <strong>{googlePendingData?.email}</strong>
                </div>
              )}

              <div className={`progress-indicator ${step === 2 ? 'step-2' : ''}`}>
                <div className={`circle ${step >= 1 ? 'active' : ''}`}>1</div>
                <div className="progress-line"></div>
                <div className={`circle ${step === 2 ? 'active' : ''}`}>2</div>
              </div>

              {step === 1 ? (
                <form className="form" onSubmit={handleRegisterStep1}>
                  <div className="input-group">
                    <label htmlFor="fullName">Nome Completo</label>
                    <div className={`input-container ${!nomeValido && regName.length > 0 ? 'error-border' : ''}`}>
                      <input
                        type="text"
                        id="fullName"
                        placeholder="Seu nome"
                        value={regName}
                        onChange={e => setRegName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label htmlFor="corporateEmail">Email Corporativo</label>
                    <div className={`input-container ${!emailCorpValido && regEmail.length > 0 ? 'error-border' : ''}`}>
                      <input
                        type="email"
                        id="corporateEmail"
                        placeholder="seu@empresa.com"
                        value={regEmail}
                        onChange={e => setRegEmail(e.target.value)}
                        disabled={isGoogleSignup}
                        style={isGoogleSignup ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label htmlFor="companyName">Empresa (sem caracteres especiais)</label>
                    <div className={`input-container ${(!empresaValida && regCompany.length > 0) || regCompanyError ? 'error-border' : ''}`}>
                      <input
                        type="text"
                        id="companyName"
                        placeholder="Nome da empresa"
                        value={regCompany}
                        onChange={handleCompanyChange}
                      />
                    </div>
                    {regCompanyError && (
                      <p className="error-text" style={{ marginTop: 4, fontSize: 12 }}>{regCompanyError}</p>
                    )}
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={!podeContinuar}>
                    Continuar →
                  </button>
                </form>
              ) : (
                <form className="form" onSubmit={handleRegisterStep2}>
                  <div className="input-group">
                    <label htmlFor="password">Senha</label>
                    <div className={`input-container password-input-container ${!senhaForte && regPassword.length > 0 ? 'error-border' : ''}`}>
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        id="password"
                        placeholder="Mínimo 8 caracteres"
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        required
                      />
                      <span className="password-icon" onClick={() => setShowRegPassword(!showRegPassword)}>
                        {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </span>
                    </div>
                  </div>
                  <p className="password-hint">Use letras maiúsculas, minúsculas, números e símbolos</p>

                  <div className="input-group">
                    <label htmlFor="confirmPassword">Confirma Senha</label>
                    <div className={`input-container password-input-container ${erroConfirmacao ? 'error-border' : ''}`}>
                      <input
                        type={showRegConfirmPassword ? 'text' : 'password'}
                        id="confirmPassword"
                        placeholder="Digite novamente"
                        value={regConfirmPassword}
                        onChange={e => setRegConfirmPassword(e.target.value)}
                        required
                      />
                      <span className="password-icon" onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}>
                        {showRegConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </span>
                    </div>
                  </div>

                  <div className="input-checkbox">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={regTerms}
                      onChange={e => setRegTerms(e.target.checked)}
                      required
                    />
                    <label htmlFor="terms">Concordo com os Termos de Uso e Política de Privacidade</label>
                  </div>

                  <div className="btn-group">
                    <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                      Voltar
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={!podeCriarConta}>
                      {regLoading ? 'Criando...' : 'Criar conta →'}
                    </button>
                  </div>
                </form>
              )}

              {isGoogleSignup && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={handleGoogleCancel}
                    style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Cancelar e voltar ao login
                  </button>
                </div>
              )}
            </section>
          </main>
        )}

        {/* ============ TAB: RECUPERAR ============ */}
        {effectiveTab === 'recuperar' && (
          <main className="form-wrapper">
            <nav className="form-tabs">
              <button className="tab-item" onClick={() => setActiveTab('login')}>Entrar</button>
              <button className="tab-item" onClick={() => setActiveTab('cadastro')}>Cadastrar</button>
              <button className="tab-item active">Recuperar</button>
            </nav>

            <section className="form-section">
              <h1 className="form-title">Esqueceu sua senha?</h1>
              <p className="form-subtitle">Digite seu email e enviaremos instruções para redefinir sua senha.</p>

              {recoverySuccess ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p style={{ color: '#22C55E', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                    Email de recuperação enviado!
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() => { setActiveTab('login'); setRecoverySuccess(false); }}
                  >
                    Voltar ao Login
                  </button>
                </div>
              ) : (
                <form className="form" onSubmit={handleRecovery}>
                  <div className="input-group">
                    <label htmlFor="recoverEmail">Email</label>
                    <div className="input-container">
                      <input
                        type="email"
                        id="recoverEmail"
                        placeholder="seu@email.com"
                        value={recoveryEmail}
                        onChange={e => setRecoveryEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary">
                    Enviar link de recuperação →
                  </button>
                </form>
              )}
            </section>
          </main>
        )}
      </div>
    </div>
  );
}