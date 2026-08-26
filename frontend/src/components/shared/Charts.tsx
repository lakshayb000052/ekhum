import React from 'react';

export const AnalyticsLineGraph: React.FC<{ data: number[], labels?: string[] }> = ({ data }) => {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min;
  
  const width = 600;
  const height = 200;
  const padding = 20;
  
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((value - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <div style={{ width: '100%', overflowX: 'auto', background: '#FFFFFF', borderRadius: '12px', padding: '16px' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ minWidth: '400px' }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          fill="url(#lineGrad)"
          stroke="none"
          points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
        />
        <polyline
          fill="none"
          stroke="#059669"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {data.map((value, index) => {
          const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
          const y = height - padding - ((value - min) / range) * (height - 2 * padding);
          return (
            <circle key={index} cx={x} cy={y} r="4" fill="#FFFFFF" stroke="#059669" strokeWidth="2" />
          );
        })}
      </svg>
    </div>
  );
};

export const AnalyticsPieChart: React.FC<{ data: { name: string, value: number }[] }> = ({ data }) => {
  const colors = ['#059669', '#0F172A', '#3B82F6', '#F59E0B', '#8B5CF6'];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  let currentAngle = 0;
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', background: '#FFFFFF', borderRadius: '12px', padding: '16px' }}>
      <svg width="150" height="150" viewBox="0 0 100 100">
        {data.map((item, index) => {
          if (item.value === 0) return null;
          const sliceAngle = (item.value / total) * 360;
          const x1 = 50 + 50 * Math.cos((Math.PI * currentAngle) / 180);
          const y1 = 50 + 50 * Math.sin((Math.PI * currentAngle) / 180);
          
          currentAngle += sliceAngle;
          
          const x2 = 50 + 50 * Math.cos((Math.PI * currentAngle) / 180);
          const y2 = 50 + 50 * Math.sin((Math.PI * currentAngle) / 180);
          
          const largeArcFlag = sliceAngle > 180 ? 1 : 0;
          
          const pathData = [
            `M 50 50`,
            `L ${x1} ${y1}`,
            `A 50 50 0 ${largeArcFlag} 1 ${x2} ${y2}`,
            `Z`
          ].join(' ');
          
          return (
            <path key={index} d={pathData} fill={colors[index % colors.length]} stroke="#FFFFFF" strokeWidth="1" />
          );
        })}
        <circle cx="50" cy="50" r="30" fill="#FFFFFF" />
      </svg>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {data.map((item, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: colors[index % colors.length] }} />
            <span style={{ fontSize: '14px', color: '#0F172A', fontFamily: 'Inter, system-ui' }}>{item.name} ({(item.value / total * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AnalyticsBarChart: React.FC<{ data: { name: string, value: number }[] }> = ({ data }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  const colors = ['#059669', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899'];
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#FFFFFF', borderRadius: '12px', padding: '16px' }}>
      {data.map((item, index) => (
        <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748B', fontFamily: 'Inter, system-ui' }}>
            <span>{item.name}</span>
            <span>{item.value}</span>
          </div>
          <div style={{ width: '100%', height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
            <div 
              style={{ 
                width: `${(item.value / max) * 100}%`, 
                height: '100%', 
                backgroundColor: colors[index % colors.length],
                borderRadius: '4px'
              }} 
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export const FunnelChart: React.FC<{ data: { stage: string, count: number }[] }> = ({ data }) => {
  const max = Math.max(...data.map(d => d.count), 1);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#FFFFFF', borderRadius: '12px', padding: '24px' }}>
      {data.map((item, index) => {
        const width = Math.max((item.count / max) * 100, 20); // Min width 20%
        return (
          <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div 
              style={{ 
                width: `${width}%`, 
                height: '40px', 
                backgroundColor: `rgba(5, 150, 105, ${1 - index * 0.2})`, // Decreasing opacity
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: index > 1 ? '#0F172A' : '#FFFFFF',
                fontWeight: 600,
                fontSize: '14px',
                fontFamily: 'Inter, system-ui',
                transition: 'width 0.3s ease'
              }}
            >
              {item.count}
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', fontFamily: 'Inter, system-ui' }}>
              {item.stage}
            </div>
            {index < data.length - 1 && (
              <div style={{ height: '12px', width: '2px', backgroundColor: '#E2E8F0', margin: '4px 0' }} />
            )}
          </div>
        );
      })}
    </div>
  );
};
