import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, limit, setDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Thermometer, Droplets, Sun, Building2, RefreshCw, Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { AqiGauge } from '../components/Gauges';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Dashboard() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const [ambientes, setAmbientes] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [showNewEnvModal, setShowNewEnvModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showProfilePanel, setShowProfilePanel] = useState(false);

  // New env form
  const [newEnvNome, setNewEnvNome] = useState('');
  const [newEnvTipo, setNewEnvTipo] = useState('');
  const [newEnvArea, setNewEnvArea] = useState('');
  const [newEnvCapacidade, setNewEnvCapacidade] = useState('');
  const [newEnvAndar, setNewEnvAndar] = useState('');

  useEffect(() => {
    if (!empresaId) return;

    const unsub = onSnapshot(collection(db, 'empresas', empresaId, 'ambientes'), (snapshot) => {
      const envs = [];
      snapshot.forEach(doc => {
        if (doc.id.toLowerCase() !== 'ambiente_1') {
          const data = doc.data();
          envs.push({
            id: doc.id,
            nome: data.dados?.nome || doc.id,
            tipo: data.config?.tipo || data.tipo || '',
            andar: data.config?.andar || data.andar || '',
            temperatura: data.sensores?.temperatura || 0,
            umidade: data.sensores?.umidade || 0,
            luminosidade: data.sensores?.luminosidade || 0,
            aqi: data.sensores?.AQI || 0,
          });
        }
      });
      setAmbientes(envs);
    });

    return () => unsub();
  }, [empresaId, refreshKey]);

  useEffect(() => {
    if (!empresaId) return;

    const q = query(
      collection(db, 'empresas', empresaId, 'historico_geral'),
      orderBy('timestamp', 'desc'),
      limit(6)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.docs.reverse().forEach(doc => {
        const d = doc.data();
        data.push({
          hora: d.hora || '',
          temperatura: d.temperatura_media || 0,
          umidade: d.umidade_media || d.umidade || 0,
        });
      });
      setHistorico(data);
    });

    return () => unsub();
  }, [empresaId, refreshKey]);

  const avgTemp = ambientes.length ? (ambientes.reduce((s, e) => s + e.temperatura, 0) / ambientes.length).toFixed(1) : '0';
  const avgHumidity = ambientes.length ? Math.round(ambientes.reduce((s, e) => s + e.umidade, 0) / ambientes.length) : 0;
  const avgLuminosity = ambientes.length ? Math.round(ambientes.reduce((s, e) => s + e.luminosidade, 0) / ambientes.length) : 0;
  const avgAqi = ambientes.length ? Math.round(ambientes.reduce((s, e) => s + e.aqi, 0) / ambientes.length) : 0;

  const handleCreateEnv = async () => {
    if (!newEnvNome || !newEnvTipo) return;
    const safeId = newEnvNome.replace(/[.#$\[\]]/g, '_').replace(/\s+/g, '_');

    await setDoc(doc(db, 'empresas', empresaId, 'ambientes', safeId), {
      tipo: newEnvTipo,
      area: newEnvArea,
      capacidade: newEnvCapacidade,
      andar: newEnvAndar,
      dados: {
        centralid: 'central1',
        criadoEm: new Date().toISOString(),
        nome: newEnvNome,
        receptor_id: 'receptor1',
      },
      config: {
        tipo: newEnvTipo,
        area: newEnvArea,
        capacidade: newEnvCapacidade,
        andar: newEnvAndar,
      },
      sensores: {
        temperatura: 0,
        umidade: 0,
        luminosidade: 0,
        AQI: 0,
      },
    });

    // Create subcollections
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
    setNewEnvNome(''); setNewEnvTipo(''); setNewEnvArea(''); setNewEnvCapacidade(''); setNewEnvAndar('');
  };

  const handleDeleteEnv = async (id) => {
    if (!window.confirm('Tem certeza que deseja deletar este ambiente?')) return;
    await deleteDoc(doc(db, 'empresas', empresaId, 'ambientes', id));
    setOpenMenuId(null);
  };

  return (
    <>
      <div className="page-container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Dashboard</h1>
            <p>Visão geral de seus ambientes</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => setRefreshKey(k => k + 1)}>
              <RefreshCw size={16} /> Atualizar
            </button>
            <button className="btn-primary" onClick={() => setShowNewEnvModal(true)}>
              <Plus size={16} /> Novo Ambiente
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="metric-card">
            <div className="metric-card-icon"><Thermometer size={20} /></div>
            <div className="metric-card-label">Temperatura Média</div>
            <div className="metric-card-value">{avgTemp}°C</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-icon"><Droplets size={20} /></div>
            <div className="metric-card-label">Umidade Média</div>
            <div className="metric-card-value">{avgHumidity}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-icon"><Sun size={20} /></div>
            <div className="metric-card-label">Luminosidade Média</div>
            <div className="metric-card-value">{avgLuminosity} lux</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-icon"><Building2 size={20} /></div>
            <div className="metric-card-label">Ambientes Ativos</div>
            <div className="metric-card-value">{ambientes.length} Locais</div>
          </div>
        </div>

        {/* Chart + AQI Gauge */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Histórico das Últimas Horas</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={historico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="hora" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="temperatura" name="Temperatura" stroke="#EF4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="umidade" name="Umidade" stroke="#3B82F6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <AqiGauge value={avgAqi} />
          </div>
        </div>

        {/* Environments */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>Seus Ambientes</h3>
          <button
            onClick={() => navigate('/ambientes')}
            style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            Ver Todos <ChevronRight size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {ambientes.slice(0, 3).map(env => (
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
      </div>

      {/* New Environment Modal */}
      {showNewEnvModal && (
        <div className="modal-overlay" onClick={() => setShowNewEnvModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Novo Ambiente</h2>
            <p className="modal-subtitle">Adicione um novo ambiente para monitorar</p>

            <div className="modal-form-group">
              <label>Nome do Ambiente <span className="required">*</span></label>
              <input className="input-field" placeholder="Ex: Sala de Reunião 1" value={newEnvNome} onChange={e => setNewEnvNome(e.target.value)} />
            </div>

            <div className="modal-form-group">
              <label>Tipo <span className="required">*</span></label>
              <input className="input-field" placeholder="Ex: Escritório/Sala de Reunião/Depósito" value={newEnvTipo} onChange={e => setNewEnvTipo(e.target.value)} />
            </div>

            <div className="modal-form-row">
              <div className="modal-form-group">
                <label>Área (m²)</label>
                <input className="input-field" placeholder="Ex: 50" value={newEnvArea} onChange={e => setNewEnvArea(e.target.value)} />
              </div>
              <div className="modal-form-group">
                <label>Capacidade</label>
                <input className="input-field" placeholder="Ex: 10" value={newEnvCapacidade} onChange={e => setNewEnvCapacidade(e.target.value)} />
              </div>
            </div>

            <div className="modal-form-group">
              <label>Andar/Localização</label>
              <input className="input-field" placeholder="Ex: 2º Andar" value={newEnvAndar} onChange={e => setNewEnvAndar(e.target.value)} />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowNewEnvModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreateEnv}>Criar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
