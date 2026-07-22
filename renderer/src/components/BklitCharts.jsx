import React, { useState, useEffect, useRef, useMemo } from 'react';

// Bklit Chart Tooltip
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
      <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>{label}</div>
      {payload.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

// Bklit SVG Grid Lines
export const Grid = ({ horizontal = true, vertical = false, color = 'var(--border)' }) => {
  return (
    <g className="bklit-grid" opacity={0.4}>
      {horizontal && (
        <>
          <line x1="0" y1="25%" x2="100%" y2="25%" stroke={color} strokeDasharray="3 3" />
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke={color} strokeDasharray="3 3" />
          <line x1="0" y1="75%" x2="100%" y2="75%" stroke={color} strokeDasharray="3 3" />
        </>
      )}
    </g>
  );
};

// Bklit XAxis
export const XAxis = ({ ticks = [], dataKey = 'date' }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 4px 0 4px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
      {ticks.map((t, i) => (
        <span key={i}>{typeof t === 'object' ? t[dataKey] : t}</span>
      ))}
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
  const [dragStart, setDragStart] = useState(null);
  const [range, setRange] = useState(controlledSelection || initialSelection || { start: 10, end: 90 });

  const handleSliderChange = (newStart, newEnd) => {
    const updated = { start: Math.max(0, newStart), end: Math.min(100, newEnd) };
    setRange(updated);
    if (onSelectionChange) onSelectionChange(updated);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* Dimmed Left Mask */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: `${range.start}%`,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: blurPx ? `blur(${blurPx}px)` : 'none',
        maskImage: fadeOuterEdges ? 'linear-gradient(to right, transparent, black)' : 'none',
        WebkitMaskImage: fadeOuterEdges ? 'linear-gradient(to right, transparent, black)' : 'none'
      }} />

      {/* Selected Window */}
      <div style={{
        position: 'absolute',
        left: `${range.start}%`,
        width: `${range.end - range.start}%`,
        top: 0,
        bottom: 0,
        borderLeft: '2px solid #0284c7',
        borderRight: '2px solid #0284c7',
        background: selectionPattern ? 'rgba(2, 132, 199, 0.12)' : 'rgba(2, 132, 199, 0.08)',
        boxShadow: 'inset 0 0 10px rgba(2, 132, 199, 0.15)',
        pointerEvents: 'auto',
        cursor: 'grab'
      }}>
        {/* Left Handle */}
        <div
          style={{
            position: 'absolute',
            left: '-6px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '12px',
            height: '24px',
            borderRadius: '4px',
            background: '#0284c7',
            border: '2px solid #fff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            cursor: 'ew-resize',
            display: 'flex',
            alignItems: 'center',
            justify: 'center'
          }}
        >
          <div style={{ width: '2px', height: '10px', background: '#fff', borderRadius: '1px' }} />
        </div>

        {/* Right Handle */}
        <div
          style={{
            position: 'absolute',
            right: '-6px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '12px',
            height: '24px',
            borderRadius: '4px',
            background: '#0284c7',
            border: '2px solid #fff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            cursor: 'ew-resize',
            display: 'flex',
            alignItems: 'center',
            justify: 'center'
          }}
        >
          <div style={{ width: '2px', height: '10px', background: '#fff', borderRadius: '1px' }} />
        </div>
      </div>

      {/* Dimmed Right Mask */}
      <div style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: `${100 - range.end}%`,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: blurPx ? `blur(${blurPx}px)` : 'none'
      }} />
    </div>
  );
};

// Bklit Area Chart Component
export const AreaChart = ({
  data = [],
  xDataKey = 'date',
  dataKey = 'value',
  color = '#0284c7',
  height = 200,
  animationDuration = 300,
  xDomain,
  xDomainSlotCount,
  tweenYDomainOnXDomainChange = true,
  children
}) => {
  const [hoverIndex, setHoverIndex] = useState(null);

  const displayData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (!xDomain || xDomain.length < 2) return data;
    const startIdx = Math.floor((xDomain[0] / 100) * data.length);
    const endIdx = Math.ceil((xDomain[1] / 100) * data.length);
    return data.slice(Math.max(0, startIdx), Math.min(data.length, endIdx));
  }, [data, xDomain]);

  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
        No chart data available
      </div>
    );
  }

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
  const gradientId = `bklit-area-grad-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div style={{ position: 'relative', width: '100%', height }} onMouseLeave={() => setHoverIndex(null)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <Grid color="var(--border)" />

        {/* Fill Area */}
        <path d={areaPath} fill={`url(#${gradientId})`} style={{ transition: animationDuration ? `all ${animationDuration}ms ease` : 'none' }} />

        {/* Stroke Line */}
        <path d={svgPath} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />

        {/* Interactive Hover Dots */}
        {displayData.map((d, i) => {
          const x = displayData.length === 1 ? 50 : (i / (displayData.length - 1)) * 100;
          const val = Number(d[dataKey] || 0);
          const y = 100 - ((val - minVal) / (maxVal - minVal || 1)) * 80 - 10;
          return (
            <circle
              key={i}
              cx={`${x}%`}
              cy={`${y}%`}
              r="4"
              fill={color}
              stroke="#fff"
              strokeWidth="1.5"
              style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
              onMouseEnter={() => setHoverIndex(i)}
            />
          );
        })}
      </svg>

      {/* Tooltip Overlay */}
      {hoverIndex !== null && displayData[hoverIndex] && (
        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
          <ChartTooltip
            active={true}
            label={displayData[hoverIndex][xDataKey] || `Index ${hoverIndex}`}
            payload={[{ name: dataKey, value: displayData[hoverIndex][dataKey], color }]}
          />
        </div>
      )}
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
      {/* Main Chart */}
      <div className="bklit-main-chart-wrapper" style={{ width: '100%', position: 'relative' }}>
        {children(layoutState)}
      </div>

      {/* Brush Strip */}
      {enabled && brushStrip && (
        <div className="bklit-brush-strip-wrapper" style={{ height, position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {brushStrip(layoutState)}
        </div>
      )}
    </div>
  );
};

export default ChartBrushLayout;
