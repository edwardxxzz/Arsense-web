import React from 'react';

function Dashboard({ setTelaAtual }) {
  const handleLogout = () => {
    setTelaAtual('login');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#F0F4F8' }}>
      <h1 style={{ color: '#2D68C4', marginBottom: '20px' }}>Dashboard @rsense</h1>
      <p style={{ color: '#333' }}>Bem-vindo ao seu painel de controle!</p>
      <button 
        className="btn btn-primary" 
        style={{ marginTop: '20px', width: 'auto', padding: '10px 20px' }}
        onClick={handleLogout}
      >
        Sair
      </button>
    </div>
  );
}

export default Dashboard;