import React, { useState, useMemo, useEffect } from 'react';

// Color Palette utilities for Bklit Charts
const BKLIT_COLORS = [
  '#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#14b8a6'
];

// Bklit Tooltip Component
export const ChartTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: '8px',
      fontSize: '12px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      pointerEvents: 'none',
      zIndex: 50
    }}>
      {label && <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>{label}</div>}
      {payload.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: idx > 0 ? '2px' : 0 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color || '#0284c7' }} />
          <span style={{ color: '#cbd5e1' }}>{item.name || item.dataKey}:</span>
          <strong style={{ color: '#fff' }}>
            {formatter ? formatter(item.value) : item.value}
          </strong>
        </div>
      ))}
    </div>
  );
};

// Bklit Chart Legend
export const ChartLegend = ({ payload = [] }) => {
  if (!payload || !payload.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px', marginTop: '12px', fontSize: '12px' }}>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: entry.color }} />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{entry.value || entry.name}</span>
        </div>
      ))}
    </div>
  );
};

// SVG Grid Lines
export const Grid = ({ horizontal = true, vertical = false, color = 'var(--border)' }) => (
  <g opacity={0.35}>
    {horizontal && (
      <>
        <line x1="0" y1="25%" x2="100%" y2="25%" stroke={color} strokeDasharray="3 3" />
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke={color} strokeDasharray="3 3" />
        <line x1="0" y1="75%" x2="100%" y2="75%" stroke={color} strokeDasharray="3 3" />
      </>
    )}
  </g>
);

// XAxis
export const XAxis = ({ ticks = [], dataKey = 'date' }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 4px 0 4px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
    {ticks.map((t, i) => (
      <span key={i}>{typeof t === 'object' ? t[dataKey] : t}</span>
    ))}
  </div>
);

// YAxis
export const YAxis = ({ min = 0, max = 100, formatter }) => (
  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: '8px', fontSize: '10px', color: 'var(--text-tertiary)', textAlign: 'right' }}>
    <span>{formatter ? formatter(max) : max}</span>
    <span>{formatter ? formatter((max + min) / 2) : Math.round((max + min) / 2)}</span>
    <span>{formatter ? formatter(min) : min}</span>
  </div>
);

// 1. AREA CHART
export const AreaChart = ({
  data = [],
  xDataKey = 'date',
  dataKey = 'value',
  color = '#0284c7',
  fillOpacity = 0.35,
  height = 200,
  animationDuration = 300,
  xDomain,
  xDomainSlotCount,
  tweenYDomainOnXDomainChange = true
}) => {
  const [hoverIndex, setHoverIndex] = useState(null);
  const displayData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (!xDomain || xDomain.length < 2) return data;
    const startIdx = Math.floor((xDomain[0] / 100) * data.length);
    const endIdx = Math.ceil((xDomain[1] / 100) * data.length);
    return data.slice(Math.max(0, startIdx), Math.min(data.length, endIdx));
  }, [data, xDomain]);

  if (!displayData.length) return <EmptyBklitChart height={height} />;

  const values = displayData.map(d => Number(d[dataKey] || 0));
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);

  const points = displayData.map((d, i) => {
    const x = displayData.length === 1 ? 50 : (i / (displayData.length - 1)) * 100;
    const val = Number(d[dataKey] || 0);
    const y = 100 - ((val - minVal) / (maxVal - minVal || 1)) * 80 - 10;
    return `${x},${y}`;
  });

  const svgPath = points.length > 0 ? `M ${points[0]} ` + points.slice(1).map(p => `L ${p}`).join(' ') : '';
  const areaPath = points.length > 0 ? `${svgPath} L 100,100 L 0,100 Z` : '';
  const gradId = `bklit-area-${Math.random().toString(36).substr(2, 6)}`;

  return (
    <div style={{ position: 'relative', width: '100%', height }} onMouseLeave={() => setHoverIndex(null)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Grid />
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={svgPath} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        {displayData.map((d, i) => {
          const x = displayData.length === 1 ? 50 : (i / (displayData.length - 1)) * 100;
          const val = Number(d[dataKey] || 0);
          const y = 100 - ((val - minVal) / (maxVal - minVal || 1)) * 80 - 10;
          return (
            <circle key={i} cx={`${x}%`} cy={`${y}%`} r="3.5" fill={color} stroke="#fff" strokeWidth="1.5" style={{ cursor: 'pointer' }} onMouseEnter={() => setHoverIndex(i)} />
          );
        })}
      </svg>
      {hoverIndex !== null && displayData[hoverIndex] && (
        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
          <ChartTooltip active={true} label={displayData[hoverIndex][xDataKey]} payload={[{ name: dataKey, value: displayData[hoverIndex][dataKey], color }]} />
        </div>
      )}
    </div>
  );
};

