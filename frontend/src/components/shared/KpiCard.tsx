import React from 'react';

interface KpiCardProps {
  label?: string;
  title?: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export const KpiCard: React.FC<KpiCardProps> = ({ label, title, value, icon, trend }) => {
  const displayLabel = label || title || '';
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 12px rgba(15,23,42,0.05), 0 2px 4px rgba(15,23,42,0.02)',
      fontFamily: 'Inter, system-ui',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ color: '#64748B', fontSize: '0.875rem', fontWeight: 500 }}>{displayLabel}</span>
        {icon && (
          <div style={{ 
            width: '32px', 
            height: '32px', 
            borderRadius: '8px', 
            background: '#F8FAFC', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#059669',
            fontSize: '18px'
          }}>
            {icon}
          </div>
        )}
      </div>
      
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
        <span style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', fontFamily: 'Outfit, sans-serif' }}>
          {value}
        </span>
        
        {trend && (
          <span style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px',
            fontSize: '0.875rem', 
            fontWeight: 600,
            color: trend.isPositive ? '#059669' : '#DC2626'
          }}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
    </div>
  );
};
