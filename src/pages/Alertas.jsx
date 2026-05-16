import { useState, useEffect } from 'react';
import { Bell, BellOff, Info, CheckCircle, AlertTriangle, Eye, Check } from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

export default function Alertas() {
  const { empresaId } = useAuth();
  const [alertas, setAlertas] = useState([]);
  const [activeFilter, setActiveFilter] = useState('todos');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!empresaId) return;

    const alertasRef = collection(db, 'empresas', empresaId, 'alertas');
    const q = query(alertasRef, orderBy('criadoEm', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((a) => a.nome !== 'inicial');
      setAlertas(data);
    });

    return () => unsubscribe();
  }, [empresaId]);

  const filteredAlertas = alertas.filter((alerta) => {
    if (activeFilter === 'nao_lidos') return alerta.status !== 'resolvido';
    if (activeFilter === 'resolvidos') return alerta.status === 'resolvido';
    return true;
  });

  const markAsRead = async (alertaId) => {
    if (!empresaId) return;
    try {
      await updateDoc(doc(db, 'empresas', empresaId, 'alertas', alertaId), {
        lido: true,
      });
    } catch (err) {
      console.error('Erro ao marcar como lido:', err);
    }
  };

  const markAsResolved = async (alertaId) => {
    if (!empresaId) return;
    try {
      await updateDoc(doc(db, 'empresas', empresaId, 'alertas', alertaId), {
        status: 'resolvido',
      });
    } catch (err) {
      console.error('Erro ao marcar como resolvido:', err);
    }
  };

  const filters = [
    { key: 'todos', label: 'Todos', icon: Bell },
    { key: 'nao_lidos', label: 'Não Lidos', icon: Info },
    { key: 'resolvidos', label: 'Resolvidos', icon: CheckCircle },
  ];

  const emptyMessages = {
    todos: { title: 'Nenhum alerta', desc: 'O sistema está funcionando normalmente' },
    nao_lidos: { title: 'Nenhum alerta não lido', desc: 'Todos os alertas foram lidos' },
    resolvidos: { title: 'Nenhum alerta resolvido', desc: 'Nenhum alerta foi resolvido ainda' },
  };

  const msg = emptyMessages[activeFilter];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Alertas</h1>
        <p>Monitore e gerencie os alertas dos seus ambientes</p>
      </div>

      <div className="filter-tabs">
        {filters.map((f) => (
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

      {filteredAlertas.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <BellOff size={32} />
            </div>
            <h3>{msg.title}</h3>
            <p>{msg.desc}</p>
          </div>
        </div>
      ) : (
        filteredAlertas.map((alerta) => {
          const isResolved = alerta.status === 'resolvido';
          const isExpanded = expandedId === alerta.id;

          return (
            <div
              key={alerta.id}
              style={{
                background: '#FFFFFF',
                borderRadius: 12,
                padding: 20,
                marginBottom: 12,
                border: '1px solid #F1F5F9',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              {/* Left icon */}
              <div style={{ flexShrink: 0, marginTop: 2 }}>
                {isResolved ? (
                  <CheckCircle size={22} color="#22C55E" />
                ) : (
                  <AlertTriangle size={22} color="#F59E0B" />
                )}
              </div>

              {/* Right content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, marginBottom: 2 }}>
                      {alerta.tipo || 'Alerta'}
                    </p>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#1E293B', margin: 0, marginBottom: 4 }}>
                      {alerta.titulo || 'Sem título'}
                    </p>
                    <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
                      {alerta.descricao || `${alerta.ambiente || 'Ambiente'} está com uma situação`}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 20,
                      whiteSpace: 'nowrap',
                      ...(isResolved
                        ? { backgroundColor: '#D1FAE5', color: '#065F46' }
                        : { backgroundColor: '#FEF3C7', color: '#92400E' }),
                    }}
                  >
                    {isResolved ? 'Resolvido' : 'Não Lido'}
                  </span>
                </div>

                {/* Ver mais link */}
                <p
                  style={{ fontSize: 13, color: '#2563EB', margin: 0, marginTop: 8, cursor: 'pointer', fontWeight: 500 }}
                  onClick={() => setExpandedId(isExpanded ? null : alerta.id)}
                >
                  {isExpanded ? 'Ver menos' : 'Ver mais'}
                </p>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
                    <p style={{ fontSize: 13, color: '#475569', margin: 0, marginBottom: 12, lineHeight: 1.5 }}>
                      {alerta.descricao || `${alerta.ambiente || 'Ambiente'} está com uma situação`}
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {!alerta.lido && (
                        <button
                          onClick={() => markAsRead(alerta.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 12,
                            fontWeight: 500,
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: '1px solid #E2E8F0',
                            background: '#F8FAFC',
                            color: '#475569',
                            cursor: 'pointer',
                          }}
                        >
                          <Eye size={14} />
                          Marcar como lido
                        </button>
                      )}
                      {!isResolved && (
                        <button
                          onClick={() => markAsResolved(alerta.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 12,
                            fontWeight: 500,
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: '1px solid #D1FAE5',
                            background: '#F0FDF4',
                            color: '#065F46',
                            cursor: 'pointer',
                          }}
                        >
                          <Check size={14} />
                          Marcar como resolvido
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
