import React, { useState } from 'react';

interface FormFieldProps {
  label: string;
  name?: string;
  type?: 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox' | 'phone' | 'pan';
  value?: string | number | boolean;
  onChange?: (val: any) => void;
  options?: { label: string; value: string | number }[]; // For select
  error?: string;
  placeholder?: string;
  required?: boolean;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  options = [],
  error,
  placeholder,
  required = false
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const baseInputStyle = {
    width: '100%',
    padding: '10px 14px',
    border: `1.5px solid ${error ? '#DC2626' : (isFocused ? '#059669' : '#E2E8F0')}`,
    borderRadius: '8px',
    outline: 'none',
    fontSize: '14px',
    color: '#0F172A',
    fontFamily: 'Inter, system-ui',
    backgroundColor: '#FFFFFF',
    transition: 'all 0.2s ease',
    boxShadow: isFocused ? '0 0 0 3px rgba(5, 150, 105, 0.1)' : 'none',
    boxSizing: 'border-box' as const
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#334155',
    marginBottom: '6px',
    fontFamily: 'Inter, system-ui'
  };

  const renderInput = () => {
    if (type === 'textarea') {
      return (
        <textarea
          value={value as string}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          required={required}
          style={{ ...baseInputStyle, minHeight: '100px', resize: 'vertical' }}
        />
      );
    }
    
    if (type === 'select') {
      return (
        <select
          value={value as string}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          required={required}
          style={baseInputStyle}
        >
          <option value="" disabled>Select an option</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }

    if (type === 'checkbox') {
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={value as boolean}
            onChange={(e) => onChange?.(e.target.checked)}
            style={{ 
              width: '16px', 
              height: '16px',
              cursor: 'pointer',
              accentColor: '#059669'
            }}
          />
          <span style={{ fontSize: '14px', color: '#0F172A', fontFamily: 'Inter, system-ui' }}>
            {placeholder || 'Check this option'}
          </span>
        </label>
      );
    }

    // Default input mapping for phone/pan to text if unsupported by browser
    let inputType = type;
    if (type === 'phone' || type === 'pan') inputType = 'text';

    return (
      <input
        type={inputType}
        value={value as string | number}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        required={required}
        style={baseInputStyle}
      />
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
      {type !== 'checkbox' && (
        <label style={labelStyle}>
          {label} {required && <span style={{ color: '#DC2626' }}>*</span>}
        </label>
      )}
      {renderInput()}
      {error && (
        <span style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px', fontFamily: 'Inter, system-ui' }}>
          {error}
        </span>
      )}
    </div>
  );
};
