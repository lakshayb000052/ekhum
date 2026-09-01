import React from 'react';

export interface EKhumLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  variant?: 'full' | 'icon' | 'mark-only';
  theme?: 'light' | 'dark' | 'emerald' | 'white';
  withTagline?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const EKhumLogo: React.FC<EKhumLogoProps> = ({
  size = 'md',
  variant = 'full',
  theme = 'light',
  withTagline = false,
  className = '',
  style = {},
  onClick,
}) => {
  // Height calculation
  const height =
    typeof size === 'number'
      ? size
      : size === 'xs'
      ? 24
      : size === 'sm'
      ? 32
      : size === 'lg'
      ? 52
      : size === 'xl'
      ? 64
      : 40; // 'md' default

  // Colors based on software theme
  const isDark = theme === 'dark' || theme === 'white';
  const primaryLetterColor = isDark ? '#FFFFFF' : '#0F172A';
  const smileGradientId = `smileGrad-${Math.random().toString(36).substr(2, 6)}`;
  const tagColor = isDark ? '#94A3B8' : '#059669';

  // ICON VARIANT
  if (variant === 'icon' || variant === 'mark-only') {
    return (
      <svg
        viewBox="0 0 100 100"
        width={height}
        height={height}
        className={className}
        style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
        onClick={onClick}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`${smileGradientId}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
          <linearGradient id={`${smileGradientId}-smile`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#88FFBF" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>

        {/* Rounded square container with Emerald gradient */}
        <rect width="100" height="100" rx="26" fill={`url(#${smileGradientId}-bg)`} />

        {/* Inner Smile 'u' Emblem */}
        <g transform="translate(24, 25)">
          {/* Left top eye/stem */}
          <rect x="0" y="0" width="14" height="16" rx="4" fill="#FFFFFF" />
          {/* Right top eye/stem */}
          <rect x="38" y="0" width="14" height="16" rx="4" fill="#FFFFFF" />
          {/* Smile Curve */}
          <path
            d="M 0 14 C 0 38, 52 38, 52 14 C 52 28, 0 28, 0 14 Z"
            fill={`url(#${smileGradientId}-smile)`}
          />
          <path
            d="M 0 14 C 0 42, 52 42, 52 14"
            stroke="#FFFFFF"
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 6 16 C 6 36, 46 36, 46 16"
            stroke={`url(#${smileGradientId}-smile)`}
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </svg>
    );
  }

  // FULL WORDMARK VARIANT ("ekhum" with the signature smile 'u')
  const baseWidth = withTagline ? height * 4.4 : height * 3.6;

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        cursor: onClick ? 'pointer' : 'default',
        lineHeight: 1,
        ...style,
      }}
      className={className}
      onClick={onClick}
    >
      <svg
        viewBox="0 0 360 100"
        width={baseWidth}
        height={height}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={smileGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="50%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#00D29F" />
          </linearGradient>
        </defs>

        {/* ================= LETTER 'e' ================= */}
        <g transform="translate(10, 20)">
          <path
            d="M 46 36 C 44 14, 8 14, 8 36 C 8 58, 46 58, 46 44 L 34 44 C 34 50, 20 50, 20 40 L 46 40 C 46 38, 46 36, 46 36 Z M 20 32 C 20 22, 34 22, 34 32 L 20 32 Z"
            fill={primaryLetterColor}
            fillRule="evenodd"
          />
        </g>

        {/* ================= LETTER 'k' ================= */}
        <g transform="translate(70, 0)">
          {/* Vertical stem */}
          <rect x="0" y="8" width="12" height="68" rx="6" fill={primaryLetterColor} />
          {/* Top diagonal arm */}
          <path
            d="M 10 48 L 36 24 C 39 21, 45 23, 44 28 L 41 32 L 20 52 L 44 72 C 47 75, 43 80, 38 78 L 10 56 Z"
            fill={primaryLetterColor}
          />
        </g>

        {/* ================= LETTER 'h' ================= */}
        <g transform="translate(132, 0)">
          {/* Vertical stem */}
          <rect x="0" y="8" width="12" height="68" rx="6" fill={primaryLetterColor} />
          {/* Shoulder arch */}
          <path
            d="M 8 36 C 14 24, 38 22, 42 34 L 42 76 C 42 79, 30 79, 30 76 L 30 42 C 30 34, 18 34, 18 42 L 18 76 C 18 79, 6 79, 6 76 L 6 36 Z"
            fill={primaryLetterColor}
          />
        </g>

        {/* ================= LETTER 'u' (SIGNATURE SMILE ICON) ================= */}
        <g transform="translate(196, 26)">
          {/* Left top stem / eye */}
          <rect x="0" y="2" width="12" height="14" rx="4" fill={primaryLetterColor} />
          {/* Right top stem / eye */}
          <rect x="36" y="2" width="12" height="14" rx="4" fill={primaryLetterColor} />
          {/* Signature Vibrant Smile Arc */}
          <path
            d="M 0 12 C 0 46, 48 46, 48 12"
            stroke={`url(#${smileGradientId})`}
            strokeWidth="11"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* ================= LETTER 'm' ================= */}
        <g transform="translate(266, 20)">
          {/* Left stem */}
          <rect x="0" y="8" width="11" height="48" rx="5.5" fill={primaryLetterColor} />
          {/* First arch */}
          <path
            d="M 8 16 C 14 4, 34 4, 37 14 L 37 56 C 37 59, 27 59, 27 56 L 27 22 C 27 15, 17 15, 17 22 L 17 56 C 17 59, 8 59, 8 56 Z"
            fill={primaryLetterColor}
          />
          {/* Second arch */}
          <path
            d="M 35 16 C 41 4, 61 4, 64 14 L 64 56 C 64 59, 54 59, 54 56 L 54 22 C 54 15, 44 15, 44 22 L 44 56 C 44 59, 35 59, 35 56 Z"
            fill={primaryLetterColor}
          />
        </g>
      </svg>

      {withTagline && (
        <span
          style={{
            fontSize: `${Math.max(height * 0.22, 9)}px`,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: tagColor,
            fontWeight: 800,
            marginTop: '2px',
            paddingLeft: '4px',
            fontFamily: "'Manrope', sans-serif",
          }}
        >
          For The Greater Good
        </span>
      )}
    </div>
  );
};
