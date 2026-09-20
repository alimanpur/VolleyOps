import { Link } from 'react-router-dom';

/*
 * Small, composable primitives. Deliberately not a "card kit" — cards are used
 * only where grouping is real. Most structure comes from 1px rules + whitespace.
 */

const RADIUS = { borderRadius: 'var(--radius-sm)' };

export function Button({ variant = 'primary', as, to, className = '', children, ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition select-none disabled:opacity-50 disabled:pointer-events-none';
  const variants = {
    primary: 'bg-green text-white hover:bg-deepGreen',
    ink: 'bg-ink text-paper hover:bg-graphite',
    outline: 'border border-ink text-ink hover:bg-ink hover:text-paper',
    quiet: 'border border-rule text-graphite hover:border-ink',
    danger: 'border border-scoreRed text-scoreRed hover:bg-scoreRed hover:text-white',
  };
  const cls = `${base} ${variants[variant]} ${className}`;
  if (to) return <Link to={to} className={cls} style={RADIUS}>{children}</Link>;
  const Comp = as || 'button';
  return (
    <Comp className={cls} style={RADIUS} {...props}>
      {children}
    </Comp>
  );
}

/** Status badge with a state-aware treatment. LIVE is unmistakable. */
export function StatusBadge({ state }) {
  const map = {
    LIVE: { label: 'Live', cls: 'text-white bg-scoreRed', dot: true },
    FINISHED: { label: 'Final', cls: 'text-white bg-ink' },
    LOCKED: { label: 'Final', cls: 'text-white bg-ink' },
    SCHEDULED: { label: 'Scheduled', cls: 'text-graphite border border-rule' },
    PRE_MATCH: { label: 'Ready', cls: 'text-green border border-green' },
    SET_COMPLETE: { label: 'Between sets', cls: 'text-amber border border-amber' },
    MATCH_DECIDED: { label: 'Decided', cls: 'text-white bg-ink' },
    CANCELLED: { label: 'Cancelled', cls: 'text-muted border border-rule line-through' },
  };
  const s = map[state] || { label: state, cls: 'text-muted border border-rule' };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${s.cls}`}
      style={{ borderRadius: 'var(--radius-xs)' }}
    >
      {s.dot && <span className="inline-block h-1.5 w-1.5 rounded-full bg-white live-dot" />}
      {s.label}
    </span>
  );
}

/** Section header: a title with an optional hairline and trailing action. */
export function SectionHead({ title, kicker, action }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 rule-b border-rule pb-2">
      <div>
        {kicker && <p className="text-xs font-semibold uppercase tracking-wider text-green">{kicker}</p>}
        <h2 className="font-display text-2xl text-ink sm:text-3xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Pill({ children, tone = 'muted' }) {
  const tones = {
    muted: 'text-muted border-rule',
    green: 'text-green border-green',
    ink: 'text-ink border-ink',
  };
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
      style={{ borderRadius: 'var(--radius-xs)' }}
    >
      {children}
    </span>
  );
}

/** A team color chip, mapping the palette tokens. */
export function TeamChip({ colorToken = 'graphite' }) {
  const colors = {
    green: '#0F6B3C',
    amber: '#B7791F',
    graphite: '#2A2B2A',
    deepGreen: '#0A4A2A',
    scoreRed: '#C8321F',
  };
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 shrink-0"
      style={{ background: colors[colorToken] || colors.graphite, borderRadius: 'var(--radius-xs)' }}
    />
  );
}

export function Card({ className = '', children, ...props }) {
  return (
    <div
      className={`border border-rule bg-surface ${className}`}
      style={RADIUS}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Page header for interior pages: an optional kicker, a large display title, a
 * lead paragraph, and a trailing action slot. More generous than SectionHead,
 * which is for sections within a page.
 */
export function PageHeader({ kicker, title, lead, action, className = '' }) {
  return (
    <div className={`rule-b border-rule pb-5 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {kicker && (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green">{kicker}</p>
          )}
          <h1 className="mt-1 font-display text-4xl leading-none text-ink sm:text-5xl">{title}</h1>
          {lead && <p className="mt-3 max-w-2xl text-sm text-muted">{lead}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

/**
 * A single staff-role entry point: icon, role, one-line purpose, how they enter,
 * and what they can do. Renders as a Link into the existing auth flow. Editorial
 * treatment — a framed row with a hairline, not a glossy SaaS card.
 */
export function StaffAccessCard({ to, icon: IconGlyph, role, purpose, entry, points = [] }) {
  return (
    <Link
      to={to}
      className="group flex flex-col border border-rule bg-surface p-5 transition hover:border-ink focus-visible:border-ink"
      style={RADIUS}
    >
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center border border-rule text-green transition group-hover:border-green" style={{ borderRadius: 'var(--radius-sm)' }}>
          {IconGlyph && <IconGlyph size={22} />}
        </span>
        <span className="text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true">→</span>
      </div>
      <h3 className="mt-4 font-display text-2xl text-ink">{role}</h3>
      <p className="mt-1 text-sm text-graphite">{purpose}</p>
      {entry && (
        <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted">{entry}</p>
      )}
      {points.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {points.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-green" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}
