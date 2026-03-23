import React from 'react';
// Importando a sua logo lá da pasta assets!
import logoImg from './assets/logo.png'; 
import './index.css'; // Importando nosso CSS

function App() {
  return (
    <div className="bg-gradient main-container-wrapper">
      <div className="main-container">
        
        {/* Aqui entra a sua logo em imagem */}
        <header className="header">
          <img src={logoImg} alt="Logo @rsense" className="logo-img" />
        </header>

        <main className="form-wrapper">
          <nav className="form-tabs">
            <button className="tab-item active">Entrar</button>
            <button className="tab-item">Cadastrar</button>
            <button className="tab-item">Recuperar</button>
          </nav>

          <section className="form-section">
            <h1 className="form-title">Bem-vindo de volta</h1>
            <p className="form-subtitle">Entre na sua conta para continuar</p>

            <form className="form">
              <div className="input-group">
                <label htmlFor="email">Email</label>
                <div className="input-container">
                  <input type="email" id="email" placeholder="seu@email.com" required />
                </div>
              </div>

              <div className="input-group">
                <div className="label-with-link">
                  <label htmlFor="password">Senha</label>
                  <a href="#" className="forgot-password-link">Esqueceu a senha?</a>
                </div>
                <div className="input-container">
                  <input type="password" id="password" placeholder="●●●●●●" required />
                </div>
              </div>

              <div className="input-checkbox">
                <input type="checkbox" id="keepConnected" />
                <label htmlFor="keepConnected">Manter conectado</label>
              </div>

              <button type="submit" className="btn btn-primary">Entrar →</button>
            </form>

            <div className="separator">
              <span>ou continue com</span>
            </div>

            <button className="btn btn-social-google">
              Entrar com o Google
            </button>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;