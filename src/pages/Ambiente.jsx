import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, orderBy, limit, updateDoc, addDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Thermometer, Droplets, Sun, Snowflake, MoreVertical, Calendar, BellOff } from 'lucide-react';
import { ComfortGauge } from '../components/Gauges';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Ambiente() {
  const { empresaId } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ambienteId = searchParams.get('id');
  const ambienteNome = searchParams.get('nome') || '';
  const empresaParam = searchParams.get('empresa') || empresaId;

  const [ambiente, setAmbiente] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [perifericos, setPerifericos] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [activeTab, setActiveTab] = useState('historico');
  const [toggleLoading, setToggleLoading] = useState({});
  const [openMenuKey, setOpenMenuKey] = useState(null);

  // Periférico form
  const [showNewPeriphModal, setShowNewPeriphModal] = useState(false);
  const [periphNome, setPeriphNome] = useState('');
  const [periphTipo, setPeriphTipo] = useState('');
  const [periphMarca, setPeriphMarca] = useState('');
  const [periphCapacidade, setPeriphCapacidade] = useState('');

  useEffect(() => {
    if (!empresaParam || !ambienteId) return;

    const unsub1 = onSnapshot(doc(db, 'empresas', empresaParam, 'ambientes', ambienteId), (snap) => {
      if (snap.exists()) setAmbiente(snap.data());
    });

    const q = query(collection(db, 'empresas', empresaParam, 'ambientes', ambienteId, 'historico'), orderBy('timestamp', 'desc'), limit(5));
    const unsub2 = onSnapshot(q, (snap) => {
      const data = [];
      snap.docs.reverse().forEach(d => data.push({ id: d.id, ...d.data() }));
      setHistorico(data);
    });

    const unsub3 = onSnapshot(collection(db, 'empresas', empresaParam, 'ambientes', ambienteId, 'perifericos'), (snap) => {
      const list = [];
      snap.forEach(d => {
        const data = d.data();
        Object.keys(data).forEach(key => {
          if (!['geral', 'sensores', 'sensoresGerais', 'tipo', 'id'].includes(key)) {
            list.push({ deviceType: d.id, perifId: key, ...data[key] });
          }
        });
      });
      setPerifericos(list);
    });

    const unsub4 = onSnapshot(collection(db, 'empresas', empresaParam, 'ambientes', ambienteId, 'agendamentos'), (snap) => {
      const list = [];
      snap.forEach(d => {
        if (d.id !== 'registro_inicial') list.push({ id: d.id, ...d.data() });
      });
      setAgendamentos(list);
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [empresaParam, ambienteId]);

  const latestHist = historico.length > 0 ? historico[historico.length - 1] : null;
  const temp = latestHist?.temperatura || ambiente?.sensores?.temperatura || 0;
  const umid = latestHist?.umidade || ambiente?.sensores?.umidade || 0;
  const lum = latestHist?.luminosidade || ambiente?.sensores?.luminosidade || 0;
  const conforto = latestHist?.indice_conforto || latestHist?.indice_geral || 0;

  const handleTogglePeripheral = async (perif) => {
    const key = `${perif.deviceType}_${perif.perifId}`;
    setToggleLoading(prev => ({ ...prev, [key]: true }));
    try {
      const docRef = doc(db, 'empresas', empresaParam, 'ambientes', ambienteId, 'perifericos', perif.deviceType);
      const newState = !(perif.estado_desejado ?? perif.status ?? false);
      await updateDoc(docRef, { [`${perif.perifId}.estado_desejado`]: newState });
    } catch (e) {
      console.error('Erro ao alterar periférico:', e);
    }
    setToggleLoading(prev => ({ ...prev, [key]: false }));
  };

  const handleDeletePeripheral = async (perif) => {
    if (!window.confirm('Deletar este periférico?')) return;
    try {
      const docRef = doc(db, 'empresas', empresaParam, 'ambientes', ambienteId, 'perifericos', perif.deviceType);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        delete data[perif.perifId];
        await setDoc(docRef, data);
      }
    } catch (e) {
      console.error('Erro ao deletar periférico:', e);
    }
    setOpenMenuKey(null);
  };

  const handleCreatePeriph = async () => {
    if (!periphNome || !periphTipo || periphNome.toLowerCase() === 'geral') return;
    try {
      const docRef = doc(db, 'empresas', empresaParam, 'ambientes', ambienteId, 'perifericos', periphTipo);
      const snap = await getDoc(docRef);
      let existing = snap.exists() ? snap.data() : {};

      const safeKey = periphNome.replace(/[.#$\[\]]/g, '_').replace(/\s+/g, '_');
      existing[safeKey] = {
        nome: periphNome,
        estado_real: false,
        estado_desejado: false,
        marca: periphMarca || '',
        ...(periphTipo === 'ar_condicionado' ? { capacidade: periphCapacidade || '' } : {}),
        tipo: periphTipo,
      };

      await setDoc(docRef, existing);
      setShowNewPeriphModal(false);
      setPeriphNome(''); setPeriphTipo(''); setPeriphMarca(''); setPeriphCapacidade('');
    } catch (e) {
      console.error('Erro ao criar periférico:', e);
    }
  };

  if (!ambiente) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', gap: 16 }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 120, flex: 1, borderRadius: 12 }} className="skeleton" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{ambienteNome}</h1>
          <p style={{ fontSize: 14, color: '#6B7280' }}>
            {ambiente.config?.tipo || ambiente.tipo || 'Tipo'} &bull; {ambiente.config?.andar || ambiente.andar || ''}
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="metric-card">
          <div className="metric-card-icon"><Thermometer size={20} /></div>
          <div className="metric-card-label">Temperatura</div>
          <div className="metric-card-value">{temp}°C</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-icon"><Droplets size={20} /></div>
          <div className="metric-card-label">Umidade</div>
          <div className="metric-card-value">{umid}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-icon"><Sun size={20} /></div>
          <div className="metric-card-label">Luminosidade</div>
          <div className="metric-card-value">{lum} lux</div>
        </div>
        <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <ComfortGauge value={conforto} />
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-container">
        {['historico', 'perifericos', 'agendamentos'].map(tab => (
          <button key={tab} className={`tab-item ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'historico' ? 'Histórico' : tab === 'perifericos' ? 'Periféricos' : 'Agendamentos'}
          </button>
        ))}
      </div>

      {/* Tab: Histórico */}
      {activeTab === 'historico' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Histórico de Temperatura e Umidade</h3>
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
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Histórico de Luminosidade</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={historico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="hora" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="luminosidade" name="Luminosidade" stroke="#F59E0B" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab: Periféricos */}
      {activeTab === 'perifericos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn-primary" onClick={() => setShowNewPeriphModal(true)}>
              Novo Periférico
            </button>
          </div>

          {perifericos.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon"><Snowflake size={32} /></div>
                <h3>Nenhum periférico</h3>
                <p>Adicione periféricos para controlar este ambiente</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {perifericos.map(perif => {
                const key = `${perif.deviceType}_${perif.perifId}`;
                const isOn = perif.estado_desejado ?? perif.status ?? false;
                const isLoading = toggleLoading[key];
                return (
                  <div key={key} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, backgroundColor: '#E0F7FA',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06B6D4',
                    }}>
                      <Snowflake size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#1E293B' }}>{perif.nome || perif.perifId}</div>
                      <div style={{ fontSize: 13, color: '#64748B' }}>{perif.deviceType} &bull; {perif.marca || 'Sem marca'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 13, color: '#64748B' }}>{isOn ? 'Ligado' : 'Desligado'}</span>
                      {isLoading ? (
                        <div style={{ width: 44, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 16, height: 16, border: '2px solid #94A3B8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                        </div>
                      ) : (
                        <label className="toggle-switch">
                          <input type="checkbox" checked={isOn} onChange={() => handleTogglePeripheral(perif)} />
                          <span className="toggle-slider" />
                        </label>
                      )}
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={() => setOpenMenuKey(openMenuKey === key ? null : key)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}
                        >
                          <MoreVertical size={18} />
                        </button>
                        {openMenuKey === key && (
                          <div style={{ position: 'absolute', right: 0, top: 28, backgroundColor: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10, overflow: 'hidden' }}>
                            <button onClick={() => handleDeletePeripheral(perif)} style={{ padding: '8px 16px', border: 'none', background: 'none', color: '#EF4444', fontSize: 13, cursor: 'pointer', display: 'block', width: '100%', textAlign: 'left' }}>
                              Deletar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Agendamentos */}
      {activeTab === 'agendamentos' && (
        <div>
          {agendamentos.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon"><BellOff size={32} /></div>
                <h3>Nenhum agendamento no momento</h3>
                <p>Clique em Agendar Sala em "Ambientes".</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {agendamentos.map(ag => (
                <div key={ag.id} className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFF6FF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB',
                  }}>
                    <Calendar size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#1E293B' }}>{ag.titulo}</div>
                    <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{ag.objetivo}</div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13, color: '#64748B' }}>
                      <span>{ag.data}</span>
                      <span>{ag.horario}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Peripheral Modal */}
      {showNewPeriphModal && (
        <div className="modal-overlay" onClick={() => setShowNewPeriphModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Novo Periférico</h2>
            <p className="modal-subtitle">Adicione o dispositivo para o controle remoto</p>

            <div className="modal-form-group">
              <label>Nome <span className="required">*</span></label>
              <input className="input-field" placeholder="Ex: Ar Condicionado Principal" value={periphNome} onChange={e => setPeriphNome(e.target.value)} />
            </div>

            <div className="modal-form-group">
              <label>Tipo <span className="required">*</span></label>
              <select className="select-field" value={periphTipo} onChange={e => setPeriphTipo(e.target.value)}>
                <option value="">Selecione o tipo de periférico</option>
                <option value="ar_condicionado">Ar Condicionado</option>
                <option value="tomada">Tomada</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div className="modal-form-row">
              <div className="modal-form-group">
                <label>Marca</label>
                <input className="input-field" placeholder="Ex: LG" value={periphMarca} onChange={e => setPeriphMarca(e.target.value)} />
              </div>
              <div className="modal-form-group">
                <label>Capacidade</label>
                <input className="input-field" placeholder="Ex: S4-Q12" value={periphCapacidade} onChange={e => setPeriphCapacidade(e.target.value)} />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowNewPeriphModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreatePeriph}>Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
