import React from 'react';

interface EKhumLogoProps {
  size?: 'sm' | 'md' | 'lg' | number;
  variant?: 'full' | 'icon-only';
  theme?: 'light' | 'dark';
  className?: string;
}

export const EKhumLogo: React.FC<EKhumLogoProps> = ({
  size = 'md',
  variant = 'full',
  theme = 'light',
  className = '',
}) => {
  const height = typeof size === 'number' ? size : size === 'sm' ? 28 : size === 'lg' ? 56 : 40;
  const width = variant === 'icon-only' ? height : height * 3.8;
  const textColor = theme === 'dark' ? '#F8FAFC' : '#0F172A';
  const subtextColor = theme === 'dark' ? '#94A3B8' : '#64748B';

  return (
    <svg
      viewBox={variant === 'icon-only' ? '0 0 100 100' : '0 0 420 110'}
      width={width}
      height={height}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="ekhumGradPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="45%" stopColor="#0D9488" />
          <stop offset="80%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id="ekhumGradAccent" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="50%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#14B8A6" />
        </linearGradient>
        <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0D9488" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Emblem: Heart + Infinity loop */}
      <g transform={variant === 'icon-only' ? 'translate(5, 5)' : 'translate(15, 8)'} filter="url(#subtleGlow)">
        <path
          d="M 45 88 L 18 58 C 6 44 6 22 22 10 C 38 -2 55 12 45 32"
          fill="none"
          stroke="url(#ekhumGradAccent)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 45 88 L 72 58 C 84 44 84 22 68 10 C 52 -2 35 12 45 32 C 55 52 82 46 80 26 C 78 12 60 14 45 32"
          fill="none"
          stroke="url(#ekhumGradPrimary)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="45" cy="32" r="5" fill="#F59E0B" />
      </g>

      {/* Typography */}
      {variant === 'full' && (
        <g transform="translate(125, 68)">
          <text
            x="0"
            y="0"
            fontFamily="'Outfit', 'Inter', -apple-system, sans-serif"
            fontWeight="800"
            fontSize="46"
            fill={textColor}
            letterSpacing="-1"
          >
            EK<tspan fontWeight="600" fill="#2563EB">hum</tspan>
          </text>
          <text
            x="2"
            y="24"
            fontFamily="'Inter', -apple-system, sans-serif"
            fontWeight="600"
            fontSize="11.5"
            fill={subtextColor}
            letterSpacing="3.2"
          >
            GLOBAL PHILANTHROPY FINTECH
          </text>
        </g>
      )}
    </svg>
  );
};
