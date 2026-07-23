import React, { useState, useMemo, useEffect, useRef, createContext, useContext } from 'react';

// Bklit Chart Context
const ChartContext = createContext(null);
export const useChart = () => useContext(ChartContext);

// Monotone Cubic Hermite Interpolation (D3 curveMonotoneX equivalent)
function buildMonotonePath(points) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  if (points.length === 2) return `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)},${points[1].y.toFixed(2)}`;

  const n = points.length;
  const dxs = [];
  const dys = [];
  const ms = [];

  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    dxs.push(dx);
    dys.push(dy);
    ms.push(dy / (dx || 1));
  }

  const c1s = [ms[0]];
  for (let i = 0; i < dxs.length - 1; i++) {
    const m = ms[i];
    const mNext = ms[i + 1];
    if (m * mNext <= 0) {
      c1s.push(0);
    } else {
      const dx_ = dxs[i];
      const dxNext = dxs[i + 1];
      const common = dx_ + dxNext;
      c1s.push((3 * common) / ((common + dxNext) / m + (common + dx_) / mNext));
    }
  }
  c1s.push(ms[ms.length - 1]);

  let path = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = dxs[i] / 3;
    const c1 = c1s[i];
    const c2 = c1s[i + 1];

    const cp1x = p1.x + dx;
    const cp1y = p1.y + c1 * dx;
    const cp2x = p2.x - dx;
    const cp2y = p2.y - c2 * dx;

    path += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return path;
}

// Bklit Glassmorphic Tooltip
export const ChartTooltip = ({ active, payload, label, formatter }) => {
  const context = useChart();
  const activePayload = payload || (context?.activePoint ? [{
    name: context.dataKey || 'value',
    value: context.activePoint.raw[context.dataKey || 'value'],
    color: context.color || '#0071E3'
  }] : []);
  
  const activeLabel = label || context?.activePoint?.raw[context?.xDataKey || 'date'];
  const isShown = active !== undefined ? active : !!context?.activePoint;

  if (!isShown || !activePayload.length) return null;

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.94)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      color: '#fff',
      padding: '10px 14px',
      borderRadius: '10px',
      fontSize: '12px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
      pointerEvents: 'none',
      zIndex: 50,
      minWidth: '140px'
    }}>
      {activeLabel && <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{activeLabel}</div>}
      {activePayload.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: idx > 0 ? '4px' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color || '#0071E3' }} />
            <span style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 500 }}>{item.name || item.dataKey}:</span>
          </div>
          <strong style={{ color: '#fff', fontFamily: 'monospace', fontSize: '13px' }}>
            {formatter ? formatter(item.value) : typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
          </strong>
        </div>
      ))}
    </div>
  );
};

// SVG Grid Lines
export const Grid = ({ horizontal = true, vertical = false, color = 'var(--border, rgba(255, 255, 255, 0.08))' }) => (
  <g opacity={0.4}>
    {horizontal && (
      <>
        <line x1="0" y1="50" x2="1000" y2="50" stroke={color} strokeDasharray="4 4" strokeWidth="1" />
        <line x1="0" y1="150" x2="1000" y2="150" stroke={color} strokeDasharray="4 4" strokeWidth="1" />
        <line x1="0" y1="250" x2="1000" y2="250" stroke={color} strokeDasharray="4 4" strokeWidth="1" />
        <line x1="0" y1="350" x2="1000" y2="350" stroke={color} strokeDasharray="4 4" strokeWidth="1" />
      </>
    )}
  </g>
);

// Composable ReferenceArea Component
export const ReferenceArea = ({ y1, y2, fill = 'rgba(255, 255, 255, 0.04)', fillOpacity = 1 }) => {
  const context = useChart();
  if (!context) return null;
  const { minVal, valRange } = context;

  const marginT = 30;
  const marginB = 370;
  const plotH = marginB - marginT;

  const yCoord1 = marginB - ((y1 - minVal) / valRange) * plotH;
  const yCoord2 = marginB - ((y2 - minVal) / valRange) * plotH;

  const topY = Math.min(yCoord1, yCoord2);
  const rectHeight = Math.abs(yCoord1 - yCoord2);

  return (
    <rect 
      x="0" 
      y={topY} 
      width="1000" 
      height={rectHeight} 
      fill={fill} 
      opacity={fillOpacity} 
      pointerEvents="none"
    />
  );
};

