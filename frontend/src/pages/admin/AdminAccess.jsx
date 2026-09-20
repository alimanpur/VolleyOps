import { useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { adminService } from '../../services/adminService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { SectionHead, Button, Pill } from '../../components/ui/primitives.jsx';

/*
 * Access control for captains and scorers. Creating an account mints a one-time
 * redemption code — shown once in a prominent, copyable callout, because it is
 * never retrievable again. Regenerating issues a fresh code and invalidates the
 * old one; revoking cuts access entirely.
 */

const inputCls = 'w-full border border-rule bg-paper px-2.5 py-2 text-sm text-ink outline-none transition focus:border-ink';
const inputStyle = { borderRadius: 'var(--radius-xs)' };

export default function AdminAccess() {
  const query = useApi(() => adminService.access(), []);
  const teams = useApi(() => adminService.teams(), []);
  const [issued, setIssued] = useState(null); // { code, label, note }
  const [busyId, setBusyId] = useState(null);

  const teamList = teams.data?.teams || [];

  async function onRegenerate(user) {
    if (!window.confirm(`Regenerate the code for ${user.displayName}? The current code stops working immediately.`)) return;
    setBusyId(user.id);
    try {
      const { code } = await adminService.regenerateAccess(user.id);
      setIssued({ code, label: user.displayName, note: 'The previous code has been invalidated.' });
      await query.refetch({ quiet: true });
    } catch (err) {
      window.alert(err?.message || 'Could not regenerate the code.');
    } finally {
      setBusyId(null);
    }
  }

  async function onRevoke(user) {
    if (!window.confirm(`Revoke access for ${user.displayName}? They will be signed out and lose access.`)) return;
    setBusyId(user.id);
    try {
      await adminService.revokeAccess(user.id);
      await query.refetch({ quiet: true });
    } catch (err) {
      window.alert(err?.message || 'Could not revoke access.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <SectionHead kicker="Roles" title="Access" />

      {issued && (
        <CodeCallout issued={issued} onDismiss={() => setIssued(null)} />
      )}

      <CreateAccess
        teams={teamList}
        onIssued={(payload) => setIssued(payload)}
        onDone={() => query.refetch({ quiet: true })}
      />

      <AsyncView
        query={query}
        label="Loading access"
        emptyWhen={(d) => !d.users?.length}
        empty={<EmptyState title="No captains or scorers yet" hint="Create access above to invite them." />}
      >
        {({ users }) => (
          <div className="scroll-x border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="rule-b border-rule text-left text-xs uppercase tracking-wider text-muted">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Role</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Team</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Code</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="rule-b border-rule last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{u.displayName}</td>
                    <td className="px-4 py-3"><Pill tone="ink">{u.role}</Pill></td>
                    <td className="px-4 py-3 text-graphite">{u.team?.name || '—'}</td>
                    <td className="px-4 py-3">
                      {u.redeemed ? (
                        <span className="text-xs font-semibold text-green">Redeemed</span>
                      ) : u.hasCode ? (
                        <span className="text-xs font-semibold text-amber">Code active</span>
                      ) : (
                        <span className="text-xs text-muted">No code</span>
                      )}
                      {u.codeVersion > 0 && <span className="tnum ml-2 text-xs text-muted">v{u.codeVersion}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === u.id}
                          onClick={() => onRegenerate(u)}
                          className="border border-rule px-2 py-1 text-xs font-medium text-graphite transition hover:border-ink hover:text-ink disabled:opacity-40"
                          style={inputStyle}
                        >
                          Regenerate
                        </button>
                        <button
                          type="button"
                          disabled={busyId === u.id}
                          onClick={() => onRevoke(u)}
                          className="border border-scoreRed px-2 py-1 text-xs font-medium text-scoreRed transition hover:bg-scoreRed hover:text-white disabled:opacity-40"
                          style={inputStyle}
                        >
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncView>
    </div>
  );
}

function CodeCallout({ issued, onDismiss }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(issued.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="border-2 border-green bg-greenTint px-5 py-4" style={{ borderRadius: 'var(--radius-sm)' }} role="alert">
      <p className="text-xs font-semibold uppercase tracking-wider text-green">Access code for {issued.label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <code className="tnum select-all font-display text-3xl tracking-widest text-ink">{issued.code}</code>
        <Button variant="ink" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
        <button type="button" onClick={onDismiss} className="text-sm text-graphite underline-offset-2 hover:text-ink hover:underline">
          Dismiss
        </button>
      </div>
      <p className="mt-2 text-sm text-deepGreen">
        Share this code once — it won&apos;t be shown again.{issued.note ? ` ${issued.note}` : ''}
      </p>
    </div>
  );
}

function CreateAccess({ teams, onIssued, onDone }) {
  const [form, setForm] = useState({ role: 'SCORER', displayName: '', teamId: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { role: form.role, displayName: form.displayName.trim() };
      if (form.role === 'CAPTAIN') payload.teamId = form.teamId;
      const { code } = await adminService.createAccess(payload);
      onIssued({ code, label: form.displayName.trim(), note: '' });
      setForm({ role: 'SCORER', displayName: '', teamId: '' });
      await onDone();
    } catch (err) {
      setError(err?.message || 'Could not create access.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="border border-rule bg-surface p-4" style={{ borderRadius: 'var(--radius-sm)' }}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green">Create access</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="ac-role" className="block text-xs font-semibold uppercase tracking-wider text-muted">Role</label>
          <select id="ac-role" value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value, teamId: '' })} className={inputCls} style={inputStyle}>
            <option value="SCORER">Scorer</option>
            <option value="CAPTAIN">Captain</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="ac-name" className="block text-xs font-semibold uppercase tracking-wider text-muted">Display name</label>
          <input id="ac-name" required value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })} className={inputCls} style={inputStyle} />
        </div>
        <div className="space-y-1">
          <label htmlFor="ac-team" className="block text-xs font-semibold uppercase tracking-wider text-muted">
            Team {form.role === 'CAPTAIN' ? '(required)' : '(captains only)'}
          </label>
          <select id="ac-team" value={form.teamId} disabled={form.role !== 'CAPTAIN'} required={form.role === 'CAPTAIN'}
            onChange={(e) => setForm({ ...form, teamId: e.target.value })} className={inputCls} style={inputStyle}>
            <option value="">{form.role === 'CAPTAIN' ? 'Select team' : '—'}</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-scoreRed">{error}</p>}
      <div className="mt-4">
        <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Creating…' : 'Create & issue code'}</Button>
      </div>
    </form>
  );
}
