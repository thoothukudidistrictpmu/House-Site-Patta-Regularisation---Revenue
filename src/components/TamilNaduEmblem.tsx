import React from 'react';

interface EmblemProps {
  className?: string;
  size?: number;
}

export const TamilNaduEmblem: React.FC<EmblemProps> = ({ className = 'w-10 h-10', size }) => {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Government of Tamil Nadu Emblem"
    >
      {/* Outer decorative circular border */}
      <circle cx="60" cy="60" r="56" stroke="#0F2D4A" strokeWidth="3" fill="#FFFFFF" />
      <circle cx="60" cy="60" r="52" stroke="#0D9488" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />

      {/* Outer Ring Background */}
      <circle cx="60" cy="60" r="48" fill="#F8FAFC" />

      {/* Upper text arc guide placeholder - Tamil Nadu text */}
      <path id="curve-top" d="M 22 60 A 38 38 0 0 1 98 60" fill="none" />
      <text fill="#0F2D4A" fontSize="7.5" fontWeight="700" letterSpacing="0.8">
        <textPath href="#curve-top" startOffset="50%" textAnchor="middle">
          தமிழ்நாடு அரசு
        </textPath>
      </text>

      {/* Srivilliputhur Gopuram (Temple Tower) Motif */}
      <g transform="translate(36, 32)">
        {/* Kalasam finials on top */}
        <path d="M 24 4 L 24 1 M 21 5 L 21 2 M 27 5 L 27 2" stroke="#B45309" strokeWidth="1.5" strokeLinecap="round" />

        {/* Tier 1 top roof */}
        <path d="M 17 6 L 31 6 L 29 11 L 19 11 Z" fill="#0F2D4A" />
        <rect x="22" y="8" width="4" height="3" fill="#F8FAFC" />

        {/* Tier 2 */}
        <path d="M 14 12 L 34 12 L 32 18 L 16 18 Z" fill="#1E3A8A" />
        <rect x="18" y="14" width="3" height="4" fill="#F8FAFC" />
        <rect x="23" y="14" width="3" height="4" fill="#F8FAFC" />
        <rect x="27" y="14" width="3" height="4" fill="#F8FAFC" />

        {/* Tier 3 */}
        <path d="M 11 19 L 37 19 L 35 26 L 13 26 Z" fill="#0F2D4A" />
        <rect x="15" y="21" width="3.5" height="5" fill="#F8FAFC" />
        <rect x="22" y="21" width="4" height="5" fill="#0D9488" />
        <rect x="29" y="21" width="3.5" height="5" fill="#F8FAFC" />

        {/* Tier 4 base */}
        <path d="M 8 27 L 40 27 L 39 36 L 9 36 Z" fill="#1E3A8A" />
        {/* Main Gopuram archway entrance */}
        <path d="M 19 36 C 19 30 29 30 29 36 Z" fill="#F8FAFC" stroke="#0F2D4A" strokeWidth="1" />
        <rect x="12" y="29" width="3" height="6" fill="#F8FAFC" />
        <rect x="33" y="29" width="3" height="6" fill="#F8FAFC" />

        {/* Base steps */}
        <rect x="5" y="37" width="38" height="3" fill="#0D9488" rx="1" />
      </g>

      {/* Lower Ribbon Banner with "வாய்மையே வெல்லும்" */}
      <g transform="translate(20, 84)">
        <path
          d="M 6 4 C 20 -2 60 -2 74 4 L 78 14 C 60 9 20 9 2 14 Z"
          fill="#0F2D4A"
        />
        <text
          x="40"
          y="8.5"
          fill="#FFFFFF"
          fontSize="5.2"
          fontWeight="bold"
          textAnchor="middle"
          letterSpacing="0.5"
        >
          வாய்மையே வெல்லும்
        </text>
      </g>

      {/* Ashoka Lion / Star Accent at bottom */}
      <circle cx="60" cy="104" r="2.5" fill="#0D9488" />
      <circle cx="53" cy="103" r="1.5" fill="#0F2D4A" />
      <circle cx="67" cy="103" r="1.5" fill="#0F2D4A" />
    </svg>
  );
};
