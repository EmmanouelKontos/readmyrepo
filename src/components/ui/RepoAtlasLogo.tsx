interface RepoAtlasLogoProps {
  size?: number;
  className?: string;
}

export function RepoAtlasLogo({ size = 34, className = '' }: RepoAtlasLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 select-none ${className}`}
    >
      {/* Squircle Container */}
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="15"
        fill="var(--bg-elevated)"
        stroke="var(--border-strong)"
        strokeWidth="1.75"
      />

      {/* Inner Tonal Halo */}
      <circle
        cx="32"
        cy="32"
        r="22"
        fill="var(--accent-brand-soft)"
      />

      {/* Astrolabe Orbital Ring */}
      <circle
        cx="32"
        cy="32"
        r="21"
        stroke="var(--accent-brand)"
        strokeOpacity="0.45"
        strokeWidth="1.4"
        strokeDasharray="3 3"
      />

      {/* Cardinal Precision Ticks */}
      <path
        d="M32 7.5V11.5M32 52.5V56.5M7.5 32H11.5M52.5 32H56.5"
        stroke="var(--accent-brand)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* AST Directed Graph Triangle */}
      <path
        d="M18.5 43.5L32 15.5L45.5 42.5L18.5 43.5Z"
        stroke="var(--text-primary)"
        strokeOpacity="0.55"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Compass Needle North (Terracotta Brand Accent) */}
      <polygon
        points="32,13.5 36.8,32 32,29.2 27.2,32"
        fill="var(--accent-brand)"
      />

      {/* Compass Needle South (Primary Ink/Parchment) */}
      <polygon
        points="32,50.5 36.8,32 32,34.8 27.2,32"
        fill="var(--text-primary)"
        fillOpacity="0.78"
      />

      {/* AST Graph Vertex Nodes */}
      <circle
        cx="32"
        cy="14.5"
        r="3.6"
        fill="var(--accent-brand)"
        stroke="var(--bg-surface)"
        strokeWidth="1.5"
      />
      <circle
        cx="18"
        cy="43.5"
        r="3.2"
        fill="var(--text-primary)"
        stroke="var(--bg-surface)"
        strokeWidth="1.5"
      />
      <circle
        cx="46"
        cy="42.5"
        r="3.2"
        fill="var(--text-primary)"
        stroke="var(--bg-surface)"
        strokeWidth="1.5"
      />

      {/* Center Pivot */}
      <circle cx="32" cy="32" r="2.2" fill="var(--bg-surface)" />
    </svg>
  );
}
