import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, updateDoc, getDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Calendar, CalendarDays, Clock, Search, ChevronDown, Building2,
  Snowflake, Zap, Power, MoreVertical, Trash2
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────
const isScheduleActiveNow = (ag) => {
  if (ag.status === 'concluido') return false;
  const now = new Date();
  const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  if (ag.data !== todayStr) return false;
  const [schedH, schedM] = (ag.horario || '').split(':').map(Number);
  if (isNaN(schedH) || isNaN(schedM)) return false;
  const schedMinutes = schedH * 60 + schedM;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= schedMinutes && nowMinutes <= schedMinutes + 30;
};

const STATUS_ORDER = { pendente: 0, ativo: 1, concluido: 2 };
const STATUS_COLORS = { pendente: '#F59E0B', ativo: '#2563EB', concluido: '#10B981' };
const STATUS_LABELS = { pendente: 'Pendente', ativo: 'Ativo', concluido: 'Concluído' };

// Generate next 14 days for date picker
const generateNext14Days = () => {
  const days = [];
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      key: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
      dayName: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : dayNames[d.getDay()],
      dayNum: d.getDate(),
      month: monthNames[d.getMonth()],
    });
  }
  return days;
};
const NEXT_14_DAYS = generateNext14Days();

// Alarm-clock style time picker columns are rendered inline below

