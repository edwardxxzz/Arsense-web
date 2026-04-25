export function AqiGauge({ value }) {
  const radius = 70;
  const strokeWidth = 10;
  const center = radius + strokeWidth;
  const size = (radius + strokeWidth) * 2;

  // AQI gauge: 270° arc (from 135° to 405°)
  const startAngle = 135;
  const endAngle = 405;
  const totalAngle = endAngle - startAngle;

  const getColor = (val) => {
    if (val > 75) return '#22C55E';
    if (val >= 40) return '#EAB308';
    return '#EF4444';
  };

  const getLabel = (val) => {
    if (val > 75) return 'Excelente';
    if (val >= 40) return 'Bom';
    return 'Alerta';
  };

  const getBgColor = (val) => {
    if (val > 75) return '#F0FDF4';
    if (val >= 40) return '#FEFCE8';
    return '#FEF2F2';
  };

  const color = getColor(value);
  const label = getLabel(value);
  const bgColor = getBgColor(value);

  const progressAngle = startAngle + (totalAngle * Math.min(value, 100)) / 100;

  const polarToCartesian = (cx, cy, r, angleDeg) => {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(angleRad),
      y: cy + r * Math.sin(angleRad),
    };
  };

  const describeArc = (cx, cy, r, start, end) => {
    const startPt = polarToCartesian(cx, cy, r, end);
    const endPt = polarToCartesian(cx, cy, r, start);
    const largeArcFlag = end - start > 180 ? 1 : 0;
    return `M ${endPt.x} ${endPt.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${startPt.x} ${startPt.y}`;
  };

  const bgPath = describeArc(center, center, radius, startAngle, endAngle);
  const fgPath = describeArc(center, center, radius, startAngle, progressAngle);

  return (
    <div style={{ textAlign: 'center', backgroundColor: bgColor, borderRadius: 12, padding: 24 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={bgPath} fill="none" stroke="#E2E8F0" strokeWidth={strokeWidth} strokeLinecap="round" />
        <path d={fgPath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        <text x={center} y={center - 8} textAnchor="middle" fontSize="34" fontWeight="700" fill="#1E293B">
          {value}
        </text>
        <text x={center} y={center + 16} textAnchor="middle" fontSize="14" fill="#64748B">
          AQI
        </text>
      </svg>
      <div style={{ marginTop: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color }}>{label}</span>
      </div>
      <p style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
        Média de todos os ambientes controlados
      </p>
    </div>
  );
}

export function ComfortGauge({ value }) {
  const radius = 60;
  const strokeWidth = 8;
  const center = radius + strokeWidth;
  const size = (radius + strokeWidth) * 2;

  // Comfort gauge: full 360° circle
  const circumference = 2 * Math.PI * radius;
  const progress = (Math.min(value, 100) / 100) * circumference;

  const getColor = (val) => {
    if (val >= 80) return '#10B981';
    if (val >= 50) return '#F59E0B';
    return '#EF4444';
  };

  const getLabel = (val) => {
    if (val >= 80) return 'Excelente';
    if (val >= 50) return 'Regular';
    return 'Alerta';
  };

  const color = getColor(value);
  const label = getLabel(value);

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#E2E8F0" strokeWidth={strokeWidth} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          transform={`rotate(-90 ${center} ${center})`}
        />
        <text x={center} y={center - 4} textAnchor="middle" fontSize="28" fontWeight="700" fill="#1E293B">
          {value}
        </text>
        <text x={center} y={center + 18} textAnchor="middle" fontSize="12" fill="#64748B">
          Índice
        </text>
      </svg>
      <div style={{ marginTop: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color }}>{label}</span>
      </div>
      <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
        Baseado em temperatura, umidade, luminosidade e qualidade do ar
      </p>
    </div>
  );
}
