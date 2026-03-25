import React, { useState } from 'react';
import logoImg from './assets/logo.png';

// Importando todas as nossas telas
import Login from './components/Login';
import CadastroPasso1 from './components/CadastroPasso1';
import CadastroPasso2 from './components/CadastroPasso2';
import RecuperarSenha from './components/RecuperarSenha';
import Dashboard from './components/Dashboard'; // Importando o novo Dashboard

import './index.css'; 

function App() {
  // O useState guarda qual tela está ativa no momento. Começa no 'login'
  const [telaAtual, setTelaAtual] = useState('login');
  
  // Esse estado guarda os dados do Passo 1 para usarmos no Passo 2
  const [cadastroData, setCadastroData] = useState({
    fullName: '',
    corporateEmail: '',
    companyName: ''
  });

  // Essa função funciona como as teclas do controle remoto
  const renderizarTela = () => {
    switch (telaAtual) {
      case 'login':
        return <Login setTelaAtual={setTelaAtual} />;
      case 'cadastro1':
        return <CadastroPasso1 setTelaAtual={setTelaAtual} cadastroData={cadastroData} setCadastroData={setCadastroData} />;
      case 'cadastro2':
        return <CadastroPasso2 setTelaAtual={setTelaAtual} cadastroData={cadastroData} />;
      case 'recuperar':
        return <RecuperarSenha setTelaAtual={setTelaAtual} />;
      case 'dashboard': // Nova tela de dashboard
        return <Dashboard setTelaAtual={setTelaAtual} />;
      default:
        return <Login setTelaAtual={setTelaAtual} />;
    }
  };

  // Se a tela for dashboard, não mostramos o header padrão com o logo
  const isDashboard = telaAtual === 'dashboard';

  return (
    <div className={`bg-gradient ${isDashboard ? '' : 'main-container-wrapper'}`}>
      <div className={`${isDashboard ? '' : 'main-container'}`}>
        {!isDashboard && (
          <header className="header">
            <img src={logoImg} alt="Logo @rsense" className="logo-img" />
          </header>
        )}

        {/* Aqui a mágica acontece: chamamos a função que mostra a tela certa */}
        {renderizarTela()}
      </div>
    </div>
  );
}

export default App;