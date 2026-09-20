/*
 * One icon language for the whole app: 24×24 viewBox, stroke-based, currentColor,
 * 1.75 stroke width, round caps/joins. Inline SVG so there is no icon-library
 * dependency and no mixed stroke weights. Keep the set small and purposeful.
 */

function Svg({ children, size = 20, className = '', ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  // Tournament control — a sliders/console glyph
  Admin: (p) => (
    <Svg {...p}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2" fill="var(--color-surface)" />
      <circle cx="15" cy="12" r="2" fill="var(--color-surface)" />
      <circle cx="8" cy="18" r="2" fill="var(--color-surface)" />
    </Svg>
  ),
  // Captain — a whistle/people glyph (team lead)
  Captain: (p) => (
    <Svg {...p}>
      <path d="M17 7h-6a4 4 0 0 0 0 8h2l3 3v-3a4 4 0 0 0 1-8Z" />
      <circle cx="6" cy="11" r="1" />
    </Svg>
  ),
  // Scorer — a stopwatch (live, fast operation)
  Scorer: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="13" r="7" />
      <line x1="12" y1="13" x2="12" y2="9" />
      <line x1="9" y1="2" x2="15" y2="2" />
      <line x1="12" y1="2" x2="12" y2="4" />
    </Svg>
  ),
  Live: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4" />
    </Svg>
  ),
  Menu: (p) => (
    <Svg {...p}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </Svg>
  ),
  Close: (p) => (
    <Svg {...p}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </Svg>
  ),
  Search: (p) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </Svg>
  ),
  ArrowRight: (p) => (
    <Svg {...p}>
      <line x1="4" y1="12" x2="20" y2="12" />
      <path d="M14 6l6 6-6 6" />
    </Svg>
  ),
  ArrowLeft: (p) => (
    <Svg {...p}>
      <line x1="20" y1="12" x2="4" y2="12" />
      <path d="M10 6l-6 6 6 6" />
    </Svg>
  ),
  Key: (p) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="4" />
      <path d="M11 11l8 8M16 16l2-2M18.5 18.5l1.5-1.5" />
    </Svg>
  ),
  Lock: (p) => (
    <Svg {...p}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  ),
};

export default Icon;
