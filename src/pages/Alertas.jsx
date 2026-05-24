import { useState, useEffect } from 'react';
import { Bell, BellOff, Info, CheckCircle, AlertTriangle, Eye, Check, AlertOctagon } from 'lucide-react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const NIVEL_CONFIG = {
  ok:      { label: 'OK',      color: '#22C55E', bg: '#D1FAE5', icon: CheckCircle },
  info:    { label: 'Info',    color: '#2563EB', bg: '#DBEAFE', icon: Info },
  aviso:   { label: 'Aviso',   color: '#F59E0B', bg: '#FEF3C7', icon: AlertTriangle },
  critico: { label: 'Crítico', color: '#EF4444', bg: '#FEE2E2', icon: AlertOctagon },
};

function getNivelConfig(nivel) {
  return NIVEL_CONFIG[nivel] || NIVEL_CONFIG.info;
}

export default function Alertas() {
  const { empresaId } = useAuth();
  const [alertas, setAlertas] = useState([]);
  const [activeFilter, setActiveFilter] = useState('todos');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!empresaId) return;

    const rpiRef = doc(db, 'empresas', empresaId, 'alertas', 'rpi');
    const ambRef = doc(db, 'empresas', empresaId, 'alertas', 'amb');

    let rpiData = null;
    let ambData = null;

    const buildAlertas = () => {
      const list = [];

      [rpiData, ambData].forEach((docData) => {
        if (!docData) return;
        const origem = docData.origem || '';
        const itens = docData.itens || {};

        Object.entries(itens).forEach(([alertaId, item]) => {
          list.push({
            id: `${origem}_${alertaId}`,
            alertaKey: alertaId,
            docOrigem: origem,
            tipo: item.tipo || '',
            nivel: item.nivel || 'info',
            titulo: item.titulo || 'Sem título',
            mensagem: item.mensagem || '',
            detalhe: item.detalhe || '',
            ativo: item.ativo !== false,
            lido: item.lido || false,
            origem: item.origem || origem,
            atualizadoEm: item.atualizadoEm || '',
          });
        });
      });

      list.sort((a, b) => {
        const nivelOrder = { critico: 0, aviso: 1, info: 2, ok: 3 };
        const na = nivelOrder[a.nivel] ?? 2;
        const nb = nivelOrder[b.nivel] ?? 2;
        if (na !== nb) return na - nb;
        if (a.atualizadoEm && b.atualizadoEm) return b.atualizadoEm.localeCompare(a.atualizadoEm);
        return 0;
      });

      setAlertas(list);
    };

    const unsubRpi = onSnapshot(rpiRef, (snap) => {
      rpiData = snap.exists() ? snap.data() : null;
      buildAlertas();
    });

    const unsubAmb = onSnapshot(ambRef, (snap) => {
      ambData = snap.exists() ? snap.data() : null;
      buildAlertas();
    });

    return () => { unsubRpi(); unsubAmb(); };
  }, [empresaId]);

  const filteredAlertas = alertas.filter((alerta) => {
    if (activeFilter === 'nao_lidos') return alerta.ativo && !alerta.lido;
    if (activeFilter === 'resolvidos') return !alerta.ativo;
    return true;
  });

  const markAsRead = async (alerta) => {
    if (!empresaId) return;
    try {
      await updateDoc(doc(db, 'empresas', empresaId, 'alertas', alerta.docOrigem), {
        [`itens.${alerta.alertaKey}.lido`]: true,
        [`itens.${alerta.alertaKey}.atualizadoEm`]: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Erro ao marcar como lido:', err);
    }
  };

  const markAsResolved = async (alerta) => {
    if (!empresaId) return;
    try {
      await updateDoc(doc(db, 'empresas', empresaId, 'alertas', alerta.docOrigem), {
        [`itens.${alerta.alertaKey}.ativo`]: false,
        [`itens.${alerta.alertaKey}.nivel`]: 'ok',
        [`itens.${alerta.alertaKey}.atualizadoEm`]: new Date().toISOString(),
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
          const cfg = getNivelConfig(alerta.nivel);
          const isResolved = !alerta.ativo;
          const isExpanded = expandedId === alerta.id;
          const NivelIcon = cfg.icon;

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
              <div style={{
                flexShrink: 0,
                marginTop: 2,
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: isResolved ? '#D1FAE5' : cfg.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {isResolved ? (
                  <CheckCircle size={20} color="#22C55E" />
                ) : (
                  <NivelIcon size={20} color={cfg.color} />
                )}
              </div>

              {/* Right content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
                        {alerta.tipo || alerta.docOrigem?.toUpperCase()}
                      </p>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 4,
                        backgroundColor: '#F1F5F9',
                        color: '#64748B',
                      }}>
                        {alerta.docOrigem?.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#1E293B', margin: 0, marginBottom: 4 }}>
                      {alerta.titulo}
                    </p>
                    <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
                      {alerta.mensagem}
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
                        : { backgroundColor: cfg.bg, color: cfg.color }),
                    }}
                  >
                    {isResolved ? 'Resolvido' : cfg.label}
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
                    {alerta.detalhe && (
                      <p style={{ fontSize: 13, color: '#475569', margin: 0, marginBottom: 8, lineHeight: 1.5 }}>
                        {alerta.detalhe}
                      </p>
                    )}
                    {alerta.atualizadoEm && (
                      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, marginBottom: 12 }}>
                        Atualizado em: {new Date(alerta.atualizadoEm).toLocaleString('pt-BR')}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {alerta.ativo && !alerta.lido && (
                        <button
                          onClick={() => markAsRead(alerta)}
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
                      {alerta.ativo && (
                        <button
                          onClick={() => markAsResolved(alerta)}
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
                          Resolver
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