// Composable XAxis Component with sliding date pill highlight
export const XAxis = () => {
  const context = useChart();
  if (!context) return null;
  const { displayData, xDataKey, activePoint, points } = context;

  // Maximum 6-7 ticks for clean spacing
  const maxTicks = 7;
  const total = displayData.length;
  const step = Math.max(1, Math.floor(total / maxTicks));

  const visibleTicks = [];
  for (let i = 0; i < total; i += step) {
    visibleTicks.push({
      index: i,
      label: typeof displayData[i] === 'object' ? displayData[i][xDataKey] : displayData[i]
    });
  }

  // Ensure last tick is included
  const lastIdx = total - 1;
  if (lastIdx > 0 && !visibleTicks.some(vt => vt.index === lastIdx)) {
    if (visibleTicks.length > 1 && (lastIdx - visibleTicks[visibleTicks.length - 1].index) < step / 2) {
      visibleTicks[visibleTicks.length - 1] = {
        index: lastIdx,
        label: typeof displayData[lastIdx] === 'object' ? displayData[lastIdx][xDataKey] : displayData[lastIdx]
      };
    } else {
      visibleTicks.push({
        index: lastIdx,
        label: typeof displayData[lastIdx] === 'object' ? displayData[lastIdx][xDataKey] : displayData[lastIdx]
      });
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '36px', marginTop: '12px' }}>
      {/* Dynamic Sliding Date Pill Indicator */}
      {activePoint && (
        <div style={{
          position: 'absolute',
          left: `${(activePoint.x / 1000) * 100}%`,
          transform: 'translateX(-50%)',
          bottom: '2px',
          background: 'rgba(15, 23, 42, 0.95)',
          color: '#fff',
          padding: '6px 12px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 700,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          whiteSpace: 'nowrap',
          zIndex: 10,
          transition: 'left 120ms cubic-bezier(0.25, 1, 0.5, 1)'
        }}>
          {activePoint.raw[xDataKey]}
        </div>
      )}

      {/* Axis Tick Labels */}
      {visibleTicks.map((vt, i) => {
        const pct = 2 + (vt.index / Math.max(1, total - 1)) * 96;
        // Hide standard label if it sits underneath the active sliding pill
        const isOverlapped = activePoint && Math.abs(activePoint.x - (20 + (vt.index / (total - 1)) * 960)) < 60;
        return (
          <span 
            key={i} 
            style={{ 
              position: 'absolute', 
              left: `${pct}%`, 
              transform: 'translateX(-50%)', 
              fontSize: '10px', 
              color: 'var(--text-tertiary)', 
              fontWeight: 600,
              whiteSpace: 'nowrap',
              fontFamily: 'sans-serif',
              opacity: isOverlapped ? 0 : 1,
              transition: 'opacity 150ms ease'
            }}
          >
            {vt.label}
          </span>
        );
      })}
    </div>
  );
};

// Composable YAxis Component
export const YAxis = ({ min = 0, max = 100, formatter }) => {
  const context = useChart();
  const minVal = context ? context.minVal : min;
  const maxVal = context ? context.maxVal : max;
  const activePoint = context?.activePoint;
  
  // Calculate active values from all active keys
  const activeVals = useMemo(() => {
    if (!activePoint || !context) return [];
    const keys = context.activeKeys || [context.dataKey || 'value'];
    return keys.map(k => Number(activePoint.raw[k] || 0));
  }, [activePoint, context]);

  const ticks = useMemo(() => {
    return [maxVal, (maxVal + minVal) / 2, minVal];
  }, [maxVal, minVal]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: '12px', fontSize: '10px', color: 'var(--text-tertiary)', textAlign: 'right', fontWeight: 500, height: '100%' }}>
      {ticks.map((t, idx) => {
        // Highlight tick if any of the active series' values is closest to this tick
        const isHighlighted = activeVals.some(val => Math.abs(t - val) < (maxVal - minVal) * 0.22);
        return (
          <span 
            key={idx} 
            style={{ 
              color: isHighlighted ? 'var(--accent, #0071E3)' : 'var(--text-tertiary)', 
              fontWeight: isHighlighted ? 700 : 500,
              transition: 'color 150ms ease, font-weight 150ms ease'
            }}
          >
            {formatter ? formatter(t) : Math.round(t)}
          </span>
        );
      })}
    </div>
  );
};

