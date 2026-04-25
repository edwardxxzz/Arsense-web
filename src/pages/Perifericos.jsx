import { useState, useEffect } from 'react';
import { collection, getDocs, doc, onSnapshot, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Plus, Snowflake, Sun, MoreVertical } from 'lucide-react';

export default function Perifericos() {
  const { empresaId } = useAuth();
  const [perifericos, setPerifericos] = useState([]);
  const [ambientes, setAmbientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState({});
  const [openMenuKey, setOpenMenuKey] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Form
  const [nome, setNome] = useState('');
  const [ambiente, setAmbiente] = useState('');
  const [tipo, setTipo] = useState('');
  const [marca, setMarca] = useState('');
  const [capacidade, setCapacidade] = useState('');
  const [tipoInput, setTipoInput] = useState('');
  const [ip, setIp] = useState('');

  useEffect(() => {
    if (!empresaId) return;

    const loadData = async () => {
      const ambSnap = await getDocs(collection(db, 'empresas', empresaId, 'ambientes'));
      const ambList = [];
      const allPerifs = [];

      for (const ambDoc of ambSnap.docs) {
        if (ambDoc.id.toLowerCase() === 'ambiente_1') continue;
        const ambData = ambDoc.data();
        const ambName = ambData.dados?.nome || ambDoc.id;
        ambList.push({ id: ambDoc.id, nome: ambName });

        const perSnap = await getDocs(collection(db, 'empresas', empresaId, 'ambientes', ambDoc.id, 'perifericos'));
        perSnap.forEach(pDoc => {
          const data = pDoc.data();
          Object.keys(data).forEach(key => {
            if (!['geral', 'sensores', 'sensoresGerais', 'tipo', 'id'].includes(key)) {
              allPerifs.push({
                deviceType: pDoc.id,
                perifId: key,
                ambienteId: ambDoc.id,
                ambienteNome: ambName,
                ...data[key],
              });
            }
          });
        });
      }

      setAmbientes(ambList);
      setPerifericos(allPerifs);
      setLoading(false);
    };

    loadData();
  }, [empresaId]);

  // Real-time listeners for each peripheral
  useEffect(() => {
    if (!empresaId || perifericos.length === 0) return;

    const unsubs = perifericos.map(perif => {
      return onSnapshot(doc(db, 'empresas', empresaId, 'ambientes', perif.ambienteId, 'perifericos', perif.deviceType), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const updated = data[perif.perifId];
          if (updated) {
            setPerifericos(prev => prev.map(p =>
              p.deviceType === perif.deviceType && p.perifId === perif.perifId
                ? { ...p, estado_desejado: updated.estado_desejado, estado_real: updated.estado_real }
                : p
            ));
          }
        }
      });
    });

    return () => unsubs.forEach(u => u());
  }, [empresaId, perifericos.length]);

  const handleToggle = async (perif) => {
    const key = `${perif.ambienteId}_${perif.deviceType}_${perif.perifId}`;
    setToggleLoading(prev => ({ ...prev, [key]: true }));
    try {
      const docRef = doc(db, 'empresas', empresaId, 'ambientes', perif.ambienteId, 'perifericos', perif.deviceType);
      const newState = !(perif.estado_desejado ?? perif.status ?? false);
      await updateDoc(docRef, { [`${perif.perifId}.estado_desejado`]: newState });
    } catch (e) {
      console.error('Erro:', e);
    }
    setToggleLoading(prev => ({ ...prev, [key]: false }));
  };

  const handleDelete = async (perif) => {
    if (!window.confirm('Deletar este periférico?')) return;
    try {
      const docRef = doc(db, 'empresas', empresaId, 'ambientes', perif.ambienteId, 'perifericos', perif.deviceType);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        delete data[perif.perifId];
        await setDoc(docRef, data);
      }
    } catch (e) {
      console.error('Erro ao deletar:', e);
    }
    setOpenMenuKey(null);
    // Reload
    setPerifericos(prev => prev.filter(p => !(p.deviceType === perif.deviceType && p.perifId === perif.perifId)));
  };

  const handleCreate = async () => {
    if (!nome || !ambiente || !tipo) return;
    if (nome.toLowerCase() === 'geral') return;

    const effectiveTipo = tipo === 'outro' ? tipoInput.replace(/[.#$\[\]]/g, '_').replace(/\s+/g, '_') : tipo;

    try {
      const docRef = doc(db, 'empresas', empresaId, 'ambientes', ambiente, 'perifericos', effectiveTipo);
      const snap = await getDoc(docRef);
      let existing = snap.exists() ? snap.data() : {};

      const safeKey = nome.replace(/[.#$\[\]]/g, '_').replace(/\s+/g, '_');
      existing[safeKey] = {
        nome,
        estado_real: false,
        estado_desejado: false,
        marca: marca || '',
        ...(effectiveTipo === 'ar_condicionado' ? { capacidade: capacidade || '' } : {}),
        ...(effectiveTipo === 'tomada' ? { tipo: tipoInput || '220v', ip: ip || '' } : {}),
        tipo: effectiveTipo,
      };

      await setDoc(docRef, existing);
      setShowModal(false);
      setNome(''); setAmbiente(''); setTipo(''); setMarca(''); setCapacidade(''); setTipoInput(''); setIp('');

      // Reload data
      window.location.reload();
    } catch (e) {
      console.error('Erro ao criar:', e);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Periféricos</h1>
          <p>Controle seus dispositivos conectados</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Novo Periférico
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: 80, borderRadius: 12 }} className="skeleton" />)}
        </div>
      ) : perifericos.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><Snowflake size={32} /></div>
            <h3>Nenhum periférico</h3>
            <p>Adicione periféricos para controlar seus ambientes</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {perifericos.map(perif => {
            const key = `${perif.ambienteId}_${perif.deviceType}_${perif.perifId}`;
            const isOn = perif.estado_desejado ?? perif.status ?? false;
            const isLoading = toggleLoading[key];
            return (
              <div key={key} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, backgroundColor: '#E0F7FA',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06B6D4',
                }}>
                  {perif.deviceType === 'ar_condicionado' ? <Snowflake size={22} /> : <Sun size={22} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#1E293B' }}>{perif.nome || perif.perifId}</div>
                  <div style={{ fontSize: 13, color: '#64748B' }}>
                    {perif.deviceType} &bull; {perif.ambienteNome} &bull; {perif.marca || 'Sem marca'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: '#64748B' }}>{isOn ? 'Ligado' : 'Desligado'}</span>
                  {isLoading ? (
                    <div style={{ width: 44, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 16, height: 16, border: '2px solid #94A3B8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    </div>
                  ) : (
                    <label className="toggle-switch">
                      <input type="checkbox" checked={isOn} onChange={() => handleToggle(perif)} />
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
                        <button onClick={() => handleDelete(perif)} style={{ padding: '8px 16px', border: 'none', background: 'none', color: '#EF4444', fontSize: 13, cursor: 'pointer', display: 'block', width: '100%', textAlign: 'left' }}>
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

      {/* New Peripheral Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Novo Periférico</h2>
            <p className="modal-subtitle">Adicione o dispositivo para o controle remoto</p>

            <div className="modal-form-group">
              <label>Nome <span className="required">*</span></label>
              <input className="input-field" placeholder="Ex: Ar Condicionado Principal" value={nome} onChange={e => setNome(e.target.value)} />
            </div>

            <div className="modal-form-group">
              <label>Ambiente <span className="required">*</span></label>
              <select className="select-field" value={ambiente} onChange={e => setAmbiente(e.target.value)}>
                <option value="">Selecione o ambiente já cadastrado</option>
                {ambientes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>

            <div className="modal-form-group">
              <label>Tipo <span className="required">*</span></label>
              <select className="select-field" value={tipo} onChange={e => setTipo(e.target.value)}>
                <option value="">Selecione o tipo de periférico</option>
                <option value="ar_condicionado">Ar Condicionado</option>
                <option value="tomada">Tomada</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            {tipo === 'ar_condicionado' && (
              <div className="modal-form-row">
                <div className="modal-form-group">
                  <label>Marca</label>
                  <input className="input-field" placeholder="Ex: LG" value={marca} onChange={e => setMarca(e.target.value)} />
                </div>
                <div className="modal-form-group">
                  <label>Capacidade</label>
                  <input className="input-field" placeholder="Ex: S4-Q12" value={capacidade} onChange={e => setCapacidade(e.target.value)} />
                </div>
              </div>
            )}

            {tipo === 'tomada' && (
              <div className="modal-form-row">
                <div className="modal-form-group">
                  <label>Tipo</label>
                  <input className="input-field" placeholder="Ex: 220v" value={tipoInput} onChange={e => setTipoInput(e.target.value)} />
                </div>
                <div className="modal-form-group">
                  <label>IP</label>
                  <input className="input-field" placeholder="Ex: 192.168.1.1" value={ip} onChange={e => setIp(e.target.value)} />
                </div>
              </div>
            )}

            {tipo === 'outro' && (
              <div className="modal-form-row">
                <div className="modal-form-group">
                  <label>Especifique o Tipo</label>
                  <input className="input-field" placeholder="Ex: Ventilador" value={tipoInput} onChange={e => setTipoInput(e.target.value)} />
                </div>
                <div className="modal-form-group">
                  <label>Marca</label>
                  <input className="input-field" placeholder="Ex: Arno" value={marca} onChange={e => setMarca(e.target.value)} />
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreate}>Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
