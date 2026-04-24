import React from 'react';

function CadastroPasso1({ setTelaAtual, cadastroData, setCadastroData }) {
  
  // Regras de validação
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cadastroData.corporateEmail);
  const nomeValido = cadastroData.fullName.trim().length >= 2;
  const empresaValida = /^[a-zA-ZÀ-ÿ0-9\s]+$/.test(cadastroData.companyName) && cadastroData.companyName.trim().length > 0;

  // Só libera o botão se TUDO for válido
  const podeContinuar = emailValido && nomeValido && empresaValida;

  const handleContinue = (e) => {
    e.preventDefault();
    if (podeContinuar) setTelaAtual('cadastro2');
  };

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
        <div className="progress-indicator">
          <div className="circle active">1</div>
          <div className="progress-line"></div>
          <div className="circle">2</div>
        </div>
        <form className="form" onSubmit={handleContinue}>
          <div className="input-group">
            <label htmlFor="fullName">Nome Completo</label>
            <div className={`input-container ${!nomeValido && cadastroData.fullName.length > 0 ? 'error-border' : ''}`}>
              <input type="text" id="fullName" placeholder="Seu nome" value={cadastroData.fullName} onChange={(e) => setCadastroData({...cadastroData, fullName: e.target.value})} />
            </div>
          </div>
          <div className="input-group">
            <label htmlFor="corporateEmail">Email Corporativo</label>
            <div className={`input-container ${!emailValido && cadastroData.corporateEmail.length > 0 ? 'error-border' : ''}`}>
              <input type="email" id="corporateEmail" placeholder="seu@empresa.com" value={cadastroData.corporateEmail} onChange={(e) => setCadastroData({...cadastroData, corporateEmail: e.target.value})} />
            </div>
          </div>
          <div className="input-group">
            <label htmlFor="companyName">Empresa (sem caracteres especiais)</label>
            <div className={`input-container ${!empresaValida && cadastroData.companyName.length > 0 ? 'error-border' : ''}`}>
              <input type="text" id="companyName" placeholder="Nome da empresa" value={cadastroData.companyName} onChange={(e) => setCadastroData({...cadastroData, companyName: e.target.value})} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={!podeContinuar}>Continuar →</button>
        </form>
      </section>
    </main>
  );
}

export default CadastroPasso1;