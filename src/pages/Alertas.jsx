import { useState } from 'react';
import { Bell, BellOff, Info, CheckCircle } from 'lucide-react';

export default function Alertas() {
  const [activeFilter, setActiveFilter] = useState('todos');

  const filters = [
    { key: 'todos', label: 'Todos', icon: Bell },
    { key: 'nao_lidos', label: 'Não Lidos', icon: Info },
    { key: 'resolvidos', label: 'Resolvidos', icon: CheckCircle },
  ];

  const emptyMessages = {
    todos: { title: 'Nenhum alerta', desc: 'O sistema está funcionando normalmente' },
    nao_lidos: { title: 'Nenhum alerta não lido', desc: 'Todos os alertas foram lidos' },
    resolvidos: { title: 'Nenhum alerta resolvido', desc: 'O sistema está funcionando normalmente' },
  };

  const msg = emptyMessages[activeFilter];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Alertas</h1>
        <p>Todos os alertas lidos</p>
      </div>

      <div className="filter-tabs">
        {filters.map(f => (
          <button
            key={f.key}
            className={`filter-tab ${activeFilter === f.key ? 'active' : ''}`}
            onClick={() => setActiveFilter(f.key)}
          >
            <f.icon size={16} />
            {f.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">
            <BellOff size={32} />
          </div>
          <h3>{msg.title}</h3>
          <p>{msg.desc}</p>
        </div>
      </div>
    </div>
  );
}