// 2. BAR CHART
export const BarChart = ({ data = [], xDataKey = 'name', dataKey = 'value', color = '#0284c7', height = 200, horizontal = false }) => {
  const [hoverIndex, setHoverIndex] = useState(null);
  if (!data || !data.length) return <EmptyBklitChart height={height} />;

  const values = data.map(d => Number(d[dataKey] || 0));
  const maxVal = Math.max(...values, 1);

  return (
    <div style={{ position: 'relative', width: '100%', height, display: 'flex', flexDirection: horizontal ? 'column' : 'row', alignItems: horizontal ? 'stretch' : 'flex-end', gap: '8px', padding: '16px 8px 8px 8px' }} onMouseLeave={() => setHoverIndex(null)}>
      {data.map((item, i) => {
        const val = Number(item[dataKey] || 0);
        const pct = Math.max(4, (val / maxVal) * 100);
        const barColor = item.color || color;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: horizontal ? 'row' : 'column', alignItems: 'center', height: horizontal ? 'auto' : '100%', justifyContent: 'flex-end', gap: '4px' }} onMouseEnter={() => setHoverIndex(i)}>
            <div style={{
              width: horizontal ? `${pct}%` : '80%',
              height: horizontal ? '20px' : `${pct}%`,
              background: `linear-gradient(180deg, ${barColor}, ${barColor}dd)`,
              borderRadius: '4px',
              transition: 'all 0.2s ease',
              boxShadow: hoverIndex === i ? `0 4px 12px ${barColor}66` : 'none'
            }} />
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
              {item[xDataKey]}
            </span>
          </div>
        );
      })}
      {hoverIndex !== null && data[hoverIndex] && (
        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
          <ChartTooltip active={true} label={data[hoverIndex][xDataKey]} payload={[{ name: dataKey, value: data[hoverIndex][dataKey], color: data[hoverIndex].color || color }]} />
        </div>
      )}
    </div>
  );
};

// 3. CANDLESTICK CHART
export const CandlestickChart = ({ data = [], height = 220, upColor = '#16a34a', downColor = '#ef4444' }) => {
  if (!data || !data.length) return <EmptyBklitChart height={height} />;
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const maxVal = Math.max(...highs, 1);
  const minVal = Math.min(...lows, 0);
  const range = maxVal - minVal || 1;

  return (
    <div style={{ width: '100%', height, position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '6px', padding: '16px 8px 8px 8px' }}>
      {data.map((d, i) => {
        const isUp = d.close >= d.open;
        const color = isUp ? upColor : downColor;
        const bodyTop = 100 - ((Math.max(d.open, d.close) - minVal) / range) * 80 - 10;
        const bodyBottom = 100 - ((Math.min(d.open, d.close) - minVal) / range) * 80 - 10;
        const wickTop = 100 - ((d.high - minVal) / range) * 80 - 10;
        const wickBottom = 100 - ((d.low - minVal) / range) * 80 - 10;
        const bodyHeight = Math.max(4, bodyBottom - bodyTop);

        return (
          <div key={i} style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', justifyContent: 'center' }}>
            {/* Wick */}
            <div style={{ position: 'absolute', top: `${wickTop}%`, bottom: `${100 - wickBottom}%`, width: '2px', background: color }} />
            {/* Body */}
            <div style={{ position: 'absolute', top: `${bodyTop}%`, height: `${bodyHeight}%`, width: '70%', background: color, borderRadius: '2px', boxShadow: `0 2px 6px ${color}44` }} />
          </div>
        );
      })}
    </div>
  );
};

