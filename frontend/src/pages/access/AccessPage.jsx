import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button } from '../../components/ui/primitives.jsx';
import { Icon } from '../../components/ui/icons.jsx';

/*
 * Shared code-redemption page for captains and scorers. One input, generic
 * failure message (a wrong code is indistinguishable from an unknown one), and
 * a clean navigation on success — the code is never placed in the URL.
 *
 * Presented as an editorial split that mirrors the admin sign-in, so all three
 * staff entry points read as one family: a quiet identity rail on the left with
 * role-specific copy, the working redemption form on the right.
 */
const ROLE_COPY = {
  CAPTAIN: {
    title: 'Captain access',
    icon: Icon.Captain,
    rail: 'Lead your side.',
    lead:
      'Your roster, fixtures, standings and stats — everything your team needs, scoped to your side of the draw.',
  },
  SCORER: {
    title: 'Scorer access',
    icon: Icon.Scorer,
    rail: 'Score the match.',
    lead:
      'The live rally console — record every point fast on a phone, works offline mid-set, undo and substitutions built in.',
  },
};

export default function AccessPage({ role }) {
  const { user, setUser, ready } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const home = role === 'CAPTAIN' ? '/captain' : '/scorer';
  const copy = ROLE_COPY[role] || ROLE_COPY.CAPTAIN;
  const RoleIcon = copy.icon;

  // Already signed in with the right role → go home.
  if (ready && user && user.role === role) return <Navigate to={home} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const { user: me } = await authService.redeem(code.trim());
      setUser(me);
      const dest = me.role === 'CAPTAIN' ? '/captain' : me.role === 'SCORER' ? '/scorer' : '/';
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message || 'That code did not work');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink md:grid md:grid-cols-[1.1fr_1fr]">
      {/* Identity rail */}
      <aside className="hidden flex-col justify-between border-r border-rule bg-surface p-10 md:flex">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-green">
          VolleyOps
        </Link>
        <div>
          <span className="mb-5 inline-flex h-11 w-11 items-center justify-center border border-rule text-green" style={{ borderRadius: 'var(--radius-sm)' }}>
            {RoleIcon && <RoleIcon size={24} />}
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green">{copy.title}</p>
          <h1 className="mt-2 font-display text-6xl leading-none text-ink">{copy.rail}</h1>
          <p className="mt-4 max-w-sm text-sm text-muted">{copy.lead}</p>
        </div>
        <Link to="/staff" className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
          Not your role? See all staff access
        </Link>
      </aside>

      {/* Form */}
      <main className="flex min-h-screen items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="md:hidden">
            <Link to="/" className="text-sm font-semibold uppercase tracking-[0.2em] text-green">
              VolleyOps
            </Link>
          </div>
          <h2 className="mt-6 font-display text-4xl text-ink md:mt-0">{copy.title}</h2>
          <p className="mt-1 text-sm text-muted">
            Enter the access code your tournament admin shared with you.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
            {error && (
              <div
                role="alert"
                className="border border-scoreRed bg-surface px-3 py-2 text-sm text-scoreRed"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="code" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Access code
              </label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                className="tnum w-full border border-rule bg-surface px-3 py-3 text-lg tracking-widest text-ink placeholder:text-muted outline-none transition focus:border-ink"
                style={{ borderRadius: 'var(--radius-sm)' }}
              />
            </div>

            <Button type="submit" variant="primary" className="w-full py-3" disabled={busy || !code.trim()}>
              {busy ? 'Checking…' : 'Continue'}
            </Button>
          </form>

          <div className="mt-6 rule-t border-rule pt-4">
            <Link to="/" className="text-sm text-graphite underline-offset-2 hover:text-green hover:underline">
              ← Back to the tournament
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
