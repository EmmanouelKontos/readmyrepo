interface BrandLogoProps {
  size?: number;
  className?: string;
}

/**
 * ReadMyRepo "Summit" mark — a relief-shaded peak (lit face + shadow face, as on a relief map):
 * the bird's-eye view of a codebase, sheltering the root node of its dependency graph in the
 * brand accent. Drawn on a 32px grid so it holds from a 16px favicon up to app-icon sizes.
 */
export function BrandLogo({ size = 24, className = '' }: BrandLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 select-none ${className}`}
    >
      <rect width="32" height="32" rx="8" style={{ fill: 'var(--ink)' }} />
      <path d="M16 7 26 25.5h-5.4L16 16.9Z" style={{ fill: 'var(--on-ink)' }} />
      <path d="M16 7 6 25.5h5.4L16 16.9Z" style={{ fill: 'var(--on-ink)', opacity: 0.5 }} />
      <circle cx="16" cy="23.1" r="2.3" style={{ fill: 'var(--accent-brand)' }} />
    </svg>
  );
}