// Composable Area Component
export const Area = ({
  dataKey = 'value',
  color = '#0071E3',
  fillOpacity = 0.3,
  strokeWidth = 2,
  curve
}) => {
  const context = useChart();
  if (!context) return null;
  const { displayData, minVal, valRange, activePoint, hoverIndex } = context;

  const points = useMemo(() => {
    const marginT = 30;
    const marginB = 370;
    const plotH = marginB - marginT;

    return displayData.map((d, i) => {
      const x = displayData.length === 1 ? 500 : 20 + (i / (displayData.length - 1)) * 960;
      const val = Number(d[dataKey] || 0);
      const y = marginB - ((val - minVal) / valRange) * plotH;
      return { x, y, raw: d };
    });
  }, [displayData, dataKey, minVal, valRange]);

  const smoothCurve = useMemo(() => buildMonotonePath(points), [points]);
  const areaPath = useMemo(() => {
    if (!points.length) return '';
    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    return `${smoothCurve} L ${lastX.toFixed(2)},370 L ${firstX.toFixed(2)},370 Z`;
  }, [smoothCurve, points]);

  const gradId = useMemo(() => `bklit-area-grad-${dataKey}-${Math.random().toString(36).substr(2, 6)}`, [dataKey]);
  const activeY = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex].y : null;

  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity={0.0} />
        </linearGradient>
      </defs>

      {/* Area Fill */}
      <path d={areaPath} fill={`url(#${gradId})`} style={{ transition: 'all 0.3s ease' }} />

      {/* Curve Stroke Line */}
      <path 
        d={smoothCurve} 
        fill="none" 
        stroke={color} 
        strokeWidth={strokeWidth} 
        vectorEffect="non-scaling-stroke" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        style={{ transition: 'all 0.3s ease' }}
      />

      {/* Circle highlight overlay */}
      {hoverIndex !== null && points[hoverIndex] && (
        <circle 
          cx={points[hoverIndex].x} 
          cy={points[hoverIndex].y} 
          r="5.5" 
          fill={color} 
          stroke="#fff" 
          strokeWidth="2.5" 
        />
      )}
    </>
  );
};

