import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('login');

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register Step 1
  const [step, setStep] = useState(1);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCompany, setRegCompany] = useState('');

  // Register Step 2
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regTerms, setRegTerms] = useState(false);
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Recovery
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');

  const getPasswordStrength = (pwd) => {
    if (!pwd) return 0;
    let strength = 0;
    if (pwd.length >= 6) strength++;
    if (pwd.length >= 8) strength++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) strength++;
    return strength;
  };

  const strengthColors = ['#EF4444', '#F59E0B', '#3B82F6', '#22C55E'];

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      navigate('/home');
    } catch (error) {
      setLoginError('Email ou senha incorretos');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');

    if (step === 1) {
      if (!regName || !regEmail || !regCompany) {
        setRegError('Preencha todos os campos');
        return;
      }
      setStep(2);
      return;
    }

    // Step 2
    if (!regPassword || !regConfirmPassword) {
      setRegError('Preencha todos os campos');
      return;
    }
    if (regPassword.length < 8) {
      setRegError('A senha deve ter no mínimo 8 caracteres');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('As senhas não coincidem');
      return;
    }
    if (!regTerms) {
      setRegError('Aceite os termos para continuar');
      return;
    }

    setRegLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      const uid = userCredential.user.uid;

      // Sanitize company name for document ID
      const safeCompany = regCompany.replace(/[.#$\[\]]/g, '_');
      const empresaDoc = doc(db, 'empresas', safeCompany);
      const empresaExists = await getDoc(empresaDoc);

      if (!empresaExists.exists()) {
        // Create new company
        await setDoc(empresaDoc, {
          nome: regCompany,
          criadoEm: new Date().toISOString(),
        });

        // Create default central
        await setDoc(doc(db, 'empresas', safeCompany, 'centrais', 'macRPI'), {
          ip_local: '',
          nome: 'Central 1',
          online: false,
        });

        // Create initial history
        await addDoc(collection(db, 'empresas', safeCompany, 'historico_geral'), {
          timestamp: Date.now(),
          hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          indice_conforto: 75,
          luminosidade: 0,
          qual_do_ar: 50,
          temperatura_media: 24,
          umidade_media: 50,
        });

        // Create default environment
        await setDoc(doc(db, 'empresas', safeCompany, 'ambientes', 'ambiente_1'), {
          tipo: 'Escritório',
          area: '50',
          capacidade: '10',
          andar: '1º Andar',
          dados: {
            centralid: 'central1',
            criadoEm: new Date().toISOString(),
            nome: 'Ambiente 1',
            receptor_id: 'receptor1',
          },
          config: {
            tipo: 'Escritório',
            area: '50',
            capacidade: '10',
            andar: '1º Andar',
          },
          sensores: {
            temperatura: 24,
            umidade: 50,
            luminosidade: 300,
            AQI: 50,
          },
        });

        // Create default AC peripheral
        await setDoc(doc(db, 'empresas', safeCompany, 'ambientes', 'ambiente_1', 'perifericos', 'ar_condicionado'), {
          geral: {
            ligado: false,
            marca: '',
            modelo: '',
            temperatura: 24,
          },
        });

        // Create agendamentos subcollection
        await setDoc(doc(db, 'empresas', safeCompany, 'ambientes', 'ambiente_1', 'agendamentos', 'registro_inicial'), {
          timestamp: new Date().toISOString(),
          status: 'inicializado',
          observacao: 'Registro inicial do sistema',
        });

        // Create initial history for ambiente
        await addDoc(collection(db, 'empresas', safeCompany, 'ambientes', 'ambiente_1', 'historico'), {
          timestamp: new Date().toISOString(),
          temperatura: 24,
          umidade: 50,
          luminosidade: 300,
          indice_conforto: 75,
          co2: 400,
          presenca: 0,
          qualidade_ar: 50,
        });
      }

      // Create user document
      await setDoc(doc(db, 'empresas', safeCompany, 'usuarios', uid), {
        email: regEmail,
        userName: regName,
        userId: uid,
        telefone: '',
        localizacao: '',
        senha: 'Gerenciada pelo Firebase Auth',
        dataLogin: new Date().toISOString(),
        dataAtualizacao: new Date().toISOString(),
      });

      navigate('/home');
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        setRegError('Este email já está em uso');
      } else {
        setRegError('Erro ao criar conta. Tente novamente.');
      }
    }
    setRegLoading(false);
  };

  const handleRecovery = async (e) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoverySuccess(false);
    try {
      await sendPasswordResetEmail(auth, recoveryEmail);
      setRecoverySuccess(true);
    } catch (error) {
      setRecoveryError('Email não encontrado ou inválido');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)',
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 440,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 16 }}>
          <svg width="48" height="48" viewBox="0 0 36 36" fill="none" style={{ marginBottom: 8 }}>
            <circle cx="18" cy="18" r="18" fill="#2563EB"/>
            <path d="M10 18L16 12L22 18L16 24Z" fill="white"/>
            <path d="M16 12L22 18L28 12" stroke="white" strokeWidth="2" fill="none"/>
          </svg>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1E293B' }}>Arsense</h1>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', margin: '0 32px' }}>
          {['login', 'cadastro', 'recuperar'].map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setStep(1); setLoginError(''); setRegError(''); }}
              style={{
                flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid #2563EB' : '2px solid transparent',
                color: activeTab === tab ? '#2563EB' : '#64748B', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              {tab === 'login' ? 'Entrar' : tab === 'cadastro' ? 'Cadastrar' : 'Recuperar'}
            </button>
          ))}
        </div>

        <div style={{ padding: '24px 32px 32px' }}>
          {/* LOGIN */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Email</label>
                <input
                  className={`input-field ${loginError ? 'error' : ''}`}
                  type="email"
                  placeholder="seu@email.com"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Senha</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className={`input-field ${loginError ? 'error' : ''}`}
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="Sua senha"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
                  >
                    {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {loginError && <p style={{ fontSize: 13, color: '#EF4444', marginBottom: 12 }}>{loginError}</p>}

              <div style={{ textAlign: 'right', marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('recuperar')}
                  style={{ background: 'none', border: 'none', color: '#0097B2', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
                >
                  Esqueceu a senha?
                </button>
              </div>

              <button
                type="submit"
                style={{
                  width: '100%', padding: '12px 0', border: 'none', borderRadius: 10,
                  background: 'linear-gradient(to right, #0097B2, #2B58E2)',
                  color: 'white', fontSize: 16, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Entrar
              </button>
            </form>
          )}

          {/* CADASTRO */}
          {activeTab === 'cadastro' && (
            <form onSubmit={handleRegister}>
              {/* Stepper */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: step >= 1 ? '#2563EB' : '#E2E8F0', color: step >= 1 ? 'white' : '#94A3B8',
                  fontSize: 14, fontWeight: 700,
                }}>1</div>
                <div style={{ width: 40, height: 2, backgroundColor: step >= 2 ? '#2563EB' : '#E2E8F0' }} />
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: step >= 2 ? '#2563EB' : '#E2E8F0', color: step >= 2 ? 'white' : '#94A3B8',
                  fontSize: 14, fontWeight: 700,
                }}>2</div>
              </div>

              {step === 1 && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Nome Completo</label>
                    <input className="input-field" placeholder="Seu nome completo" value={regName} onChange={e => setRegName(e.target.value)} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Email Corporativo</label>
                    <input className="input-field" type="email" placeholder="empresa@email.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Nome da Empresa</label>
                    <input className="input-field" placeholder="Nome da empresa" value={regCompany} onChange={e => setRegCompany(e.target.value)} />
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Senha</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="input-field"
                        type={showRegPassword ? 'text' : 'password'}
                        placeholder="Mínimo 8 caracteres"
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        style={{ paddingRight: 44 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
                      >
                        {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {/* Password strength */}
                    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{
                          height: 4, flex: 1, borderRadius: 2,
                          backgroundColor: i <= getPasswordStrength(regPassword) ? strengthColors[getPasswordStrength(regPassword) - 1] : '#E2E8F0',
                        }} />
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Confirmar Senha</label>
                    <input className="input-field" type="password" placeholder="Confirme a senha" value={regConfirmPassword} onChange={e => setRegConfirmPassword(e.target.value)} />
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
                    <input type="checkbox" checked={regTerms} onChange={e => setRegTerms(e.target.checked)} style={{ accentColor: '#2563EB' }} />
                    <span style={{ fontSize: 13, color: '#64748B' }}>Aceito os <a href="#" style={{ color: '#0097B2' }}>termos de uso</a> e <a href="#" style={{ color: '#0097B2' }}>política de privacidade</a></span>
                  </label>
                </>
              )}

              {regError && <p style={{ fontSize: 13, color: '#EF4444', marginBottom: 12 }}>{regError}</p>}

              <div style={{ display: 'flex', gap: 12 }}>
                {step === 2 && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-secondary"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Voltar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={regLoading}
                  style={{
                    flex: 1, padding: '12px 0', border: 'none', borderRadius: 10,
                    background: 'linear-gradient(to right, #0097B2, #2B58E2)',
                    color: 'white', fontSize: 16, fontWeight: 600, cursor: regLoading ? 'not-allowed' : 'pointer',
                    opacity: regLoading ? 0.7 : 1,
                  }}
                >
                  {regLoading ? 'Criando...' : step === 1 ? 'Próximo' : 'Criar Conta'}
                </button>
              </div>
            </form>
          )}

          {/* RECUPERAÇÃO */}
          {activeTab === 'recuperar' && (
            <form onSubmit={handleRecovery}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6, display: 'block' }}>Email</label>
                <input
                  className="input-field"
                  type="email"
                  placeholder="seu@email.com"
                  value={recoveryEmail}
                  onChange={e => setRecoveryEmail(e.target.value)}
                />
              </div>

              {recoveryError && <p style={{ fontSize: 13, color: '#EF4444', marginBottom: 12 }}>{recoveryError}</p>}
              {recoverySuccess && <p style={{ fontSize: 13, color: '#22C55E', marginBottom: 12 }}>Email de recuperação enviado! Verifique sua caixa de entrada.</p>}

              <button
                type="submit"
                style={{
                  width: '100%', padding: '12px 0', border: 'none', borderRadius: 10,
                  background: 'linear-gradient(to right, #0097B2, #2B58E2)',
                  color: 'white', fontSize: 16, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Enviar Link de Recuperação
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('login'); setRecoverySuccess(false); }}
                style={{ width: '100%', marginTop: 12, padding: '12px 0', border: '1px solid #E2E8F0', borderRadius: 10, background: 'white', color: '#64748B', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
              >
                Voltar ao Login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
