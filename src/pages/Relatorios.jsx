import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Thermometer, Droplets, Wind, TrendingUp } from 'lucide-react';
import { AqiGauge } from '../components/Gauges';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Relatorios() {
  const { empresaId } = useAuth();
  const [historico, setHistorico] = useState([]);

  useEffect(() => {
    if (!empresaId) return;
    const q = query(
      collection(db, 'empresas', empresaId, 'historico_geral'),
      orderBy('timestamp', 'desc'),
      limit(6)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = [];
      snap.docs.reverse().forEach(d => data.push({ id: d.id, ...d.data() }));
      setHistorico(data);
    });
    return () => unsub();
  }, [empresaId]);

  const avgTemp = historico.length ? (historico.reduce((s, d) => s + (d.temperatura_media || 0), 0) / historico.length).toFixed(1) : '0';
  const minTemp = historico.length ? Math.min(...historico.map(d => d.temperatura_media || 0)).toFixed(1) : '0';
  const maxTemp = historico.length ? Math.max(...historico.map(d => d.temperatura_media || 0)).toFixed(1) : '0';

  const avgUmid = historico.length ? Math.round(historico.reduce((s, d) => s + (d.umidade_media || d.umidade || 0), 0) / historico.length) : 0;
  const minUmid = historico.length ? Math.min(...historico.map(d => d.umidade_media || d.umidade || 0)) : 0;
  const maxUmid = historico.length ? Math.max(...historico.map(d => d.umidade_media || d.umidade || 0)) : 0;

  const avgAqi = historico.length ? Math.round(historico.reduce((s, d) => s + (d.qual_do_ar || 0), 0) / historico.length) : 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Relatórios</h1>
        <p>Análise inteligente dos seus ambientes</p>
      </div>

      {/* Filters (visual only) */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <select className="select-field" style={{ maxWidth: 220 }} disabled>
          <option>Todos os ambientes</option>
        </select>
        <select className="select-field" style={{ maxWidth: 180 }} disabled>
          <option>Últimos 7 dias</option>
        </select>
      </div>

      {/* Comfort Gauge */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <AqiGauge value={avgAqi} />
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card" style={{ backgroundColor: '#FFF1F2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Thermometer size={18} color="#EF4444" />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>Temperatura</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1E293B' }}>Média: {avgTemp}°C</div>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Mín: {minTemp}°C / Máx: {maxTemp}°C</div>
          </div>

          <div className="card" style={{ backgroundColor: '#EFF6FF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Droplets size={18} color="#3B82F6" />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>Umidade</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1E293B' }}>Média: {avgUmid}%</div>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Mín: {minUmid}% / Máx: {maxUmid}%</div>
          </div>

          <div className="card" style={{ backgroundColor: '#F5F3FF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Wind size={18} color="#8B5CF6" />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>Qualidade do Ar</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1E293B' }}>Bom</div>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Índice: {avgAqi} AQI</div>
          </div>

          <div className="card" style={{ backgroundColor: '#ECFDF5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <TrendingUp size={18} color="#22C55E" />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>Tendência</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1E293B' }}>Estável</div>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Sem alterações significativas</div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Histórico de Temperatura e Umidade</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={historico}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="hora" tick={{ fontSize: 12 }} stroke="#94A3B8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="temperatura_media" name="Temperatura" stroke="#EF4444" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="umidade_media" name="Umidade" stroke="#3B82F6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