// Composable AreaChart Root Container
export const AreaChart = ({
  data = [],
  xDataKey = 'date',
  dataKey = 'value',
  color = '#0071E3',
  fillOpacity = 0.3,
  height = 220,
  xDomain,
  children
}) => {
  const containerRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [mouseX, setMouseX] = useState(null);

  const displayData = useMemo(() => {
    if (!data || data.length === 0) {
      return [
        { [xDataKey]: 'Day 1', [dataKey]: 0 },
        { [xDataKey]: 'Day 2', [dataKey]: 0 },
        { [xDataKey]: 'Day 3', [dataKey]: 0 },
        { [xDataKey]: 'Day 4', [dataKey]: 0 },
        { [xDataKey]: 'Day 5', [dataKey]: 0 },
        { [xDataKey]: 'Day 6', [dataKey]: 0 },
        { [xDataKey]: 'Day 7', [dataKey]: 0 }
      ];
    }
    if (!xDomain || xDomain.length < 2) return data;
    const startIdx = Math.floor((xDomain[0] / 100) * data.length);
    const endIdx = Math.ceil((xDomain[1] / 100) * data.length);
    return data.slice(Math.max(0, startIdx), Math.min(data.length, endIdx));
  }, [data, xDomain, xDataKey, dataKey]);

  // Extract all potential data keys dynamically from child Area components
  const activeKeys = useMemo(() => {
    const keys = [];
    React.Children.forEach(children, child => {
      if (child && child.type === Area && child.props.dataKey) {
        keys.push(child.props.dataKey);
      }
    });
    if (keys.length === 0) keys.push(dataKey);
    return keys;
  }, [children, dataKey]);

  const { minVal, maxVal, valRange } = useMemo(() => {
    let allVals = [];
    displayData.forEach(d => {
      activeKeys.forEach(k => {
        allVals.push(Number(d[k] || 0));
      });
    });
    if (allVals.length === 0) allVals = [0];
    const mx = Math.max(...allVals, 10);
    const mn = Math.min(...allVals, 0);
    return { minVal: mn, maxVal: mx, valRange: mx - mn || 1 };
  }, [displayData, activeKeys]);

  // General X positions mapping
  const points = useMemo(() => {
    return displayData.map((d, i) => {
      const x = displayData.length === 1 ? 500 : 20 + (i / (displayData.length - 1)) * 960;
      return { x, raw: d };
    });
  }, [displayData]);

  const handleMouseMove = (e) => {
    if (!containerRef.current || points.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseRelX = e.clientX - rect.left;
    
    // Map relative X coordinate to the 1000px SVG coordinate space
    const svgX = (mouseRelX / rect.width) * 1000;
    
    // Find index of the point closest to the mouse's X coordinate in SVG space
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < points.length; i++) {
      const diff = Math.abs(points[i].x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    
    setHoverIndex(closestIdx);
    setMouseX(mouseRelX);
  };

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;

  // Context value exposed to all composable children
  const contextValue = {
    data,
    displayData,
    xDataKey,
    dataKey,
    color,
    minVal,
    maxVal,
    valRange,
    points,
    hoverIndex,
    activePoint,
    activeKeys
  };

  // Find if custom XAxis or Tooltip are present as children
  const hasCustomXAxis = React.Children.toArray(children).some(c => c && c.type === XAxis);
  const hasCustomTooltip = React.Children.toArray(children).some(c => c && c.type === ChartTooltip);

  return (
    <ChartContext.Provider value={contextValue}>
      <div 
        ref={containerRef}
        style={{ position: 'relative', width: '100%', height, userSelect: 'none' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHoverIndex(null); setMouseX(null); }}
      >
        <svg viewBox="0 0 1000 400" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {/* Render horizontal/grid references first */}
          {React.Children.map(children, child => {
            if (child && (child.type === Grid || child.type === ReferenceArea)) return child;
            return null;
          })}

          {/* Render Area series */}
          {React.Children.map(children, child => {
            if (child && child.type === Area) return child;
            return null;
          })}

          {/* Render default Area series if none declared */}
          {!React.Children.toArray(children).some(c => c && c.type === Area) && (
            <Area dataKey={dataKey} color={color} fillOpacity={fillOpacity} />
          )}

          {/* Render crosshair line */}
          {activePoint && (
            <line
              x1={activePoint.x}
              y1="20"
              x2={activePoint.x}
              y2="370"
              stroke="var(--chart-crosshair, rgba(255, 255, 255, 0.25))"
              strokeDasharray="4 4"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* HTML Absolute Floating Overlays for Tooltip */}
        {activePoint && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div style={{
              position: 'absolute',
              left: Math.min(Math.max(mouseX, 85), (containerRef.current?.getBoundingClientRect().width || 400) - 85),
              top: '12px',
              transform: 'translateX(-50%)',
              zIndex: 30,
              transition: 'left 100ms ease-out'
            }}>
              {hasCustomTooltip ? (
                React.Children.map(children, child => {
                  if (child && child.type === ChartTooltip) return child;
                  return null;
                })
              ) : (
                <ChartTooltip />
              )}
            </div>
          </div>
        )}

        {/* Render bottom XAxis */}
        {hasCustomXAxis ? (
          React.Children.map(children, child => {
            if (child && child.type === XAxis) return child;
            return null;
          })
        ) : (
          <XAxis />
        )}
      </div>
    </ChartContext.Provider>
  );
};

// 2. LINE CHART wrapper
export const LineChart = ({ children, ...props }) => (
  <AreaChart {...props}>
    {children}
    {/* Map standard Area with fillOpacity=0 if not specified */}
    {!React.Children.toArray(children).some(c => c && c.type === Area) && (
      <Area dataKey={props.dataKey} color={props.color} fillOpacity={0} />
    )}
  </AreaChart>
);

// 3. BAR CHART
export const BarChart = ({ data = [], xDataKey = 'name', dataKey = 'value', color = '#0071E3', height = 220, horizontal = false }) => {
  const [hoverIndex, setHoverIndex] = useState(null);
  const displayData = data && data.length ? data : [
    { [xDataKey]: 'Mon', [dataKey]: 0 },
    { [xDataKey]: 'Tue', [dataKey]: 0 },
    { [xDataKey]: 'Wed', [dataKey]: 0 },
    { [xDataKey]: 'Thu', [dataKey]: 0 },
    { [xDataKey]: 'Fri', [dataKey]: 0 }
  ];

  const values = displayData.map(d => Number(d[dataKey] || 0));
  const maxVal = Math.max(...values, 10);

  return (
    <div style={{ position: 'relative', width: '100%', height, display: 'flex', flexDirection: horizontal ? 'column' : 'row', alignItems: horizontal ? 'stretch' : 'flex-end', gap: '12px', padding: '20px 12px 12px 12px' }} onMouseLeave={() => setHoverIndex(null)}>
      {displayData.map((item, i) => {
        const val = Number(item[dataKey] || 0);
        const pct = Math.max(4, (val / maxVal) * 100);
        const barColor = item.color || color;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: horizontal ? 'row' : 'column', alignItems: 'center', height: horizontal ? 'auto' : '100%', justifyContent: 'flex-end', gap: '6px' }} onMouseEnter={() => setHoverIndex(i)}>
            <div style={{
              width: horizontal ? `${pct}%` : '65%',
              height: horizontal ? '22px' : `${pct}%`,
              background: `linear-gradient(180deg, ${barColor}, ${barColor}aa)`,
              borderRadius: '6px',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: hoverIndex === i ? `0 6px 16px ${barColor}88` : 'none',
              transform: hoverIndex === i ? 'scale(1.04)' : 'scale(1)'
            }} />
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
              {item[xDataKey]}
            </span>
          </div>
        );
      })}
      {hoverIndex !== null && displayData[hoverIndex] && (
        <div style={{ position: 'absolute', top: '10px', right: '16px' }}>
          <ChartTooltip active={true} label={displayData[hoverIndex][xDataKey]} payload={[{ name: dataKey, value: displayData[hoverIndex][dataKey], color: displayData[hoverIndex].color || color }]} />
        </div>
      )}
    </div>
  );
};

