import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Thermometer, Droplets, Wind, Lightbulb, Download, FileDown } from 'lucide-react';
import { ComfortGauge } from '../components/Gauges';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const TIME_OPTIONS = [
  { key: '6h', label: 'Últimas 6 horas', hours: 6, limit: 36 },
  { key: '1d', label: 'Último 1 dia', hours: 24, limit: 144 },
  { key: '7d', label: 'Últimos 7 dias', hours: 168, limit: 336 },
];

export default function Relatorios() {
  const { empresaId, userData } = useAuth();
  const [historico, setHistorico] = useState([]);
  const [selectedTime, setSelectedTime] = useState('6h');
  const [selectedTimeLabel, setSelectedTimeLabel] = useState('Últimas 6 horas');
  const [loading, setLoading] = useState(true);

  // Ambientes
  const [ambientes, setAmbientes] = useState([]);
  const [selectedAmbienteId, setSelectedAmbienteId] = useState('');
  const [selectedAmbienteNome, setSelectedAmbienteNome] = useState('Selecione o ambiente');

  // Metrics
  const [indiceConforto, setIndiceConforto] = useState(0);
  const [tempMedia, setTempMedia] = useState(0);
  const [tempMin, setTempMin] = useState(0);
  const [tempMax, setTempMax] = useState(0);
  const [humMedia, setHumMedia] = useState(0);
  const [humMin, setHumMin] = useState(0);
  const [humMax, setHumMax] = useState(0);
  const [lumMedia, setLumMedia] = useState(0);
  const [lumMin, setLumMin] = useState(0);
  const [lumMax, setLumMax] = useState(0);
  const [qualArMedia, setQualArMedia] = useState(0);

  // PDF Modal
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportAmbienteId, setReportAmbienteId] = useState('');
  const [reportAmbienteNome, setReportAmbienteNome] = useState('');
  const [reportTime, setReportTime] = useState('1d');
  const [reportTimeLabel, setReportTimeLabel] = useState('Último 1 dia');
  const [isGenerating, setIsGenerating] = useState(false);

  const currentTimeOption = TIME_OPTIONS.find(o => o.key === selectedTime) || TIME_OPTIONS[0];

  // Load ambientes
  useEffect(() => {
    if (!empresaId) return;

    const loadAmbientes = async () => {
      try {
        const ambientesRef = collection(db, 'empresas', empresaId, 'ambientes');
        const ambSnap = await getDocs(ambientesRef);
        const lista = [];
        ambSnap.forEach(docSnap => {
          if (docSnap.id.toLowerCase() === 'ambiente_1') return;
          const amb = docSnap.data();
          lista.push({
            id: docSnap.id,
            nome: amb.dados?.nome || docSnap.id.replace(/_/g, ' ')
          });
        });
        setAmbientes(lista);

        // Auto-select first ambiente
        if (lista.length > 0 && !selectedAmbienteId) {
          setSelectedAmbienteId(lista[0].id);
          setSelectedAmbienteNome(lista[0].nome);
        }
      } catch (err) {
        console.error('Erro ao carregar ambientes:', err);
      }
    };

    loadAmbientes();
  }, [empresaId]);

  // Fetch per-ambiente history
  useEffect(() => {
    if (!empresaId || !selectedAmbienteId) return;
    setLoading(true);

    const historicoRef = collection(db, 'empresas', empresaId, 'ambientes', selectedAmbienteId, 'historico');
    const historicoQuery = query(
      historicoRef,
      orderBy('timestamp', 'desc'),
      limit(currentTimeOption.limit)
    );

    const unsub = onSnapshot(historicoQuery, (snap) => {
      if (snap.empty) {
        setIndiceConforto(0);
        setTempMedia(0); setTempMin(0); setTempMax(0);
        setHumMedia(0); setHumMin(0); setHumMax(0);
        setLumMedia(0); setLumMin(0); setLumMax(0);
        setQualArMedia(0);
        setHistorico([]);
        setLoading(false);
        return;
      }

      // Filter by time window
      const now = Date.now();
      const cutoff = now - (currentTimeOption.hours * 60 * 60 * 1000);
      const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const docs = allDocs.filter(d => {
        const ts = d.timestamp;
        if (!ts) return false;
        const ms = typeof ts === 'number' ? (ts > 1e12 ? ts : ts * 1000) : new Date(ts).getTime();
        return ms >= cutoff;
      });

      if (docs.length === 0) {
        setLoading(false);
        return;
      }

      // Most recent = index 0 (ordered desc)
      const maisRecente = docs[0];
      setIndiceConforto(maisRecente.indice_conforto || maisRecente.indice_geral || 0);

      // Air quality
      const arQualities = docs.map(d => Number(d.AQI || d.qual_do_ar || 0));
      const aqMedia = arQualities.length > 0 ? Math.round(arQualities.reduce((a, b) => a + b, 0) / arQualities.length) : 0;
      setQualArMedia(aqMedia);

      // Temperature
      const temps = docs.map(d => Number(d.temperatura || d.temperatura_media || 0));
      const tMedia = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
      setTempMedia(tMedia);
      setTempMin(Math.round(Math.min(...temps)));
      setTempMax(Math.round(Math.max(...temps)));

      // Humidity
      const hums = docs.map(d => Number(d.umidade || d.umidade_media || 0));
      const hMedia = Math.round(hums.reduce((a, b) => a + b, 0) / hums.length);
      setHumMedia(hMedia);
      setHumMin(Math.round(Math.min(...hums)));
      setHumMax(Math.round(Math.max(...hums)));

      // Luminosity
      const lums = docs.map(d => Number(d.luminosidade || 0));
      const lMedia = Math.round(lums.reduce((a, b) => a + b, 0) / lums.length);
      setLumMedia(lMedia);
      setLumMin(Math.round(Math.min(...lums)));
      setLumMax(Math.round(Math.max(...lums)));

      // Chart data - chronological order
      const chartData = [...docs].reverse().map(d => {
        let hora = '--';
        if (d.hora) {
          hora = d.hora;
        } else if (d.timestamp) {
          const ms = typeof d.timestamp === 'number' ? (d.timestamp > 1e12 ? d.timestamp : d.timestamp * 1000) : new Date(d.timestamp).getTime();
          const dateObj = new Date(ms);
          hora = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
        }
        return {
          ...d,
          hora,
          temperatura_media: Number(d.temperatura || d.temperatura_media || 0),
          umidade_media: Number(d.umidade || d.umidade_media || 0),
        };
      });

      setHistorico(chartData);
      setLoading(false);
    }, (error) => {
      console.error('Erro ao buscar histórico:', error);
      setLoading(false);
    });

    return () => unsub();
  }, [empresaId, selectedAmbienteId, selectedTime]);

  const getConfortoColor = (val) => val >= 80 ? '#10B981' : val >= 50 ? '#F59E0B' : '#EF4444';
  const getConfortoLabel = (val) => val >= 80 ? 'Excelente' : val >= 50 ? 'Regular' : 'Alerta';
  const getQualArLabel = (val) => val > 75 ? 'Excelente' : val >= 40 ? 'Bom' : 'Alerta';

  // ===== PDF GENERATION =====
  const handleGenerateReport = () => {
    setReportAmbienteId(selectedAmbienteId);
    setReportAmbienteNome(selectedAmbienteNome);
    setReportTime(selectedTime);
    setReportTimeLabel(selectedTimeLabel);
    setIsReportModalVisible(true);
  };

  const generatePDF = useCallback(async () => {
    if (!reportAmbienteId || !empresaId) {
      alert('Selecione um ambiente e um período.');
      return;
    }

    setIsGenerating(true);

    try {
      const currentTimeOption = TIME_OPTIONS.find(o => o.key === reportTime) || TIME_OPTIONS[0];
      const historicoRef = collection(db, 'empresas', empresaId, 'ambientes', reportAmbienteId, 'historico');
      const historicoQuery = query(historicoRef, orderBy('timestamp', 'desc'), limit(currentTimeOption.limit));
      const snap = await getDocs(historicoQuery);

      let tMedia = 0, tMin = 0, tMax = 0;
      let hMedia = 0, hMin = 0, hMax = 0;
      let lMedia = 0, lMin = 0, lMax = 0;
      let aqMedia = 0, aqMin = 0, aqMax = 0;
      let indiceConforto = 0, indiceMin = 100, indiceMax = 0;
      let totalDocs = 0;
      let alertas = [];
      let alertasResolvidos = [];

      // Limits for alerts
      const TEMP_MIN_OK = 18, TEMP_MAX_OK = 26;
      const HUM_MIN_OK = 40, HUM_MAX_OK = 60;
      const LUM_MIN_OK = 300, LUM_MAX_OK = 500;
      const AQ_MAX_OK = 50;

      if (!snap.empty) {
        const now = Date.now();
        const cutoff = now - (currentTimeOption.hours * 60 * 60 * 1000);
        const allDocs = snap.docs.map(d => d.data());
        const docs = allDocs.filter(d => {
          const ts = d.timestamp;
          if (!ts) return false;
          const ms = typeof ts === 'number' ? (ts > 1e12 ? ts : ts * 1000) : new Date(ts).getTime();
          return ms >= cutoff;
        });

        if (docs.length > 0) {
          totalDocs = docs.length;
          const indices = docs.map(d => Number(d.indice_conforto || d.indice_geral || 0));
          indiceConforto = indices[0];
          indiceMin = Math.round(Math.min(...indices));
          indiceMax = Math.round(Math.max(...indices));

          const arQualities = docs.map(d => Number(d.AQI || d.qual_do_ar || 0));
          aqMedia = arQualities.length > 0 ? Math.round(arQualities.reduce((a, b) => a + b, 0) / arQualities.length) : 0;
          aqMin = Math.round(Math.min(...arQualities));
          aqMax = Math.round(Math.max(...arQualities));

          const temps = docs.map(d => Number(d.temperatura || d.temperatura_media || 0));
          tMedia = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
          tMin = Math.round(Math.min(...temps));
          tMax = Math.round(Math.max(...temps));

          const hums = docs.map(d => Number(d.umidade || d.umidade_media || 0));
          hMedia = Math.round(hums.reduce((a, b) => a + b, 0) / hums.length);
          hMin = Math.round(Math.min(...hums));
          hMax = Math.round(Math.max(...hums));

          const lums = docs.map(d => Number(d.luminosidade || 0));
          lMedia = Math.round(lums.reduce((a, b) => a + b, 0) / lums.length);
          lMin = Math.round(Math.min(...lums));
          lMax = Math.round(Math.max(...lums));

          // Identify alerts and resolved alerts
          for (let i = 0; i < docs.length; i++) {
            const d = docs[i];
            const ts = d.timestamp;
            let horario = '--';
            if (ts) {
              const ms = typeof ts === 'number' ? (ts > 1e12 ? ts : ts * 1000) : new Date(ts).getTime();
              const dt = new Date(ms);
              horario = `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getFullYear()} ${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
            }

            const t = Number(d.temperatura || d.temperatura_media || 0);
            const h = Number(d.umidade || d.umidade_media || 0);
            const l = Number(d.luminosidade || 0);
            const aq = Number(d.AQI || d.qual_do_ar || 0);

            // Active alerts
            if (t < TEMP_MIN_OK || t > TEMP_MAX_OK) {
              alertas.push({ tipo: t < TEMP_MIN_OK ? 'Temperatura baixa' : 'Temperatura alta', valor: `${t}°C`, horario, parametro: 'Temperatura' });
            }
            if (h < HUM_MIN_OK || h > HUM_MAX_OK) {
              alertas.push({ tipo: h < HUM_MIN_OK ? 'Umidade baixa' : 'Umidade alta', valor: `${h}%`, horario, parametro: 'Umidade' });
            }
            if (l < LUM_MIN_OK || l > LUM_MAX_OK) {
              alertas.push({ tipo: l < LUM_MIN_OK ? 'Luminosidade baixa' : 'Luminosidade alta', valor: `${l} lux`, horario, parametro: 'Luminosidade' });
            }
            if (aq > AQ_MAX_OK) {
              alertas.push({ tipo: 'Qualidade do ar ruim', valor: `${aq} AQI`, horario, parametro: 'Qualidade do Ar' });
            }

            // Resolved alerts
            if (i < docs.length - 1) {
              const prev = docs[i + 1];
              const prevT = Number(prev.temperatura || prev.temperatura_media || 0);
              const prevH = Number(prev.umidade || prev.umidade_media || 0);
              const prevL = Number(prev.luminosidade || 0);
              const prevAq = Number(prev.AQI || prev.qual_do_ar || 0);

              if ((prevT < TEMP_MIN_OK || prevT > TEMP_MAX_OK) && t >= TEMP_MIN_OK && t <= TEMP_MAX_OK) {
                alertasResolvidos.push({ tipo: 'Temperatura normalizada', valor: `${t}°C`, horario, parametro: 'Temperatura' });
              }
              if ((prevH < HUM_MIN_OK || prevH > HUM_MAX_OK) && h >= HUM_MIN_OK && h <= HUM_MAX_OK) {
                alertasResolvidos.push({ tipo: 'Umidade normalizada', valor: `${h}%`, horario, parametro: 'Umidade' });
              }
              if ((prevL < LUM_MIN_OK || prevL > LUM_MAX_OK) && l >= LUM_MIN_OK && l <= LUM_MAX_OK) {
                alertasResolvidos.push({ tipo: 'Luminosidade normalizada', valor: `${l} lux`, horario, parametro: 'Luminosidade' });
              }
              if (prevAq > AQ_MAX_OK && aq <= AQ_MAX_OK) {
                alertasResolvidos.push({ tipo: 'Qualidade do ar normalizada', valor: `${aq} AQI`, horario, parametro: 'Qualidade do Ar' });
              }
            }
          }

          alertas = alertas.slice(0, 50);
          alertasResolvidos = alertasResolvidos.slice(0, 50);
        }
      }

      const confortoLabel = indiceConforto >= 80 ? 'Excelente' : indiceConforto >= 50 ? 'Regular' : 'Alerta';
      const qualArLabel = aqMedia > 75 ? 'Excelente' : aqMedia >= 40 ? 'Bom' : 'Alerta';
      const dataAtual = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const periodoInicio = new Date(Date.now() - (currentTimeOption.hours * 60 * 60 * 1000)).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const periodoFim = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

      const alertasPorTipo = {};
      alertas.forEach(a => { alertasPorTipo[a.parametro] = (alertasPorTipo[a.parametro] || 0) + 1; });
      const totalAlertas = alertas.length;
      const totalResolvidos = alertasResolvidos.length;

      const alertasTableRows = alertas.length > 0
        ? alertas.map(a => `<tr><td>${a.horario}</td><td>${a.tipo}</td><td>${a.valor}</td></tr>`).join('')
        : '<tr><td colspan="3" style="color:#10B981;">Nenhum alerta registrado no per\u00edodo</td></tr>';

      const resolvidosTableRows = alertasResolvidos.length > 0
        ? alertasResolvidos.map(a => `<tr><td>${a.horario}</td><td>${a.tipo}</td><td>${a.valor}</td></tr>`).join('')
        : '<tr><td colspan="3">Nenhum alerta resolvido no per\u00edodo</td></tr>';

      const userName = userData?.userName || 'Usu\u00e1rio';

      const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <style>
    @page {
      size: A4;
      margin: 3cm 2cm 2cm 3cm;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #000;
    }
    .capa {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      text-align: center;
      page-break-after: always;
    }
    .capa-instituicao {
      font-size: 14pt;
      margin-top: 2cm;
      margin-bottom: 0.5cm;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .capa-titulo {
      font-size: 16pt;
      font-weight: bold;
      margin-top: 8cm;
      margin-bottom: 1cm;
      text-transform: uppercase;
    }
    .capa-subtitulo {
      font-size: 12pt;
      margin-bottom: 0.5cm;
    }
    .capa-info {
      font-size: 12pt;
      margin-top: 5cm;
      text-align: center;
    }
    .capa-info p { margin: 0.2cm 0; }
    .capa-local-data {
      font-size: 12pt;
      margin-top: 3cm;
    }
    .sumario { page-break-after: always; }
    .sumario h1 { text-align: center; text-transform: uppercase; }
    .sumario-item {
      display: flex;
      justify-content: space-between;
      margin: 0.2cm 0;
      font-size: 12pt;
      border-bottom: 1px dotted #ccc;
      padding-bottom: 2px;
    }
    h1 { font-size: 14pt; font-weight: bold; margin-top: 1.5cm; margin-bottom: 0.5cm; }
    h2 { font-size: 12pt; font-weight: bold; margin-top: 1cm; margin-bottom: 0.3cm; }
    h3 { font-size: 11pt; font-weight: bold; margin-top: 0.8cm; margin-bottom: 0.2cm; }
    p { text-align: justify; text-indent: 1.25cm; margin-bottom: 0.3cm; }
    p.sem-indent { text-indent: 0; }
    table { width: 100%; border-collapse: collapse; margin: 0.5cm 0; font-size: 10pt; }
    table th, table td { border: 1px solid #000; padding: 6px 10px; }
    table th { background-color: #1e3a5f; color: #FFF; font-weight: bold; text-align: center; }
    table td { text-align: center; }
    table td.left { text-align: left; }
    .kpi-grid { display: flex; flex-wrap: wrap; gap: 8px; margin: 0.5cm 0; }
    .kpi-box { flex: 1; min-width: 45%; border: 1px solid #ddd; border-radius: 8px; padding: 10px; text-align: center; background: #f8fafc; }
    .kpi-value { font-size: 18pt; font-weight: bold; }
    .kpi-label { font-size: 8pt; color: #64748B; text-transform: uppercase; }
    .kpi-sub { font-size: 8pt; color: #94A3B8; }
    .verde { color: #10B981; }
    .amarelo { color: #F59E0B; }
    .vermelho { color: #EF4444; }
    .azul { color: #2563EB; }
    .badge-alerta { display: inline-block; background: #FEF2F2; color: #DC2626; font-size: 9pt; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
    .badge-ok { display: inline-block; background: #F0FDF4; color: #16A34A; font-size: 9pt; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
    .alerta-count { display: flex; gap: 12px; margin: 0.3cm 0; }
    .alerta-count-item { flex: 1; text-align: center; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px; }
    .alerta-count-num { font-size: 20pt; font-weight: bold; }
    .alerta-count-label { font-size: 9pt; color: #64748B; }
    .rodape { font-size: 9pt; color: #888; text-align: center; margin-top: 2cm; border-top: 1px solid #ccc; padding-top: 0.3cm; }
  </style>
</head>
<body>

  <!-- CAPA -->
  <div class="capa">
    <div class="capa-instituicao">Arsense</div>
    <div class="capa-titulo">Relat\u00f3rio de Monitoramento Ambiental</div>
    <div class="capa-subtitulo">Ambiente: <strong>${reportAmbienteNome}</strong></div>
    <div class="capa-subtitulo">Per\u00edodo: ${reportTimeLabel} (${periodoInicio} a ${periodoFim})</div>
    <div class="capa-info">
      <p>Total de leituras coletadas: <strong>${totalDocs}</strong></p>
      <p>\u00cdndice de conforto atual: <strong class="${indiceConforto >= 80 ? 'verde' : indiceConforto >= 50 ? 'amarelo' : 'vermelho'}">${indiceConforto}/100</strong></p>
      <p>Alertas no per\u00edodo: <strong class="${totalAlertas > 0 ? 'vermelho' : 'verde'}">${totalAlertas}</strong> | Resolvidos: <strong class="${totalResolvidos > 0 ? 'verde' : ''}">${totalResolvidos}</strong></p>
    </div>
    <div class="capa-local-data">
      <p>Respons\u00e1vel: ${userName}</p>
      <p>${dataAtual} - ${horaAtual}</p>
    </div>
  </div>

  <!-- SUM\u00c1RIO -->
  <div class="sumario">
    <h1>Sum\u00e1rio</h1>
    <div class="sumario-item"><span>1. Introdu\u00e7\u00e3o</span></div>
    <div class="sumario-item"><span>2. Vis\u00e3o Geral e Indicadores-Chave</span></div>
    <div class="sumario-item"><span>3. Dados Ambientais</span></div>
    <div class="sumario-item"><span>   3.1 Temperatura</span></div>
    <div class="sumario-item"><span>   3.2 Umidade</span></div>
    <div class="sumario-item"><span>   3.3 Luminosidade</span></div>
    <div class="sumario-item"><span>   3.4 \u00cdndice de Qualidade do Ar</span></div>
    <div class="sumario-item"><span>4. \u00cdndice de Conforto Ambiental</span></div>
    <div class="sumario-item"><span>5. Hist\u00f3rico de Alertas e Alertas Resolvidos</span></div>
  </div>

  <!-- 1. INTRODU\u00c7\u00c3O -->
  <h1>1. Introdu\u00e7\u00e3o</h1>
  <p>O presente relat\u00f3rio apresenta os resultados do monitoramento ambiental realizado pelo sistema Arsense no ambiente <strong>${reportAmbienteNome}</strong>, abrangendo o per\u00edodo de <strong>${reportTimeLabel}</strong> (${periodoInicio} a ${periodoFim}). Os par\u00e2metros analisados incluem temperatura, umidade relativa do ar, luminosidade e \u00edndice de qualidade do ar (AQI). Os dados foram obtidos por meio de sensores instalados no ambiente, com leituras peri\u00f3dicas e autom\u00e1ticas registradas na plataforma Arsense. Foram coletadas ${totalDocs} leituras no per\u00edodo analisado.</p>

  <!-- 2. VIS\u00c3O GERAL -->
  <h1>2. Vis\u00e3o Geral e Indicadores-Chave</h1>

  <div class="kpi-grid">
    <div class="kpi-box">
      <div class="kpi-label">Temperatura M\u00e9dia</div>
      <div class="kpi-value ${tMedia >= TEMP_MIN_OK && tMedia <= TEMP_MAX_OK ? 'verde' : 'vermelho'}">${tMedia}\u00b0C</div>
      <div class="kpi-sub">Min: ${tMin}\u00b0C | Max: ${tMax}\u00b0C</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Umidade M\u00e9dia</div>
      <div class="kpi-value ${hMedia >= HUM_MIN_OK && hMedia <= HUM_MAX_OK ? 'verde' : 'amarelo'}">${hMedia}%</div>
      <div class="kpi-sub">Min: ${hMin}% | Max: ${hMax}%</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Luminosidade M\u00e9dia</div>
      <div class="kpi-value ${lMedia >= LUM_MIN_OK && lMedia <= LUM_MAX_OK ? 'verde' : 'amarelo'}">${lMedia} lux</div>
      <div class="kpi-sub">Min: ${lMin} | Max: ${lMax}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Qualidade do Ar (AQI)</div>
      <div class="kpi-value ${aqMedia <= AQ_MAX_OK ? 'verde' : aqMedia <= 100 ? 'amarelo' : 'vermelho'}">${aqMedia}</div>
      <div class="kpi-sub">Classifica\u00e7\u00e3o: ${qualArLabel}</div>
    </div>
  </div>

  <div class="alerta-count">
    <div class="alerta-count-item" style="background:#FEF2F2;">
      <div class="alerta-count-num vermelho">${totalAlertas}</div>
      <div class="alerta-count-label">Alertas Registrados</div>
    </div>
    <div class="alerta-count-item" style="background:#F0FDF4;">
      <div class="alerta-count-num verde">${totalResolvidos}</div>
      <div class="alerta-count-label">Alertas Resolvidos</div>
    </div>
    <div class="alerta-count-item" style="background:#EFF6FF;">
      <div class="alerta-count-num azul">${indiceConforto}/100</div>
      <div class="alerta-count-label">\u00cdndice de Conforto</div>
    </div>
  </div>

  <!-- 3. DADOS AMBIENTAIS -->
  <h1>3. Dados Ambientais</h1>
  <p class="sem-indent">Resumo consolidado dos dados coletados no per\u00edodo:</p>

  <table>
    <tr>
      <th>Par\u00e2metro</th>
      <th>M\u00e9dia</th>
      <th>M\u00ednimo</th>
      <th>M\u00e1ximo</th>
      <th>Faixa Ideal</th>
      <th>Status</th>
    </tr>
    <tr>
      <td class="left">Temperatura</td>
      <td>${tMedia}\u00b0C</td>
      <td>${tMin}\u00b0C</td>
      <td>${tMax}\u00b0C</td>
      <td>${TEMP_MIN_OK}\u00b0C - ${TEMP_MAX_OK}\u00b0C</td>
      <td><span class="${tMedia >= TEMP_MIN_OK && tMedia <= TEMP_MAX_OK ? 'badge-ok' : 'badge-alerta'}">${tMedia >= TEMP_MIN_OK && tMedia <= TEMP_MAX_OK ? 'Normal' : 'Alerta'}</span></td>
    </tr>
    <tr>
      <td class="left">Umidade</td>
      <td>${hMedia}%</td>
      <td>${hMin}%</td>
      <td>${hMax}%</td>
      <td>${HUM_MIN_OK}% - ${HUM_MAX_OK}%</td>
      <td><span class="${hMedia >= HUM_MIN_OK && hMedia <= HUM_MAX_OK ? 'badge-ok' : 'badge-alerta'}">${hMedia >= HUM_MIN_OK && hMedia <= HUM_MAX_OK ? 'Normal' : 'Alerta'}</span></td>
    </tr>
    <tr>
      <td class="left">Luminosidade</td>
      <td>${lMedia} lux</td>
      <td>${lMin} lux</td>
      <td>${lMax} lux</td>
      <td>${LUM_MIN_OK} - ${LUM_MAX_OK} lux</td>
      <td><span class="${lMedia >= LUM_MIN_OK && lMedia <= LUM_MAX_OK ? 'badge-ok' : 'badge-alerta'}">${lMedia >= LUM_MIN_OK && lMedia <= LUM_MAX_OK ? 'Normal' : 'Alerta'}</span></td>
    </tr>
    <tr>
      <td class="left">Qualidade do Ar (AQI)</td>
      <td>${aqMedia}</td>
      <td>${aqMin}</td>
      <td>${aqMax}</td>
      <td>0 - ${AQ_MAX_OK}</td>
      <td><span class="${aqMedia <= AQ_MAX_OK ? 'badge-ok' : 'badge-alerta'}">${aqMedia <= AQ_MAX_OK ? 'Normal' : 'Alerta'}</span></td>
    </tr>
  </table>

  <h2>3.1 Temperatura</h2>
  <p>Temperatura m\u00e9dia: <strong>${tMedia}\u00b0C</strong> | M\u00ednima: ${tMin}\u00b0C | M\u00e1xima: ${tMax}\u00b0C | Amplitude: ${tMax - tMin}\u00b0C</p>

  <h2>3.2 Umidade</h2>
  <p>Umidade m\u00e9dia: <strong>${hMedia}%</strong> | M\u00ednima: ${hMin}% | M\u00e1xima: ${hMax}%</p>

  <h2>3.3 Luminosidade</h2>
  <p>Luminosidade m\u00e9dia: <strong>${lMedia} lux</strong> | M\u00ednima: ${lMin} lux | M\u00e1xima: ${lMax} lux</p>

  <h2>3.4 \u00cdndice de Qualidade do Ar</h2>
  <p>AQI m\u00e9dio: <strong>${aqMedia}</strong> (Min: ${aqMin} | Max: ${aqMax}) | Classifica\u00e7\u00e3o: <strong>${qualArLabel}</strong></p>

  <!-- 4. \u00cdNDICE DE CONFORTO -->
  <h1>4. \u00cdndice de Conforto Ambiental</h1>
  <table>
    <tr><th>Indicador</th><th>Valor</th></tr>
    <tr><td class="left">\u00cdndice Atual</td><td><strong class="${indiceConforto >= 80 ? 'verde' : indiceConforto >= 50 ? 'amarelo' : 'vermelho'}">${indiceConforto}/100</strong></td></tr>
    <tr><td class="left">Classifica\u00e7\u00e3o</td><td><strong>${confortoLabel}</strong></td></tr>
    <tr><td class="left">M\u00ednimo no Per\u00edodo</td><td>${indiceMin}/100</td></tr>
    <tr><td class="left">M\u00e1ximo no Per\u00edodo</td><td>${indiceMax}/100</td></tr>
  </table>

  <!-- 5. ALERTAS -->
  <h1>5. Hist\u00f3rico de Alertas e Alertas Resolvidos</h1>

  <h3>5.1 Alertas Registrados (${totalAlertas})</h3>
  <table>
    <tr><th>Data/Hora</th><th>Tipo de Alerta</th><th>Valor Registrado</th></tr>
    ${alertasTableRows}
  </table>

  <h3>5.2 Alertas Resolvidos (${totalResolvidos})</h3>
  <table>
    <tr><th>Data/Hora</th><th>Tipo</th><th>Valor Normalizado</th></tr>
    ${resolvidosTableRows}
  </table>

  ${totalAlertas > 0 ? `<p class="sem-indent"><strong>Resumo por par\u00e2metro:</strong> ${Object.entries(alertasPorTipo).map(([k, v]) => `${k}: ${v} ocorr\u00eancia(s)`).join(' | ')}</p>` : ''}

  <div class="rodape">Arsense - Monitoramento Inteligente de Ambientes | Relat\u00f3rio gerado em ${dataAtual} \u00e0s ${horaAtual}</div>
</body>
</html>`;

      // Open print window
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }

      setIsReportModalVisible(false);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('N\u00e3o foi poss\u00edvel gerar o relat\u00f3rio.');
    } finally {
      setIsGenerating(false);
    }
  }, [reportAmbienteId, reportAmbienteNome, reportTime, reportTimeLabel, empresaId, userData]);

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Relatórios</h1>
          <p>Análise inteligente dos seus ambientes</p>
        </div>
        <button
          className="btn-primary"
          onClick={handleGenerateReport}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Download size={18} />
          Gerar Relatório
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <select
          className="select-field"
          style={{ maxWidth: 220 }}
          value={selectedAmbienteId}
          onChange={e => {
            const amb = ambientes.find(a => a.id === e.target.value);
            setSelectedAmbienteId(e.target.value);
            setSelectedAmbienteNome(amb ? amb.nome : e.target.value);
          }}
        >
          {ambientes.length === 0 ? (
            <option value="">Nenhum ambiente encontrado</option>
          ) : (
            ambientes.map(amb => (
              <option key={amb.id} value={amb.id}>{amb.nome}</option>
            ))
          )}
        </select>
        <select
          className="select-field"
          style={{ maxWidth: 180 }}
          value={selectedTime}
          onChange={e => {
            setSelectedTime(e.target.value);
            const opt = TIME_OPTIONS.find(o => o.key === e.target.value);
            setSelectedTimeLabel(opt ? opt.label : '');
          }}
        >
          {TIME_OPTIONS.map(opt => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Comfort Gauge + Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ComfortGauge value={indiceConforto} />
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card" style={{ backgroundColor: '#FFF1F2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Thermometer size={18} color="#EF4444" />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>Temperatura</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1E293B' }}>Média: {tempMedia}°C</div>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Mín: {tempMin}°C / Máx: {tempMax}°C</div>
          </div>

          <div className="card" style={{ backgroundColor: '#EFF6FF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Droplets size={18} color="#3B82F6" />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>Umidade</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1E293B' }}>Média: {humMedia}%</div>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Mín: {humMin}% / Máx: {humMax}%</div>
          </div>

          <div className="card" style={{ backgroundColor: '#FFFBEB' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Lightbulb size={18} color="#F59E0B" />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>Luminosidade</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1E293B' }}>Média: {lumMedia} lux</div>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Mín: {lumMin} / Máx: {lumMax}</div>
          </div>

          <div className="card" style={{ backgroundColor: '#F5F3FF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Wind size={18} color="#8B5CF6" />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>Qualidade do Ar</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1E293B' }}>{getQualArLabel(qualArMedia)}</div>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Índice: {qualArMedia} AQI</div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          Histórico de Temperatura e Umidade — {currentTimeOption.label}
        </h3>
        {loading ? (
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          </div>
        ) : (
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
        )}
      </div>

      {/* PDF Report Modal */}
      {isReportModalVisible && (
        <div className="modal-overlay" onClick={() => setIsReportModalVisible(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileDown size={22} color="#2563EB" />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', margin: 0 }}>Gerar Relatório</h2>
                <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Configure o relatório em PDF</p>
              </div>
            </div>

            <div className="modal-form-group">
              <label>Ambiente</label>
              <select
                className="select-field"
                value={reportAmbienteId}
                onChange={e => {
                  setReportAmbienteId(e.target.value);
                  const amb = ambientes.find(a => a.id === e.target.value);
                  setReportAmbienteNome(amb ? amb.nome : e.target.value);
                }}
              >
                {ambientes.map(amb => (
                  <option key={amb.id} value={amb.id}>{amb.nome}</option>
                ))}
              </select>
            </div>

            <div className="modal-form-group">
              <label>Período</label>
              <select
                className="select-field"
                value={reportTime}
                onChange={e => {
                  setReportTime(e.target.value);
                  const opt = TIME_OPTIONS.find(o => o.key === e.target.value);
                  setReportTimeLabel(opt ? opt.label : '');
                }}
              >
                {TIME_OPTIONS.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div style={{ background: '#F8FAFC', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
                O relatório será gerado no padrão ABNT com capa, sumário, dados ambientais, índice de conforto e histórico de alertas.
              </p>
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setIsReportModalVisible(false)}
                disabled={isGenerating}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={generatePDF}
                disabled={isGenerating || !reportAmbienteId}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {isGenerating ? (
                  <>
                    <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Gerar PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