export default function Ambientes() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();

  // ── tabs ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('ambientes');

  // ── ambientes ──────────────────────────────────────────────────────
  const [ambientes, setAmbientes] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);

  // ── new env form ───────────────────────────────────────────────────
  const [showNewEnvModal, setShowNewEnvModal] = useState(false);
  const [envNome, setEnvNome] = useState('');
  const [envTipo, setEnvTipo] = useState('');
  const [envArea, setEnvArea] = useState('');
  const [envCapacidade, setEnvCapacidade] = useState('');
  const [envAndar, setEnvAndar] = useState('');

  // ── edit env ───────────────────────────────────────────────────────
  const [showEditEnvModal, setShowEditEnvModal] = useState(false);
  const [editingEnvId, setEditingEnvId] = useState(null);
  const [editEnvNome, setEditEnvNome] = useState('');
  const [editEnvTipo, setEditEnvTipo] = useState('');
  const [editEnvArea, setEditEnvArea] = useState('');
  const [editEnvCapacidade, setEditEnvCapacidade] = useState('');
  const [editEnvAndar, setEditEnvAndar] = useState('');

  // ── agendamentos (global list) ─────────────────────────────────────
  const [agendamentos, setAgendamentos] = useState([]);
  const [loadingAgendamentos, setLoadingAgendamentos] = useState(true);
  const [openAgMenuId, setOpenAgMenuId] = useState(null);

  // ── schedule modal (create) ────────────────────────────────────────
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedAmbiente, setSchedAmbiente] = useState('');
  const [schedTitulo, setSchedTitulo] = useState('');
  const [schedDescricao, setSchedDescricao] = useState('');
  const [schedPerifericoId, setSchedPerifericoId] = useState('');
  const [schedAcao, setSchedAcao] = useState('ligar');
  const [schedData, setSchedData] = useState('');
  const [schedHora, setSchedHora] = useState('');
  const [schedMinuto, setSchedMinuto] = useState('');
  const [perifericosDoAmbiente, setPerifericosDoAmbiente] = useState([]);
  const [loadingPerifericos, setLoadingPerifericos] = useState(false);

  // ── toggle loading map for schedule control buttons ────────────────
  const [toggleAgLoading, setToggleAgLoading] = useState({});

  // ====================================================================
  //  FETCH AMBIENTES
  // ====================================================================
  useEffect(() => {
    if (!empresaId) return;
    const unsub = onSnapshot(collection(db, 'empresas', empresaId, 'ambientes'), (snapshot) => {
      const envs = [];
      snapshot.forEach(d => {
        if (d.id.toLowerCase() !== 'ambiente_1') {
          const data = d.data();
          envs.push({
            id: d.id,
            nome: data.dados?.nome || d.id,
            tipo: data.config?.tipo || data.tipo || '',
            andar: data.config?.andar || data.andar || '',
            area: data.config?.area || '',
            capacidade: data.config?.capacidade || '',
            temperatura: data.sensores?.temperatura || 0,
            umidade: data.sensores?.umidade || 0,
            aqi: data.sensores?.AQI || 0,
            indice: 0,
          });
        }
      });
      setAmbientes(envs);
      setLoading(false);

      // Fetch latest indice_conforto for each ambiente
      const indicePromises = envs.map(async (env) => {
        try {
          const histQ = query(collection(db, 'empresas', empresaId, 'ambientes', env.id, 'historico'), orderBy('timestamp', 'desc'), limit(1));
          const histSnap = await getDocs(histQ);
          if (!histSnap.empty) {
            const latest = histSnap.docs[0].data();
            env.indice = latest.indice_conforto ?? latest.indice_geral ?? 0;
          }
        } catch (err) {
          console.error('Erro ao buscar índice do ambiente:', err);
        }
      });
      await Promise.all(indicePromises);
      setAmbientes([...envs]);
    });
    return () => unsub();
  }, [empresaId]);

  // ====================================================================
  //  FETCH AGENDAMENTOS (all ambientes)
  // ====================================================================
  const fetchAllAgendamentos = useCallback(async () => {
    if (!empresaId) return;
    setLoadingAgendamentos(true);
    try {
      const ambSnap = await getDocs(collection(db, 'empresas', empresaId, 'ambientes'));
      const allAgendamentos = [];

      for (const ambDoc of ambSnap.docs) {
        const ambId = ambDoc.id;
        const ambData = ambDoc.data();
        const ambNome = ambData.dados?.nome || ambId;

        const agSnap = await getDocs(collection(db, 'empresas', empresaId, 'ambientes', ambId, 'agendamentos'));
        agSnap.forEach(agDoc => {
          if (agDoc.id === 'registro_inicial') return;
          const d = agDoc.data();
          allAgendamentos.push({
            id: agDoc.id,
            ambienteId: ambId,
            ambienteNome: ambNome,
            titulo: d.titulo || '',
            descricao: d.descricao || '',
            perifericoId: d.perifericoId || '',
            perifericoNome: d.perifericoNome || '',
            perifericoTipo: d.perifericoTipo || '',
            acao: d.acao || 'ligar',
            data: d.data || '',
            horario: d.horario || '',
            status: d.status || 'pendente',
            criadoEm: d.criadoEm || '',
          });
        });
      }

      // sort: pending first, then active, then completed; within same status sort by date/time
      allAgendamentos.sort((a, b) => {
        const so = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
        if (so !== 0) return so;
        // within same status, sort by date then time
        if (a.data && b.data) {
          const da = a.data.split('/').reverse().join('');
          const db2 = b.data.split('/').reverse().join('');
          if (da !== db2) return da.localeCompare(db2);
        }
        return (a.horario || '').localeCompare(b.horario || '');
      });

      setAgendamentos(allAgendamentos);
    } catch (err) {
      console.error('Erro ao buscar agendamentos:', err);
    }
    setLoadingAgendamentos(false);
  }, [empresaId]);

  useEffect(() => {
    if (activeTab === 'agendamentos') {
      fetchAllAgendamentos();
    }
  }, [activeTab, fetchAllAgendamentos]);

  // ====================================================================
  //  FETCH PERIFERICOS DO AMBIENTE (for schedule modal)
  // ====================================================================
  const fetchPerifericosDoAmbiente = async (ambId) => {
    if (!ambId) { setPerifericosDoAmbiente([]); return; }
    setLoadingPerifericos(true);
    try {
      const perSnap = await getDocs(collection(db, 'empresas', empresaId, 'ambientes', ambId, 'perifericos'));
      const lista = [];
      perSnap.docs.forEach(docSnap => {
        const tipoDocId = docSnap.id;
        const data = docSnap.data();
        Object.entries(data).forEach(([nomeChave, propriedades]) => {
          if (nomeChave === 'tipo' || nomeChave === 'sensores' || nomeChave === 'sensoresGerais' || nomeChave === 'id') return;
          if (tipoDocId === 'ar_condicionado' && nomeChave === 'geral') return;
          if (typeof propriedades === 'object' && propriedades !== null) {
            lista.push({
              docId: tipoDocId,
              nomeId: nomeChave,
              nome: (propriedades.nome || nomeChave).replace(/_/g, ' '),
              tipo: tipoDocId.replace(/_/g, ' '),
            });
          }
        });
      });
      setPerifericosDoAmbiente(lista);
    } catch (err) {
      console.error('Erro ao buscar periféricos do ambiente:', err);
      setPerifericosDoAmbiente([]);
    }
    setLoadingPerifericos(false);
  };

  // ====================================================================
  //  ENV CRUD
  // ====================================================================
  const filtered = ambientes.filter(e =>
    e.nome.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateEnv = async () => {
    if (!envNome || !envTipo) return;
    const safeId = envNome.replace(/[.#$\[\]]/g, '_').replace(/\s+/g, '_');

    await setDoc(doc(db, 'empresas', empresaId, 'ambientes', safeId), {
      tipo: envTipo, area: envArea, capacidade: envCapacidade, andar: envAndar,
      dados: { central_id: 'central1', criadoEm: new Date().toISOString(), nome: envNome, receptor_id: 'receptor1' },
      config: { tipo: envTipo, area: envArea, capacidade: envCapacidade, andar: envAndar },
      sensores: { temperatura: 0, umidade: 0, luminosidade: 0, AQI: 0 },
    });

    await setDoc(doc(db, 'empresas', empresaId, 'ambientes', safeId, 'perifericos', 'ar_condicionado'), {
      geral: { ligado: false, marca: '', modelo: '', temperatura: 24 },
    });

    await setDoc(doc(db, 'empresas', empresaId, 'ambientes', safeId, 'agendamentos', 'registro_inicial'), {
      timestamp: new Date().toISOString(), status: 'inicializado', observacao: 'Registro inicial',
    });

    await addDoc(collection(db, 'empresas', empresaId, 'ambientes', safeId, 'historico'), {
      timestamp: new Date().toISOString(), temperatura: 0, umidade: 0, luminosidade: 0,
      indice_conforto: 0, co2: 0, presenca: 0, qualidade_ar: 0,
    });

    setShowNewEnvModal(false);
    setEnvNome(''); setEnvTipo(''); setEnvArea(''); setEnvCapacidade(''); setEnvAndar('');
  };

  const openEditEnv = (env) => {
    setEditingEnvId(env.id);
    setEditEnvNome(env.nome);
    setEditEnvTipo(env.tipo);
    setEditEnvArea(env.area || '');
    setEditEnvCapacidade(env.capacidade || '');
    setEditEnvAndar(env.andar || '');
    setOpenMenuId(null);
    setShowEditEnvModal(true);
  };

  const handleEditEnv = async () => {
    if (!editEnvNome || !editEnvTipo) return;
    try {
      const docRef = doc(db, 'empresas', empresaId, 'ambientes', editingEnvId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        await updateDoc(docRef, {
          ...(snap.data().dados ? { 'dados.nome': editEnvNome } : {}),
          'config.tipo': editEnvTipo,
          'config.area': editEnvArea,
          'config.capacidade': editEnvCapacidade,
          'config.andar': editEnvAndar,
          tipo: editEnvTipo,
          andar: editEnvAndar,
          area: editEnvArea,
          capacidade: editEnvCapacidade,
        });
      }
      setShowEditEnvModal(false);
    } catch (e) {
      console.error('Erro ao editar ambiente:', e);
    }
  };

  const handleDeleteEnv = async (id) => {
    if (!window.confirm('Tem certeza que deseja deletar este ambiente?')) return;
    await deleteDoc(doc(db, 'empresas', empresaId, 'ambientes', id));
    setOpenMenuId(null);
  };

  // ====================================================================
  //  AGENDAMENTO CRUD
  // ====================================================================
  const handleCreateSchedule = async () => {
    const composedHorario = schedHora && schedMinuto ? `${schedHora}:${schedMinuto}` : '';
    if (!schedAmbiente || !schedTitulo || !schedPerifericoId || !schedData || !composedHorario) return;

    const selectedPerif = perifericosDoAmbiente.find(p => p.nomeId === schedPerifericoId);

    await addDoc(collection(db, 'empresas', empresaId, 'ambientes', schedAmbiente, 'agendamentos'), {
      titulo: schedTitulo,
      descricao: schedDescricao,
      perifericoId: schedPerifericoId,
      perifericoNome: selectedPerif?.nome || schedPerifericoId,
      perifericoTipo: selectedPerif?.docId || '',
      acao: schedAcao,
      data: schedData,
      horario: composedHorario,
      status: 'pendente',
      criadoEm: new Date().toISOString(),
    });

    setShowScheduleModal(false);
    resetScheduleForm();
    fetchAllAgendamentos();
  };

  const resetScheduleForm = () => {
    setSchedAmbiente(''); setSchedTitulo(''); setSchedDescricao('');
    setSchedPerifericoId(''); setSchedAcao('ligar');
    setSchedData(''); setSchedHora(''); setSchedMinuto('');
    setPerifericosDoAmbiente([]);
  };

  const handleDeleteAgendamento = async (ag) => {
    if (!window.confirm('Tem certeza que deseja excluir este agendamento?')) return;
    try {
      await deleteDoc(doc(db, 'empresas', empresaId, 'ambientes', ag.ambienteId, 'agendamentos', ag.id));
      setOpenAgMenuId(null);
      fetchAllAgendamentos();
    } catch (err) {
      console.error('Erro ao excluir agendamento:', err);
    }
  };

  const handleToggleScheduledPeripheral = async (ag, turnOn) => {
    const loadingKey = ag.id;
    setToggleAgLoading(prev => ({ ...prev, [loadingKey]: true }));
    try {
      const perDocRef = doc(db, 'empresas', empresaId, 'ambientes', ag.ambienteId, 'perifericos', ag.perifericoTipo);
      await updateDoc(perDocRef, {
        [`${ag.perifericoId}.estado_desejado`]: turnOn,
        [`${ag.perifericoId}.status`]: turnOn,
      });
      const agDocRef = doc(db, 'empresas', empresaId, 'ambientes', ag.ambienteId, 'agendamentos', ag.id);
      await updateDoc(agDocRef, { status: turnOn ? 'ativo' : 'pendente' });
      fetchAllAgendamentos();
    } catch (err) {
      console.error('Erro ao controlar periférico agendado:', err);
    }
    setToggleAgLoading(prev => ({ ...prev, [loadingKey]: false }));
  };

  // ====================================================================
  //  Close menus on outside click
  // ====================================================================
  useEffect(() => {
    const handleClick = () => {
      if (openMenuId) setOpenMenuId(null);
      if (openAgMenuId) setOpenAgMenuId(null);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [openMenuId, openAgMenuId]);

  // ====================================================================
  //  RENDER
  // ====================================================================
  return (
    <div className="page-container">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Ambientes</h1>
          <p>Gerencie seus ambientes monitorados</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeTab === 'agendamentos' && (
            <button
              className="btn-secondary"
              onClick={() => { resetScheduleForm(); setShowScheduleModal(true); }}
            >
              <CalendarDays size={16} /> Agendar Sala
            </button>
          )}
          {activeTab === 'ambientes' && (
            <button className="btn-primary" onClick={() => setShowNewEnvModal(true)}>
              <Plus size={16} /> Novo Ambiente
            </button>
          )}
        </div>
      </div>

      {/* ── Tab Switcher (rounded pill container) ────────────────────── */}
      <div style={{
        display: 'inline-flex',
        gap: 4,
        marginBottom: 24,
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        padding: 4,
      }}>
        <button
          onClick={() => setActiveTab('ambientes')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', fontSize: 14, fontWeight: 600,
            border: 'none', cursor: 'pointer',
            borderRadius: 8,
            background: activeTab === 'ambientes' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'ambientes' ? 'var(--primary-blue)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'ambientes' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <Building2 size={16} /> Ambientes
        </button>
        <button
          onClick={() => setActiveTab('agendamentos')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', fontSize: 14, fontWeight: 600,
            border: 'none', cursor: 'pointer',
            borderRadius: 8,
            background: activeTab === 'agendamentos' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'agendamentos' ? 'var(--primary-blue)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'agendamentos' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <CalendarDays size={16} /> Agendamentos
        </button>
      </div>

      {/* ================================================================ */}
      {/*  TAB: AMBIENTES                                                  */}
      {/* ================================================================ */}
      {activeTab === 'ambientes' && (
        <>
          {/* Search */}
          <div className="search-bar">
            <Search size={18} />
            <input
              placeholder="Buscar ambiente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Skeleton */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ height: 160, borderRadius: 12 }} className="skeleton" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon"><Building2 size={32} /></div>
                <h3>Nenhum ambiente</h3>
                <p>Cadastre um ambiente para começar a monitorar</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {filtered.map(env => (
                <div key={env.id} className="card-bordered" style={{ position: 'relative', cursor: 'pointer' }}
                  onClick={() => navigate(`/ambiente?id=${env.id}&nome=${encodeURIComponent(env.nome)}&empresa=${empresaId}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 600, color: '#1E293B' }}>{env.nome}</h4>
                      <p style={{ fontSize: 13, color: '#64748B' }}>{env.tipo}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === env.id ? null : env.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}
                    >
                      <ChevronDown size={18} />
                    </button>
                  </div>

                  {openMenuId === env.id && (
                    <div style={{ position: 'absolute', top: 40, right: 8, backgroundColor: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10, overflow: 'hidden' }}>
                      <button
                        onClick={e => { e.stopPropagation(); openEditEnv(env); }}
                        style={{ padding: '8px 16px', border: 'none', background: 'none', color: '#2563EB', fontSize: 13, cursor: 'pointer', display: 'block', width: '100%', textAlign: 'left' }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteEnv(env.id); }}
                        style={{ padding: '8px 16px', border: 'none', background: 'none', color: '#EF4444', fontSize: 13, cursor: 'pointer', display: 'block', width: '100%', textAlign: 'left' }}
                      >
                        Deletar
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginTop: 16 }}>
                    <div style={{ textAlign: 'center', padding: 8, backgroundColor: 'white', borderRadius: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#EF4444' }}>{env.temperatura}°</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Temp</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: 8, backgroundColor: 'white', borderRadius: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#3B82F6' }}>{env.umidade}%</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Umidade</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: 8, backgroundColor: 'white', borderRadius: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#14B8A6' }}>{env.aqi}</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>AQI</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: 8, backgroundColor: 'white', borderRadius: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: env.indice >= 80 ? '#10B981' : env.indice >= 50 ? '#F59E0B' : '#EF4444' }}>{env.indice}</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Índice</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ================================================================ */}
      {/*  TAB: AGENDAMENTOS                                               */}
      {/* ================================================================ */}
      {activeTab === 'agendamentos' && (
        <>
          {loadingAgendamentos ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 180, borderRadius: 12 }} className="skeleton" />
              ))}
            </div>
          ) : agendamentos.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon"><CalendarDays size={32} /></div>
                <h3>Nenhum agendamento no momento</h3>
                <p>Crie um agendamento para controlar periféricos automaticamente.</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {agendamentos.map(ag => {
                const isActiveNow = isScheduleActiveNow(ag);
                const isActiveCard = isActiveNow && ag.status !== 'concluido';

                return (
                  <div
                    key={ag.id}
                    style={{
                      background: isActiveCard ? '#F0F9FF' : '#FFFFFF',
                      border: isActiveCard ? '2px solid #93C5FD' : '1px solid #F1F5F9',
                      borderRadius: 16,
                      padding: 20,
                      boxShadow: isActiveCard
                        ? '0 4px 12px rgba(37, 99, 235, 0.1)'
                        : '0 1px 3px rgba(0, 0, 0, 0.04)',
                      position: 'relative',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* ── Header row ─────────────────────────────────── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        backgroundColor: 'var(--schedule-icon-bg, #EFF6FF)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Calendar size={16} style={{ color: 'var(--primary-blue)' }} />
                      </div>
                      <span style={{
                        flex: 1, fontWeight: 600, fontSize: 15,
                        color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {ag.titulo}
                      </span>
                      {/* Status badge */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 999,
                        fontSize: 12, fontWeight: 600, color: '#fff',
                        backgroundColor: STATUS_COLORS[ag.status] || '#94A3B8',
                        flexShrink: 0,
                      }}>
                        {STATUS_LABELS[ag.status] || ag.status}
                      </span>
                      {/* 3-dot menu */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                          onClick={e => { e.stopPropagation(); setOpenAgMenuId(openAgMenuId === ag.id ? null : ag.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, display: 'flex' }}
                        >
                          <MoreVertical size={18} />
                        </button>
                        {openAgMenuId === ag.id && (
                          <div style={{
                            position: 'absolute', right: 0, top: 28,
                            backgroundColor: 'white', borderRadius: 8,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 20, overflow: 'hidden', minWidth: 160,
                          }}>
                            <button
                              onClick={e => { e.stopPropagation(); setOpenAgMenuId(null); navigate(`/ambiente?id=${ag.ambienteId}&nome=${encodeURIComponent(ag.ambienteNome)}&empresa=${empresaId}`); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: 'none', background: 'none', color: '#2563EB', fontSize: 13, cursor: 'pointer', width: '100%', textAlign: 'left' }}
                            >
                              <Building2 size={14} /> Ver Ambiente
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteAgendamento(ag); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: 'none', background: 'none', color: '#EF4444', fontSize: 13, cursor: 'pointer', width: '100%', textAlign: 'left' }}
                            >
                              <Trash2 size={14} /> Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Separator ──────────────────────────────────── */}
                    <div style={{ height: 1, backgroundColor: isActiveCard ? '#BFDBFE' : 'var(--border-light)', marginBottom: 12 }} />

                    {/* ── Environment info ────────────────────────────── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Building2 size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Sala:</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{ag.ambienteNome}</span>
                    </div>

                    {/* ── Peripheral info ─────────────────────────────── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                      {ag.perifericoTipo === 'ar_condicionado'
                        ? <Snowflake size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                        : <Zap size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                      }
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Periférico:</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{ag.perifericoNome}</span>
                      {/* Action badge */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 999,
                        fontSize: 11, fontWeight: 600, color: '#fff',
                        backgroundColor: ag.acao === 'ligar' ? '#22C55E' : '#EF4444',
                        marginLeft: 4,
                      }}>
                        <Power size={10} />
                        {ag.acao === 'ligar' ? 'Ligar' : 'Desligar'}
                      </span>
                    </div>

                    {/* ── Footer: date + time ─────────────────────────── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={13} /> <span>{ag.data}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={13} /> <span>{ag.horario}</span>
                      </div>
                    </div>

                    {/* ── Control button (active schedule) ────────────── */}
                    {isActiveCard && (
                      <div style={{
                        marginTop: 14, paddingTop: 14,
                        borderTop: '1px solid #BFDBFE',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-blue)' }}>Controlar agora:</span>
                        <button
                          disabled={toggleAgLoading[ag.id]}
                          onClick={() => handleToggleScheduledPeripheral(ag, true)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '7px 16px', borderRadius: 999,
                            fontSize: 13, fontWeight: 600, color: '#fff',
                            backgroundColor: '#22C55E', border: 'none', cursor: 'pointer',
                            opacity: toggleAgLoading[ag.id] ? 0.6 : 1,
                            transition: 'opacity 0.15s ease',
                          }}
                        >
                          <Power size={14} /> Ligar
                        </button>
                        <button
                          disabled={toggleAgLoading[ag.id]}
                          onClick={() => handleToggleScheduledPeripheral(ag, false)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '7px 16px', borderRadius: 999,
                            fontSize: 13, fontWeight: 600, color: '#fff',
                            backgroundColor: '#EF4444', border: 'none', cursor: 'pointer',
                            opacity: toggleAgLoading[ag.id] ? 0.6 : 1,
                            transition: 'opacity 0.15s ease',
                          }}
                        >
                          <Power size={14} /> Desligar
                        </button>
                      </div>
                    )}

                    {/* ── Inactive note (pending but not yet active) ──── */}
                    {ag.status === 'pendente' && !isActiveNow && (
                      <div style={{
                        marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-light)',
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic',
                      }}>
                        <Clock size={12} />
                        <span>Controle disponível no horário agendado</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ================================================================ */}
      {/*  MODAL: NEW ENVIRONMENT                                          */}
      {/* ================================================================ */}
      {showNewEnvModal && (
        <div className="modal-overlay" onClick={() => setShowNewEnvModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Novo Ambiente</h2>
            <p className="modal-subtitle">Adicione um novo ambiente para monitorar</p>
            <div className="modal-form-group">
              <label>Nome do Ambiente <span className="required">*</span></label>
              <input className="input-field" placeholder="Ex: Sala de Reunião 1" value={envNome} onChange={e => setEnvNome(e.target.value)} />
            </div>
            <div className="modal-form-group">
              <label>Tipo <span className="required">*</span></label>
              <input className="input-field" placeholder="Ex: Escritório/Sala de Reunião/Depósito" value={envTipo} onChange={e => setEnvTipo(e.target.value)} />
            </div>
            <div className="modal-form-row">
              <div className="modal-form-group">
                <label>Área (m²)</label>
                <input className="input-field" placeholder="Ex: 50" value={envArea} inputMode="numeric" onChange={e => { const val = e.target.value; if (val === '' || /^\d+$/.test(val)) setEnvArea(val); }} />
              </div>
              <div className="modal-form-group">
                <label>Capacidade</label>
                <input className="input-field" placeholder="Ex: 10" value={envCapacidade} inputMode="numeric" onChange={e => { const val = e.target.value; if (val === '' || /^\d+$/.test(val)) setEnvCapacidade(val); }} />
              </div>
            </div>
            <div className="modal-form-group">
              <label>Andar/Localização</label>
              <input className="input-field" placeholder="Ex: 2" value={envAndar} inputMode="numeric" onChange={e => { const val = e.target.value; if (val === '' || /^\d+$/.test(val)) setEnvAndar(val); }} />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowNewEnvModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreateEnv}>Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/*  MODAL: EDIT ENVIRONMENT                                         */}
      {/* ================================================================ */}
      {showEditEnvModal && (
        <div className="modal-overlay" onClick={() => setShowEditEnvModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Editar Ambiente</h2>
            <p className="modal-subtitle">Atualize as informações do ambiente</p>
            <div className="modal-form-group">
              <label>Nome do Ambiente <span className="required">*</span></label>
              <input className="input-field" placeholder="Ex: Sala de Reunião 1" value={editEnvNome} onChange={e => setEditEnvNome(e.target.value)} />
            </div>
            <div className="modal-form-group">
              <label>Tipo <span className="required">*</span></label>
              <input className="input-field" placeholder="Ex: Escritório/Sala de Reunião/Depósito" value={editEnvTipo} onChange={e => setEditEnvTipo(e.target.value)} />
            </div>
            <div className="modal-form-row">
              <div className="modal-form-group">
                <label>Área (m²)</label>
                <input className="input-field" placeholder="Ex: 50" value={editEnvArea} inputMode="numeric" onChange={e => { const val = e.target.value; if (val === '' || /^\d+$/.test(val)) setEditEnvArea(val); }} />
              </div>
              <div className="modal-form-group">
                <label>Capacidade</label>
                <input className="input-field" placeholder="Ex: 10" value={editEnvCapacidade} inputMode="numeric" onChange={e => { const val = e.target.value; if (val === '' || /^\d+$/.test(val)) setEditEnvCapacidade(val); }} />
              </div>
            </div>
            <div className="modal-form-group">
              <label>Andar/Localização</label>
              <input className="input-field" placeholder="Ex: 2" value={editEnvAndar} inputMode="numeric" onChange={e => { const val = e.target.value; if (val === '' || /^\d+$/.test(val)) setEditEnvAndar(val); }} />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowEditEnvModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleEditEnv}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/*  MODAL: SCHEDULE (CREATE)                                        */}
      {/* ================================================================ */}
      {showScheduleModal && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Agendar Sala</h2>
            <p className="modal-subtitle">Defina um horário para controle automático de periférico</p>

            {/* Ambiente */}
            <div className="modal-form-group">
              <label>Ambiente <span className="required">*</span></label>
              <select
                className="select-field"
                value={schedAmbiente}
                onChange={e => {
                  setSchedAmbiente(e.target.value);
                  setSchedPerifericoId('');
                  fetchPerifericosDoAmbiente(e.target.value);
                }}
              >
                <option value="">Selecione o ambiente</option>
                {ambientes.map(env => (
                  <option key={env.id} value={env.id}>{env.nome}</option>
                ))}
              </select>
            </div>

            {/* Título */}
            <div className="modal-form-group">
              <label>Título <span className="required">*</span></label>
              <input className="input-field" placeholder="Ex: Reunião de equipe" value={schedTitulo} onChange={e => setSchedTitulo(e.target.value)} />
            </div>

            {/* Descrição */}
            <div className="modal-form-group">
              <label>Descrição</label>
              <input className="input-field" placeholder="Descrição opcional..." value={schedDescricao} onChange={e => setSchedDescricao(e.target.value)} />
            </div>

            {/* Periférico */}
            <div className="modal-form-group">
              <label>Periférico <span className="required">*</span></label>
              <select
                className="select-field"
                value={schedPerifericoId}
                onChange={e => setSchedPerifericoId(e.target.value)}
                disabled={!schedAmbiente || loadingPerifericos}
              >
                <option value="">
                  {loadingPerifericos ? 'Carregando...' : !schedAmbiente ? 'Selecione o ambiente primeiro' : 'Selecione o periférico'}
                </option>
                {perifericosDoAmbiente.map(p => (
                  <option key={`${p.docId}_${p.nomeId}`} value={p.nomeId}>
                    {p.nome} ({p.tipo})
                  </option>
                ))}
              </select>
            </div>

            {/* Ação */}
            <div className="modal-form-group">
              <label>Ação <span className="required">*</span></label>
              <select className="select-field" value={schedAcao} onChange={e => setSchedAcao(e.target.value)}>
                <option value="ligar">Ligar</option>
                <option value="desligar">Desligar</option>
              </select>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <div
                  onClick={() => setSchedAcao('ligar')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 999,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    backgroundColor: schedAcao === 'ligar' ? '#DCFCE7' : '#F1F5F9',
                    color: schedAcao === 'ligar' ? '#16A34A' : '#64748B',
                    border: schedAcao === 'ligar' ? '1px solid #86EFAC' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Power size={12} style={{ color: schedAcao === 'ligar' ? '#16A34A' : '#64748B' }} /> Ligar
                </div>
                <div
                  onClick={() => setSchedAcao('desligar')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 999,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    backgroundColor: schedAcao === 'desligar' ? '#FEE2E2' : '#F1F5F9',
                    color: schedAcao === 'desligar' ? '#DC2626' : '#64748B',
                    border: schedAcao === 'desligar' ? '1px solid #FCA5A5' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Power size={12} style={{ color: schedAcao === 'desligar' ? '#DC2626' : '#64748B' }} /> Desligar
                </div>
              </div>
            </div>

            {/* Data */}
            <div className="modal-form-group">
              <label>Data <span className="required">*</span></label>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                {NEXT_14_DAYS.map(day => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => setSchedData(day.key)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      minWidth: 64, padding: '8px 6px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      backgroundColor: schedData === day.key ? '#2563EB' : '#F8FAFC',
                      color: schedData === day.key ? '#fff' : '#64748B',
                      transition: 'all 0.15s ease', flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 500 }}>{day.dayName}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{day.dayNum}</span>
                    <span style={{ fontSize: 10, fontWeight: 400 }}>{day.month}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Horário - Alarm Clock Style */}
            <div className="modal-form-group">
              <label>Horário <span className="required">*</span></label>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                position: 'relative',
                padding: '0 16px',
                paddingBottom: 8,
              }}>
                {/* Hours Column */}
                <div style={{
                  height: 150,
                  overflowY: 'auto',
                  scrollBehavior: 'smooth',
                  width: 80,
                  textAlign: 'center',
                  position: 'relative',
                }}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSchedHora(String(i).padStart(2, '0'))}
                      style={{
                        width: '100%',
                        padding: '8px 4px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: schedHora === String(i).padStart(2, '0') ? 22 : 16,
                        fontWeight: schedHora === String(i).padStart(2, '0') ? 700 : 400,
                        color: schedHora === String(i).padStart(2, '0') ? '#2563EB' : '#94A3B8',
                        backgroundColor: schedHora === String(i).padStart(2, '0') ? '#EFF6FF' : 'transparent',
                        borderRadius: 8,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {String(i).padStart(2, '0')}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#1E293B' }}>:</span>
                {/* Minutes Column */}
                <div style={{
                  height: 150,
                  overflowY: 'auto',
                  scrollBehavior: 'smooth',
                  width: 80,
                  textAlign: 'center',
                }}>
                  {Array.from({ length: 60 }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSchedMinuto(String(i).padStart(2, '0'))}
                      style={{
                        width: '100%',
                        padding: '8px 4px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: schedMinuto === String(i).padStart(2, '0') ? 22 : 16,
                        fontWeight: schedMinuto === String(i).padStart(2, '0') ? 700 : 400,
                        color: schedMinuto === String(i).padStart(2, '0') ? '#2563EB' : '#94A3B8',
                        backgroundColor: schedMinuto === String(i).padStart(2, '0') ? '#EFF6FF' : 'transparent',
                        borderRadius: 8,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {String(i).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 24, paddingTop: 16 }}>
              <button className="btn-secondary" onClick={() => { setShowScheduleModal(false); resetScheduleForm(); }}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreateSchedule}>Criar Agendamento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