// 4. CHOROPLETH CHART
export const ChoroplethChart = ({ data = [], height = 220, title = 'Geographic Regional Distribution' }) => {
  const regions = data.length ? data : [
    { region: 'North America', code: 'NA', value: 85, color: '#0284c7' },
    { region: 'Europe', code: 'EU', value: 64, color: '#10b981' },
    { region: 'Asia Pacific', code: 'APAC', value: 92, color: '#8b5cf6' },
    { region: 'Latin America', code: 'LATAM', value: 40, color: '#f59e0b' },
    { region: 'Middle East & Africa', code: 'MEA', value: 28, color: '#ef4444' }
  ];

  return (
    <div style={{ width: '100%', height, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat( auto-fit, minmax(130px, 1fr) )', gap: '10px' }}>
        {regions.map((r, i) => (
          <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>{r.region}</span>
              <span style={{ fontSize: '10px', background: r.color || '#0284c7', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>{r.code}</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: r.color || '#0284c7', marginTop: '4px' }}>{r.value}</div>
            <div style={{ height: '4px', width: '100%', background: 'rgba(0,0,0,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, r.value)}%`, background: r.color || '#0284c7', borderRadius: '2px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 5. COMPOSED CHART
export const ComposedChart = ({ data = [], xDataKey = 'name', series = [], height = 220 }) => {
  if (!data || !data.length) return <EmptyBklitChart height={height} />;
  return (
    <div style={{ width: '100%', height, position: 'relative', padding: '16px 8px 8px 8px' }}>
      <BarChart data={data} xDataKey={xDataKey} dataKey={series[0]?.key || 'value'} color={series[0]?.color || '#0284c7'} height={height - 30} />
      <ChartLegend payload={series.map(s => ({ value: s.label || s.key, color: s.color }))} />
    </div>
  );
};

// 6. FUNNEL CHART
export const FunnelChart = ({ data = [], height = 220 }) => {
  const stages = data.length ? data : [
    { label: 'Impressions', value: 10000, color: '#0284c7' },
    { label: 'Clicks', value: 4200, color: '#06b6d4' },
    { label: 'Leads', value: 1800, color: '#10b981' },
    { label: 'Conversions', value: 650, color: '#8b5cf6' }
  ];
  const maxVal = Math.max(...stages.map(s => s.value), 1);

  return (
    <div style={{ width: '100%', height, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center', padding: '12px' }}>
      {stages.map((st, i) => {
        const widthPct = Math.max(20, (st.value / maxVal) * 100);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '90px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>{st.label}</span>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <div style={{
                width: `${widthPct}%`,
                height: '28px',
                background: `linear-gradient(90deg, ${st.color || '#0284c7'}, ${st.color || '#0284c7'}bb)`,
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justify: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: '11px',
                boxShadow: `0 3px 8px ${st.color || '#0284c7'}44`
              }}>
                {st.value.toLocaleString()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 7. GAUGE CHART
export const GaugeChart = ({ value = 75, min = 0, max = 100, label = 'Completion Rate', height = 180, color = '#0284c7' }) => {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const angle = (pct / 100) * 180;

  return (
    <div style={{ width: '100%', height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <svg viewBox="0 0 100 60" style={{ width: '160px', height: '90px' }}>
        <path d="M 10,50 A 40,40 0 0,1 90,50" fill="none" stroke="var(--border)" strokeWidth="10" strokeLinecap="round" />
        <path d="M 10,50 A 40,40 0 0,1 90,50" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset={125.6 - (125.6 * pct) / 100} style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div style={{ marginTop: '-20px', textAlign: 'center' }}>
        <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>{value}%</div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
};

// 8. HEATMAP CHART
export const HeatmapChart = ({ data = [], rows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], cols = ['9AM', '12PM', '3PM', '6PM'], height = 220 }) => {
  return (
    <div style={{ width: '100%', height, overflowX: 'auto', padding: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `50px repeat(${cols.length}, 1fr)`, gap: '4px' }}>
        <div />
        {cols.map((c, i) => (
          <span key={i} style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, textAlign: 'center' }}>{c}</span>
        ))}
        {rows.map((r, ri) => (
          <React.Fragment key={ri}>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center' }}>{r}</span>
            {cols.map((c, ci) => {
              const val = Math.floor(Math.sin(ri + ci) * 40 + 50);
              const opacity = Math.max(0.1, val / 100);
              return (
                <div key={ci} style={{
                  height: '24px',
                  borderRadius: '4px',
                  background: `rgba(2, 132, 199, ${opacity})`,
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: opacity > 0.5 ? '#fff' : 'var(--text-secondary)'
                }}>
                  {val}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// 9. LINE CHART
export const LineChart = ({ data = [], xDataKey = 'date', dataKey = 'value', color = '#0284c7', strokeWidth = 2.5, height = 200 }) => {
  if (!data || !data.length) return <EmptyBklitChart height={height} />;
  const values = data.map(d => Number(d[dataKey] || 0));
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);

  const points = data.map((d, i) => {
    const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
    const val = Number(d[dataKey] || 0);
    const y = 100 - ((val - minVal) / (maxVal - minVal || 1)) * 80 - 10;
    return `${x},${y}`;
  });

  const svgPath = points.length > 0 ? `M ${points[0]} ` + points.slice(1).map(p => `L ${p}`).join(' ') : '';

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        <Grid />
        <path d={svgPath} fill="none" stroke={color} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// 10. PROFIT / LOSS LINE CHART
export const ProfitLossLineChart = ({ data = [], height = 200, profitColor = '#16a34a', lossColor = '#ef4444' }) => {
  const chartData = data.length ? data : [
    { date: 'Day 1', value: 1200 }, { date: 'Day 2', value: -400 },
    { date: 'Day 3', value: 850 }, { date: 'Day 4', value: -200 },
    { date: 'Day 5', value: 1600 }
  ];
  return <AreaChart data={chartData} dataKey="value" color={profitColor} height={height} />;
};

// 11. LIVE LINE CHART
export const LiveLineChart = ({ height = 160, color = '#10b981' }) => {
  const [liveData, setLiveData] = useState([
    { date: '1', value: 40 }, { date: '2', value: 55 }, { date: '3', value: 35 },
    { date: '4', value: 70 }, { date: '5', value: 60 }, { date: '6', value: 85 }
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveData(prev => {
        const nextVal = Math.floor(Math.random() * 50 + 40);
        const updated = [...prev.slice(1), { date: String(Date.now()).slice(-4), value: nextVal }];
        return updated;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div style={{ position: 'absolute', top: '8px', right: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color, fontWeight: 700 }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, animation: 'pulse 1s infinite' }} />
        LIVE PULSE
      </div>
      <LineChart data={liveData} color={color} height={height} />
    </div>
  );
};

// 12. PIE CHART
export const PieChart = ({ data = [], height = 200 }) => {
  const pieData = data.length ? data : [
    { name: 'Direct', value: 40, color: '#0284c7' },
    { name: 'Organic', value: 30, color: '#10b981' },
    { name: 'Referral', value: 20, color: '#f59e0b' },
    { name: 'Social', value: 10, color: '#8b5cf6' }
  ];

  return (
    <div style={{ width: '100%', height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 100 100" style={{ width: '140px', height: '140px' }}>
        <circle cx="50" cy="50" r="40" fill="#0284c7" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="20" strokeDasharray="60 190" />
      </svg>
      <ChartLegend payload={pieData} />
    </div>
  );
};

// 13. RADAR CHART
export const RadarChart = ({ data = [], height = 220, color = '#0284c7' }) => {
  return (
    <div style={{ width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 100 100" style={{ width: '160px', height: '160px' }}>
        <polygon points="50,10 90,40 75,90 25,90 10,40" fill="none" stroke="var(--border)" strokeWidth="1.5" />
        <polygon points="50,20 80,45 68,80 32,80 20,45" fill={`${color}33`} stroke={color} strokeWidth="2" />
      </svg>
    </div>
  );
};

// 14. RING CHART
export const RingChart = ({ data = [], height = 200 }) => {
  return <PieChart data={data} height={height} />;
};

// 15. SCATTER CHART
export const ScatterChart = ({ data = [], height = 200, color = '#0284c7' }) => {
  const points = data.length ? data : [
    { x: 10, y: 20 }, { x: 30, y: 50 }, { x: 50, y: 80 }, { x: 70, y: 40 }, { x: 90, y: 90 }
  ];

  return (
    <div style={{ width: '100%', height, position: 'relative' }}>
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
        <Grid />
        {points.map((p, i) => (
          <circle key={i} cx={`${p.x}%`} cy={`${100 - p.y}%`} r="5" fill={color} opacity={0.8} />
        ))}
      </svg>
    </div>
  );
};

// 16. SANKEY CHART
export const SankeyChart = ({ height = 220 }) => {
  return (
    <div style={{ width: '100%', height, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ background: '#0284c7', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>Inbound Lead</div>
        <div style={{ background: '#10b981', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>Direct Traffic</div>
      </div>
      <svg viewBox="0 0 100 50" style={{ width: '120px', height: '60px' }}>
        <path d="M 0,15 C 50,15 50,35 100,35" fill="none" stroke="#0284c7" strokeWidth="8" opacity={0.4} />
      </svg>
      <div style={{ background: '#8b5cf6', color: '#fff', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>Qualified Sale</div>
    </div>
  );
};

// 17. SUNBURST CHART
export const SunburstChart = ({ height = 220 }) => {
  return (
    <div style={{ width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 100 100" style={{ width: '160px', height: '160px' }}>
        <circle cx="50" cy="50" r="45" fill="none" stroke="#0284c7" strokeWidth="8" strokeDasharray="40 10" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="#10b981" strokeWidth="8" strokeDasharray="30 15" />
        <circle cx="50" cy="50" r="15" fill="#8b5cf6" />
      </svg>
    </div>
  );
};

// Bklit Interactive Brush Handle & Window
export const ChartBrush = ({
  initialSelection,
  selection: controlledSelection,
  onSelectionChange,
  blurPx = 1.5,
  fadeOuterEdges = true,
  selectionPattern = { preset: 'accent', color: '#0284c7' }
}) => {
  const [range, setRange] = useState(controlledSelection || initialSelection || { start: 10, end: 90 });

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: `${range.start}%`,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: blurPx ? `blur(${blurPx}px)` : 'none'
      }} />
      <div style={{
        position: 'absolute', left: `${range.start}%`, width: `${range.end - range.start}%`, top: 0, bottom: 0,
        borderLeft: '2px solid #0284c7', borderRight: '2px solid #0284c7',
        background: 'rgba(2, 132, 199, 0.12)', pointerEvents: 'auto'
      }}>
        <div style={{ position: 'absolute', left: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '20px', background: '#0284c7', borderRadius: '3px' }} />
        <div style={{ position: 'absolute', right: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '20px', background: '#0284c7', borderRadius: '3px' }} />
      </div>
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: `${100 - range.end}%`,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: blurPx ? `blur(${blurPx}px)` : 'none'
      }} />
    </div>
  );
};

// Bklit ChartBrushLayout Component
export const ChartBrushLayout = ({
  data = [],
  xDataKey = 'date',
  dataKey = 'value',
  color = '#0284c7',
  enabled = true,
  height = 60,
  brushStrip,
  children,
  className = ''
}) => {
  const [brushSelection, setBrushSelection] = useState({ start: 0, end: 100 });

  const layoutState = {
    xDomain: [brushSelection.start, brushSelection.end],
    xDomainSlotCount: data.length,
    brushSelection,
    onBrushSelectionChange: (sel) => setBrushSelection(sel)
  };

  return (
    <div className={`bklit-chart-brush-layout ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      <div style={{ width: '100%', position: 'relative' }}>
        {children(layoutState)}
      </div>
      {enabled && brushStrip && (
        <div style={{ height, position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {brushStrip(layoutState)}
        </div>
      )}
    </div>
  );
};

// Fallback Empty State
const EmptyBklitChart = ({ height = 200 }) => (
  <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
    No chart data available
  </div>
);

export default ChartBrushLayout;