// 4. CANDLESTICK CHART
export const CandlestickChart = ({ data = [], height = 220, upColor = '#30D158', downColor = '#FF3B30' }) => {
  const chartData = data && data.length ? data : [
    { date: '1', open: 10, high: 15, low: 8, close: 14 },
    { date: '2', open: 14, high: 18, low: 12, close: 11 }
  ];
  const highs = chartData.map(d => d.high);
  const lows = chartData.map(d => d.low);
  const maxVal = Math.max(...highs, 10);
  const minVal = Math.min(...lows, 0);
  const range = maxVal - minVal || 1;

  return (
    <div style={{ width: '100%', height, position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '20px 12px 12px 12px' }}>
      {chartData.map((d, i) => {
        const isUp = d.close >= d.open;
        const color = isUp ? upColor : downColor;
        const bodyTop = 100 - ((Math.max(d.open, d.close) - minVal) / range) * 80 - 10;
        const bodyBottom = 100 - ((Math.min(d.open, d.close) - minVal) / range) * 80 - 10;
        const wickTop = 100 - ((d.high - minVal) / range) * 80 - 10;
        const wickBottom = 100 - ((d.low - minVal) / range) * 80 - 10;
        const bodyHeight = Math.max(4, bodyBottom - bodyTop);

        return (
          <div key={i} style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', top: `${wickTop}%`, bottom: `${100 - wickBottom}%`, width: '2px', background: color }} />
            <div style={{ position: 'absolute', top: `${bodyTop}%`, height: `${bodyHeight}%`, width: '65%', background: color, borderRadius: '3px', boxShadow: `0 2px 8px ${color}44` }} />
          </div>
        );
      })}
    </div>
  );
};

