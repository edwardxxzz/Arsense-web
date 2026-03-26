import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore'; 

function CadastroPasso2({ setTelaAtual, cadastroData }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const senhasIguais = password === confirmPassword;
  const senhaForte = password.length >= 8;
  const erroConfirmacao = confirmPassword.length > 0 && !senhasIguais;

  const podeCriarConta = senhaForte && senhasIguais && termsAccepted && !loading;

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!podeCriarConta) return;

    setLoading(true);
    try {
      // 1. Cria usuário na Autenticação do Firebase
      const userCredential = await createUserWithEmailAndPassword(auth, cadastroData.corporateEmail, password);
      const user = userCredential.user;

      const nomeEmpresa = cadastroData.companyName;

      // 2. Raiz: empresas > {nomeEmpresa}
      const empresaRef = doc(db, "empresas", nomeEmpresa);
      await setDoc(empresaRef, {
        nome: nomeEmpresa,
        criadoEm: new Date().toISOString()
      }, { merge: true }); 

      // 3. Usuários 
      const userRef = doc(db, "empresas", nomeEmpresa, "usuarios", user.uid);
      await setDoc(userRef, {
        dataLogin: new Date().toISOString(),
        email: cadastroData.corporateEmail,
        senha: "Gerenciada pelo Firebase Auth", 
        userId: user.uid,
        userName: cadastroData.fullName
      });

      // 4. Centrais 
      const centralRef = doc(db, "empresas", nomeEmpresa, "centrais", "macRPI");
      await setDoc(centralRef, {
        ip_local: "",
        nome: "",
        online: false
      });

      // 5. Ambientes
      const nomeSala = "ambiente_1"; 
      const ambienteRef = doc(db, "empresas", nomeEmpresa, "ambientes", nomeSala);
      await setDoc(ambienteRef, {
        config: {
          andar: "",
          area: "",
          nome: "",
          tipo: ""
        },
        dados: {
          central_id: "central 1",
          criadoEM: new Date().toISOString(),
          nome: "ambiente 1",
          receptor_id: "receptor1"
        },
        sensores: {
          iluminação: 0, 
          presenca: false, 
          temperatura: 0,
          umidade: 0
        }
      }, { merge: true });

      // 5.1. Subcoleção 'historico' dentro de ambiente_1
      const historicoAmbienteRef = doc(db, "empresas", nomeEmpresa, "ambientes", nomeSala, "historico", "registro_inicial");
      await setDoc(historicoAmbienteRef, {
        co2: 0,
        qualidade_ar: 100,
        temperatura: 0,
        umidade: 0,
        timestamp: new Date().toISOString(),
        luminosidade: 0,
        presenca: 0
      });

      // 5.2. Subcoleção 'perifericos' dentro de ambiente_1 (AJUSTADO AQUI!)
      // Agora tem o Map "geral" com as exatas características do seu print.
      const perifericosRef = doc(db, "empresas", nomeEmpresa, "ambientes", nomeSala, "perifericos", "ar_condicionado");
      await setDoc(perifericosRef, {
        geral: {
          ligado: false,
          marca: "",
          modelo: "",
          temperatura: 24
        }
      });

      // 6. Histórico Geral
      const historicoGeralRef = collection(db, "empresas", nomeEmpresa, "historico_geral");
      await addDoc(historicoGeralRef, {
        co2_medio: 0,
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        indice_conforto: 0,
        qual_do_ar: 0,
        temperatura_media: 0,
        timestamp: Date.now(),
        luminosidade: 0,
        presenca: 0
      });

      // Sucesso!
      setTelaAtual('dashboard');
    } catch (error) {
      console.error(error);
      alert('Erro ao criar conta: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);

  return (
    <main className="form-wrapper">
      <nav className="form-tabs">
        <button className="tab-item" onClick={() => setTelaAtual('login')}>Entrar</button>
        <button className="tab-item active">Cadastrar</button>
        <button className="tab-item" onClick={() => setTelaAtual('recuperar')}>Recuperar</button>
      </nav>

      <section className="form-section">
        <h1 className="form-title">Criar sua conta</h1>
        <p className="form-subtitle">Preencha seus dados para começar</p>
        <div className="progress-indicator step-2">
          <div className="circle complete">1</div>
          <div className="progress-line"></div>
          <div className="circle active">2</div>
        </div>
        <form className="form" onSubmit={handleCreateAccount}>
          <div className="input-group">
            <label htmlFor="password">Senha</label>
            <div className={`input-container password-input-container ${!senhaForte && password.length > 0 ? 'error-border' : ''}`}>
              <input 
                type={showPassword ? "text" : "password"} 
                id="password" 
                placeholder="Mínimo 8 caracteres" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
              <span className="password-icon" onClick={togglePasswordVisibility}>
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>
          </div>
          <p className="password-hint">Use letras maiúsculas, minúsculas, números e símbolos</p>
          <div className="input-group">
            <label htmlFor="confirmPassword">Confirma Senha</label>
            <div className={`input-container password-input-container ${erroConfirmacao ? 'error-border' : ''}`}>
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                id="confirmPassword" 
                placeholder="Digite novamente" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                required 
              />
              <span className="password-icon" onClick={toggleConfirmPasswordVisibility}>
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>
          </div>
          <div className="input-checkbox">
            <input type="checkbox" id="terms" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} required />
            <label htmlFor="terms">Concordo com os Termos de Uso e Política de Privacidade</label>
          </div>
          <div className="btn-group">
            <button type="button" className="btn btn-secondary" onClick={() => setTelaAtual('cadastro1')}>Voltar</button>
            <button type="submit" className="btn btn-primary" disabled={!podeCriarConta}>
              {loading ? 'Criando...' : 'Criar conta →'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default CadastroPasso2;