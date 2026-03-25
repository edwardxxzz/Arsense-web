import React, { useState } from 'react';

function RecuperarSenha({ setTelaAtual }) {
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`Enviando link de recuperação para: ${email}`);
  };

  return (
    <main className="form-wrapper">
      <nav className="form-tabs">
        <button className="tab-item" onClick={() => setTelaAtual('login')}>Entrar</button>
        <button className="tab-item" onClick={() => setTelaAtual('cadastro1')}>Cadastrar</button>
        <button className="tab-item active">Recuperar</button>
      </nav>

      <section className="form-section">
        <h1 className="form-title">Esqueceu sua senha?</h1>
        <p className="form-subtitle">Digite seu email e enviaremos instruções para redefinir sua senha.</p>
        <form className="form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="recoverEmail">Email</label>
            <div className="input-container">
              <input type="email" id="recoverEmail" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Enviar link de recuperação →</button>
        </form>
      </section>
    </main>
  );
}

export default RecuperarSenha;