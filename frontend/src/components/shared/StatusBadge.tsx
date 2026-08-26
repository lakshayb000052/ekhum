import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStyle = (s: string) => {
    const lower = s.toLowerCase();
    
    if (['paid', 'completed', 'active', 'approved', 'success'].includes(lower)) {
      return { bg: '#ECFDF5', color: '#059669', border: '#34D399' }; // Green
    }
    
    if (['pending', 'initiated', 'processing'].includes(lower)) {
      return { bg: '#FEF3C7', color: '#D97706', border: '#FCD34D' }; // Yellow
    }
    
    if (['failed', 'declined', 'rejected', 'error'].includes(lower)) {
      return { bg: '#FEF2F2', color: '#DC2626', border: '#F87171' }; // Red
    }
    
    if (['cancelled', 'paused', 'inactive', 'draft'].includes(lower)) {
      return { bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' }; // Gray
    }
    
    if (['refunded', 'disputed'].includes(lower)) {
      return { bg: '#FFF7ED', color: '#EA580C', border: '#FDBA74' }; // Orange
    }
    
    return { bg: '#F8FAFC', color: '#0F172A', border: '#E2E8F0' }; // Default
  };
  
  const style = getStyle(status);
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '0.75rem',
      fontWeight: 600,
      backgroundColor: style.bg,
      color: style.color,
      border: `1px solid ${style.border}`,
      textTransform: 'uppercase',
      letterSpacing: '0.025em',
      fontFamily: 'Inter, system-ui'
    }}>
      {status}
    </span>
  );
};
