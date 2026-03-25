import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
// Importamos collection e addDoc para criar IDs aleatórios como na sua imagem do historico_geral
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
      // 1. Cria usuário na Autenticação do Firebase (gera o UID)
      const userCredential = await createUserWithEmailAndPassword(auth, cadastroData.corporateEmail, password);
      const user = userCredential.user;

      const nomeEmpresa = cadastroData.companyName; // Variável para a Empresa

      // 2. Raiz: empresas > {nomeEmpresa}
      const empresaRef = doc(db, "empresas", nomeEmpresa);
      await setDoc(empresaRef, {
        nome: nomeEmpresa,
        criadoEm: new Date().toISOString()
      }, { merge: true }); 

      // 3. Usuários: empresas > {nomeEmpresa} > usuarios > {user.uid}
      const userRef = doc(db, "empresas", nomeEmpresa, "usuarios", user.uid);
      await setDoc(userRef, {
        dataLogin: new Date().toISOString(),
        email: cadastroData.corporateEmail,
        senha: "Gerenciada pelo Firebase Auth", 
        userId: user.uid,
        userName: cadastroData.fullName
      });

      // 4. Ambientes e Subcoleção Histórico: 
      // Caminho rigoroso: empresas > {nomeEmpresa} > ambientes > Sala_de_estudos > historico > registro_inicial
      
      // 4.1. Primeiro, criamos o documento da sala (Boa prática para não ficar um "documento fantasma")
      const nomeSala = "Sala_de_estudos"; // Variável para o ambiente
      const ambienteRef = doc(db, "empresas", nomeEmpresa, "ambientes", nomeSala);
      await setDoc(ambienteRef, {
        nome: "Sala de estudos",
        criadoEm: new Date().toISOString()
      }, { merge: true });

      // 4.2. Agora sim, criamos a subcoleção "historico" DENTRO da Sala de estudos
      const historicoAmbienteRef = doc(db, "empresas", nomeEmpresa, "ambientes", nomeSala, "historico", "registro_inicial");
      await setDoc(historicoAmbienteRef, {
        co2: 0,
        qualidade_ar: 100,
        temperatura: 0,
        umidade: 0,
        timestamp: new Date().toISOString(),
        luminosidade: 0, // Adicional solicitado
        presenca: 0      // Adicional solicitado (pode ser boolean, mas deixei 0 seguindo os outros campos)
      });

      // 5. Histórico Geral: empresas > {nomeEmpresa} > historico_geral > {ID_Gerado_Automaticamente}
      // Usamos 'addDoc' para o Firebase criar aquele ID maluco igual à sua imagem (ex: j7kotpooBFVUj...)
      const historicoGeralRef = collection(db, "empresas", nomeEmpresa, "historico_geral");
      await addDoc(historicoGeralRef, {
        co2_medio: 0,
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        indice_conforto: 0,
        qual_do_ar: 0,
        temperatura_media: 0,
        timestamp: Date.now(), // Numérico como na sua imagem
        luminosidade: 0, // Adicional solicitado
        presenca: 0      // Adicional solicitado
      });

      // Sucesso! Direciona para o Dashboard/Login
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