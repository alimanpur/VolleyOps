import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService.js';
import { useAuth } from '../../context/AuthContext.jsx';

/*
 * Standalone admin sign-in. Rendered outside every layout (App.jsx maps
 * /admin/login straight here). Editorial split: a quiet identity rail on the
 * left, the working form on the right. On success we seed the auth context and
 * head to the workspace; failures surface one honest, generic message.
 */
export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const resp = await authService.loginAdmin(username.trim(), password);
      setUser(resp.user);
      navigate('/admin');
    } catch (err) {
      setError(err?.message || 'Could not sign you in. Check your credentials and try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink md:grid md:grid-cols-[1.1fr_1fr]">
      {/* Identity rail */}
      <aside className="hidden flex-col justify-between border-r border-rule bg-surface p-10 md:flex">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-green">
          VolleyOps
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green">Control room</p>
          <h1 className="mt-2 font-display text-6xl leading-none text-ink">
            Run the<br />tournament.
          </h1>
          <p className="mt-4 max-w-sm text-sm text-muted">
            Fixtures, rosters, scoring assignments and results — the operational
            backbone behind every match on court.
          </p>
        </div>
        <p className="text-xs text-muted">Admin access only.</p>
      </aside>

      {/* Form */}
      <main className="flex min-h-screen items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="md:hidden">
            <Link to="/" className="text-sm font-semibold uppercase tracking-[0.2em] text-green">
              VolleyOps
            </Link>
          </div>
          <h2 className="mt-6 font-display text-4xl text-ink md:mt-0">Admin sign in</h2>
          <p className="mt-1 text-sm text-muted">Enter your operator credentials.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
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
              <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-rule bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-ink"
                style={{ borderRadius: 'var(--radius-sm)' }}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-rule bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-ink"
                style={{ borderRadius: 'var(--radius-sm)' }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 bg-green px-4 py-2.5 text-sm font-medium text-white transition hover:bg-deepGreen disabled:pointer-events-none disabled:opacity-50"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
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