// 5. CHOROPLETH CHART
export const ChoroplethChart = ({ data = [], height = 220, title = 'Geographic Regional Distribution' }) => {
  const regions = data && data.length ? data : [
    { region: 'North America', code: 'NA', value: 85, color: '#0071E3' },
    { region: 'Europe', code: 'EU', value: 64, color: '#30D158' },
    { region: 'Asia Pacific', code: 'APAC', value: 92, color: '#AF52DE' },
    { region: 'Latin America', code: 'LATAM', value: 40, color: '#FF9F0A' },
    { region: 'Middle East', code: 'MEA', value: 28, color: '#FF3B30' }
  ];

  return (
    <div style={{ width: '100%', height, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat( auto-fit, minmax(130px, 1fr) )', gap: '10px' }}>
        {regions.map((r, i) => (
          <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>{r.region}</span>
              <span style={{ fontSize: '10px', background: r.color || '#0071E3', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>{r.code}</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: r.color || '#0071E3', marginTop: '4px' }}>{r.value}</div>
            <div style={{ height: '4px', width: '100%', background: 'rgba(0,0,0,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, r.value)}%`, background: r.color || '#0071E3', borderRadius: '2px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 6. COMPOSED CHART
export const ComposedChart = ({ data = [], xDataKey = 'name', series = [], height = 220 }) => (
  <div style={{ width: '100%', height, position: 'relative', padding: '16px 8px 8px 8px' }}>
    <BarChart data={data} xDataKey={xDataKey} dataKey={series[0]?.key || 'value'} color={series[0]?.color || '#0071E3'} height={height - 30} />
    <ChartLegend payload={series.map(s => ({ value: s.label || s.key, color: s.color }))} />
  </div>
);

// 7. FUNNEL CHART
export const FunnelChart = ({ data = [], height = 220 }) => {
  const stages = data && data.length ? data : [
    { label: 'Impressions', value: 10000, color: '#0071E3' },
    { label: 'Clicks', value: 4200, color: '#00C7BE' },
    { label: 'Leads', value: 1800, color: '#30D158' },
    { label: 'Conversions', value: 650, color: '#AF52DE' }
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
                background: `linear-gradient(90deg, ${st.color || '#0071E3'}, ${st.color || '#0071E3'}aa)`,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: '11px',
                boxShadow: `0 3px 8px ${st.color || '#0071E3'}44`
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

// 8. GAUGE CHART
export const GaugeChart = ({ value = 75, min = 0, max = 100, label = 'Completion Rate', height = 180, color = '#0071E3' }) => {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  return (
    <div style={{ width: '100%', height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <svg viewBox="0 0 100 60" style={{ width: '160px', height: '90px' }}>
        <path d="M 10,50 A 40,40 0 0,1 90,50" fill="none" stroke="var(--border, rgba(255,255,255,0.1))" strokeWidth="10" strokeLinecap="round" />
        <path d="M 10,50 A 40,40 0 0,1 90,50" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset={125.6 - (125.6 * pct) / 100} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div style={{ marginTop: '-20px', textAlign: 'center' }}>
        <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>{value}%</div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
};

// 9. HEATMAP CHART
export const HeatmapChart = ({ data = [], rows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], cols = ['9AM', '12PM', '3PM', '6PM'], height = 220 }) => (
  <div style={{ width: '100%', height, overflowX: 'auto', padding: '12px' }}>
    <div style={{ display: 'grid', gridTemplateColumns: `50px repeat(${cols.length}, 1fr)`, gap: '6px' }}>
      <div />
      {cols.map((c, i) => (
        <span key={i} style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, textAlign: 'center' }}>{c}</span>
      ))}
      {rows.map((r, ri) => (
        <React.Fragment key={ri}>
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center' }}>{r}</span>
          {cols.map((c, ci) => {
            const val = Math.floor(Math.sin(ri + ci) * 40 + 50);
            const opacity = Math.max(0.15, val / 100);
            return (
              <div key={ci} style={{
                height: '26px',
                borderRadius: '6px',
                background: `rgba(0, 113, 227, ${opacity})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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

// 10. PROFIT / LOSS LINE CHART
export const ProfitLossLineChart = ({ data = [], height = 200, profitColor = '#30D158', lossColor = '#FF3B30' }) => (
  <AreaChart data={data} dataKey="value" color={profitColor} height={height} />
);

// 11. LIVE LINE CHART
export const LiveLineChart = ({ height = 160, color = '#30D158' }) => {
  const [liveData, setLiveData] = useState([
    { date: '1', value: 40 }, { date: '2', value: 55 }, { date: '3', value: 35 },
    { date: '4', value: 70 }, { date: '5', value: 60 }, { date: '6', value: 85 }
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveData(prev => {
        const nextVal = Math.floor(Math.random() * 50 + 40);
        return [...prev.slice(1), { date: String(Date.now()).slice(-4), value: nextVal }];
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
  const pieData = data && data.length ? data : [
    { name: 'Direct', value: 40, color: '#0071E3' },
    { name: 'Organic', value: 30, color: '#30D158' },
    { name: 'Referral', value: 20, color: '#FF9F0A' },
    { name: 'Social', value: 10, color: '#AF52DE' }
  ];

  return (
    <div style={{ width: '100%', height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 100 100" style={{ width: '140px', height: '140px' }}>
        <circle cx="50" cy="50" r="40" fill="#0071E3" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="#30D158" strokeWidth="20" strokeDasharray="60 190" />
      </svg>
      <ChartLegend payload={pieData} />
    </div>
  );
};

// 13. RADAR CHART
export const RadarChart = ({ data = [], height = 220, color = '#0071E3' }) => (
  <div style={{ width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg viewBox="0 0 100 100" style={{ width: '160px', height: '160px' }}>
      <polygon points="50,10 90,40 75,90 25,90 10,40" fill="none" stroke="var(--border, rgba(255,255,255,0.1))" strokeWidth="1.5" />
      <polygon points="50,20 80,45 68,80 32,80 20,45" fill={`${color}33`} stroke={color} strokeWidth="2" />
    </svg>
  </div>
);

// 14. RING CHART
export const RingChart = ({ data = [], height = 200 }) => <PieChart data={data} height={height} />;

// 15. SCATTER CHART
export const ScatterChart = ({ data = [], height = 200, color = '#0071E3' }) => {
  const points = data && data.length ? data : [
    { x: 10, y: 20 }, { x: 30, y: 50 }, { x: 50, y: 80 }, { x: 70, y: 40 }, { x: 90, y: 90 }
  ];

  return (
    <div style={{ width: '100%', height, position: 'relative' }}>
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
        <Grid />
        {points.map((p, i) => (
          <circle key={i} cx={`${p.x}%`} cy={`${100 - p.y}%`} r="4" fill={color} opacity={0.8} />
        ))}
      </svg>
    </div>
  );
};

// 16. SANKEY CHART
export const SankeyChart = ({ height = 220 }) => (
  <div style={{ width: '100%', height, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ background: '#0071E3', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>Inbound Lead</div>
      <div style={{ background: '#30D158', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>Direct Traffic</div>
    </div>
    <svg viewBox="0 0 100 50" style={{ width: '120px', height: '60px' }}>
      <path d="M 0,15 C 50,15 50,35 100,35" fill="none" stroke="#0071E3" strokeWidth="8" opacity={0.4} />
    </svg>
    <div style={{ background: '#AF52DE', color: '#fff', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>Qualified Sale</div>
  </div>
);

// 17. SUNBURST CHART
export const SunburstChart = ({ height = 220 }) => (
  <div style={{ width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg viewBox="0 0 100 100" style={{ width: '160px', height: '160px' }}>
      <circle cx="50" cy="50" r="45" fill="none" stroke="#0071E3" strokeWidth="8" strokeDasharray="40 10" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="#30D158" strokeWidth="8" strokeDasharray="30 15" />
      <circle cx="50" cy="50" r="15" fill="#AF52DE" />
    </svg>
  </div>
);

// Bklit Interactive Brush Handle
export const ChartBrush = ({
  initialSelection,
  selection: controlledSelection,
  onSelectionChange,
  blurPx = 2,
  selectionPattern = { preset: 'accent', color: '#0071E3' }
}) => {
  const [range, setRange] = useState(controlledSelection || initialSelection || { start: 10, end: 90 });

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: `${range.start}%`,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: blurPx ? `blur(${blurPx}px)` : 'none'
      }} />
      <div style={{
        position: 'absolute', left: `${range.start}%`, width: `${range.end - range.start}%`, top: 0, bottom: 0,
        borderLeft: '2px solid #0071E3', borderRight: '2px solid #0071E3',
        background: 'rgba(0, 113, 227, 0.12)', pointerEvents: 'auto'
      }}>
        <div style={{ position: 'absolute', left: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '22px', background: '#0071E3', borderRadius: '3px' }} />
        <div style={{ position: 'absolute', right: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '22px', background: '#0071E3', borderRadius: '3px' }} />
      </div>
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: `${100 - range.end}%`,
        background: 'rgba(15, 23, 42, 0.45)',
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
  color = '#0071E3',
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
        <div style={{ height, position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {brushStrip(layoutState)}
        </div>
      )}
    </div>
  );
};

export default ChartBrushLayout;
