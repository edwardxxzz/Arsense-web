import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa'; // Importando os ícones
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

function Login({ setTelaAtual }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erroLogin, setErroLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Estado para controlar a visibilidade da senha
  const [showPassword, setShowPassword] = useState(false);

  // Validações em tempo real
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const podeLogar = emailValido && password.length >= 8 && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErroLogin(false); // Reseta o erro ao tentar de novo
    if (!podeLogar) return;

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // alert(`Login efetuado com sucesso!`); // Removemos o alert
      setTelaAtual('dashboard'); // Direciona para o dashboard
    } catch (error) {
      setErroLogin(true); // Se o firebase rejeitar, ativa o modo de erro
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <main className="form-wrapper">
      <nav className="form-tabs">
        <button className="tab-item active">Entrar</button>
        <button className="tab-item" onClick={() => setTelaAtual('cadastro1')}>Cadastrar</button>
        <button className="tab-item" onClick={() => setTelaAtual('recuperar')}>Recuperar</button>
      </nav>

      <section className="form-section">
        <h1 className="form-title">Bem-vindo de volta</h1>
        <p className="form-subtitle">Entre na sua conta para continuar</p>
        
        {erroLogin && <p className="error-text" style={{textAlign: 'center', marginBottom: '10px'}}>Usuário ou senha incorretos</p>}

        <form className="form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <div className={`input-container ${(!emailValido && email.length > 0) || erroLogin ? 'error-border' : ''}`}>
              <input type="email" id="email" placeholder="seu@email.com" value={email} onChange={(e) => {setEmail(e.target.value); setErroLogin(false)}} />
            </div>
          </div>
          <div className="input-group">
            <div className="label-with-link">
              <label htmlFor="password">Senha</label>
              <span className="forgot-password-link" style={{cursor: 'pointer'}} onClick={() => setTelaAtual('recuperar')}>Esqueceu a senha?</span>
            </div>
            <div className={`input-container password-input-container ${erroLogin ? 'error-border' : ''}`}>
              <input 
                type={showPassword ? "text" : "password"} // Muda o tipo entre text e password
                id="password" 
                placeholder="●●●●●●" 
                value={password} 
                onChange={(e) => {setPassword(e.target.value); setErroLogin(false)}} 
                required 
              />
              {/* Ícone do olhinho com cursor pointer */}
              <span className="password-icon" onClick={togglePasswordVisibility}>
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>
          </div>
          <div className="input-checkbox">
            <input type="checkbox" id="keepConnected" />
            <label htmlFor="keepConnected">Manter conectado</label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={!podeLogar}>
            {loading ? 'Entrando...' : 'Entrar →'}
          </button>
        </form>
        <div className="separator"><span>ou continue com</span></div>
        <button className="btn btn-social-google">Entrar com o Google</button>
      </section>
    </main>
  );
}

export default Login;