import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, setDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Plus, Calendar, Search, ChevronDown } from 'lucide-react';

export default function Ambientes() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const [ambientes, setAmbientes] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewEnvModal, setShowNewEnvModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  // New env form
  const [envNome, setEnvNome] = useState('');
  const [envTipo, setEnvTipo] = useState('');
  const [envArea, setEnvArea] = useState('');
  const [envCapacidade, setEnvCapacidade] = useState('');
  const [envAndar, setEnvAndar] = useState('');

  // Schedule form
  const [schedAmbiente, setSchedAmbiente] = useState('');
  const [schedTitulo, setSchedTitulo] = useState('');
  const [schedObjetivo, setSchedObjetivo] = useState('');
  const [schedData, setSchedData] = useState('');
  const [schedHorario, setSchedHorario] = useState('');

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
            temperatura: data.sensores?.temperatura || 0,
            umidade: data.sensores?.umidade || 0,
            aqi: data.sensores?.AQI || 0,
          });
        }
      });
      setAmbientes(envs);
      setLoading(false);
    });
    return () => unsub();
  }, [empresaId]);

  const filtered = ambientes.filter(e =>
    e.nome.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateEnv = async () => {
    if (!envNome || !envTipo) return;
    const safeId = envNome.replace(/[.#$\[\]]/g, '_').replace(/\s+/g, '_');

    await setDoc(doc(db, 'empresas', empresaId, 'ambientes', safeId), {
      tipo: envTipo, area: envArea, capacidade: envCapacidade, andar: envAndar,
      dados: { centralid: 'central1', criadoEm: new Date().toISOString(), nome: envNome, receptor_id: 'receptor1' },
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

  const handleSchedule = async () => {
    if (!schedAmbiente || !schedTitulo || !schedObjetivo) return;
    await addDoc(collection(db, 'empresas', empresaId, 'ambientes', schedAmbiente, 'agendamentos'), {
      titulo: schedTitulo,
      objetivo: schedObjetivo,
      data: schedData || 'A definir',
      horario: schedHorario || 'A definir',
      criadoEm: new Date().toISOString(),
    });
    setShowScheduleModal(false);
    setSchedAmbiente(''); setSchedTitulo(''); setSchedObjetivo(''); setSchedData(''); setSchedHorario('');
  };

  const handleDeleteEnv = async (id) => {
    if (!window.confirm('Tem certeza que deseja deletar este ambiente?')) return;
    await deleteDoc(doc(db, 'empresas', empresaId, 'ambientes', id));
    setOpenMenuId(null);
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Ambientes</h1>
          <p>Gerencie seus ambientes monitorados</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setShowScheduleModal(true)}>
            <Calendar size={16} /> Agendar Sala
          </button>
          <button className="btn-primary" onClick={() => setShowNewEnvModal(true)}>
            <Plus size={16} /> Novo Ambiente
          </button>
        </div>
      </div>

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
                    onClick={e => { e.stopPropagation(); handleDeleteEnv(env.id); }}
                    style={{ padding: '8px 16px', border: 'none', background: 'none', color: '#EF4444', fontSize: 13, cursor: 'pointer', display: 'block', width: '100%', textAlign: 'left' }}
                  >
                    Deletar
                  </button>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 16 }}>
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Environment Modal */}
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
                <input className="input-field" placeholder="Ex: 50" value={envArea} onChange={e => setEnvArea(e.target.value)} />
              </div>
              <div className="modal-form-group">
                <label>Capacidade</label>
                <input className="input-field" placeholder="Ex: 10" value={envCapacidade} onChange={e => setEnvCapacidade(e.target.value)} />
              </div>
            </div>
            <div className="modal-form-group">
              <label>Andar/Localização</label>
              <input className="input-field" placeholder="Ex: 2º Andar" value={envAndar} onChange={e => setEnvAndar(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowNewEnvModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreateEnv}>Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Agendar Sala</h2>
            <p className="modal-subtitle">Defina um horário para climatização de ambiente</p>

            <div className="modal-form-group">
              <label>Ambiente <span className="required">*</span></label>
              <select className="select-field" value={schedAmbiente} onChange={e => setSchedAmbiente(e.target.value)}>
                <option value="">Selecione o ambiente</option>
                {ambientes.map(env => (
                  <option key={env.id} value={env.id}>{env.nome}</option>
                ))}
              </select>
            </div>

            <div className="modal-form-group">
              <label>Título da Programação <span className="required">*</span></label>
              <input className="input-field" placeholder="Selecione o ambiente já cadastrado" value={schedTitulo} onChange={e => setSchedTitulo(e.target.value)} />
            </div>

            <div className="modal-form-group">
              <label>Objetivo da Programação <span className="required">*</span></label>
              <input className="input-field" placeholder="Ex: Discutir sobre custos energéticos" value={schedObjetivo} onChange={e => setSchedObjetivo(e.target.value)} />
            </div>

            <div className="modal-form-row">
              <div className="modal-form-group">
                <label>Data</label>
                <input className="input-field" placeholder="XX/XX/XXXX" value={schedData} onChange={e => setSchedData(e.target.value)} />
              </div>
              <div className="modal-form-group">
                <label>Horário</label>
                <input className="input-field" placeholder="XX:XX" value={schedHorario} onChange={e => setSchedHorario(e.target.value)} />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowScheduleModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSchedule}>Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
