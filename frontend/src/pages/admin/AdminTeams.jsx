import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { adminService } from '../../services/adminService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { SectionHead, Button, TeamChip } from '../../components/ui/primitives.jsx';

/*
 * Team registry. A dense table showing each team's roster completeness at a
 * glance (green Complete, or an amber issue count), with the create form kept
 * inline above. Each row links to its roster editor. Edit and delete live on
 * the row; delete confirms first since it takes the players with it.
 */

const COLOR_TOKENS = ['green', 'amber', 'graphite', 'deepGreen', 'scoreRed'];
const EMPTY = { code: '', name: '', shortName: '', year: 1, colorToken: 'graphite' };

export default function AdminTeams() {
  const query = useApi(() => adminService.teams(), []);
  const [form, setForm] = useState(EMPTY);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function onCreate(e) {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      await adminService.createTeam({ ...form, year: Number(form.year) });
      setForm(EMPTY);
      await query.refetch({ quiet: true });
    } catch (err) {
      setFormError(err?.message || 'Could not create the team.');
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(team) {
    if (!window.confirm(`Delete ${team.name}? This removes the team and all its players.`)) return;
    setBusyId(team.id);
    try {
      await adminService.deleteTeam(team.id);
      await query.refetch({ quiet: true });
    } catch (err) {
      window.alert(err?.message || 'Could not delete the team.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <SectionHead kicker="Registry" title="Teams" />

      {/* Create */}
      <form
        onSubmit={onCreate}
        className="border border-rule bg-surface p-4"
        style={{ borderRadius: 'var(--radius-sm)' }}
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green">Add a team</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Code" htmlFor="t-code">
            <input id="t-code" required value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className={inputCls} style={inputStyle} />
          </Field>
          <Field label="Name" htmlFor="t-name">
            <input id="t-name" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls} style={inputStyle} />
          </Field>
          <Field label="Short name" htmlFor="t-short">
            <input id="t-short" value={form.shortName}
              onChange={(e) => setForm({ ...form, shortName: e.target.value })}
              className={inputCls} style={inputStyle} />
          </Field>
          <Field label="Year" htmlFor="t-year">
            <select id="t-year" value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
              className={inputCls} style={inputStyle}>
              {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </Field>
          <Field label="Colour" htmlFor="t-color">
            <select id="t-color" value={form.colorToken}
              onChange={(e) => setForm({ ...form, colorToken: e.target.value })}
              className={inputCls} style={inputStyle}>
              {COLOR_TOKENS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        {formError && <p className="mt-3 text-sm text-scoreRed">{formError}</p>}
        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create team'}
          </Button>
          <span className="inline-flex items-center gap-2 text-xs text-muted">
            <TeamChip colorToken={form.colorToken} /> preview
          </span>
        </div>
      </form>

      {/* List */}
      <AsyncView
        query={query}
        label="Loading teams"
        emptyWhen={(d) => !d.teams?.length}
        empty={<EmptyState title="No teams yet" hint="Add your first team above to start building the tournament." />}
      >
        {({ teams }) => (
          <div className="scroll-x border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="rule-b border-rule text-left text-xs uppercase tracking-wider text-muted">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Team</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Code</th>
                  <th scope="col" className="px-4 py-2.5 text-center font-semibold">Year</th>
                  <th scope="col" className="px-4 py-2.5 text-center font-semibold">Active</th>
                  <th scope="col" className="px-4 py-2.5 text-center font-semibold">Standby</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Roster</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => {
                  const r = team.report || {};
                  return (
                    <tr key={team.id} className="rule-b border-rule last:border-0">
                      <td className="px-4 py-3">
                        <Link to={`/admin/teams/${team.id}`} className="flex items-center gap-2 font-medium text-ink hover:text-green">
                          <TeamChip colorToken={team.colorToken} />
                          {team.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{team.code}</td>
                      <td className="tnum px-4 py-3 text-center text-graphite">{team.year}</td>
                      <td className="tnum px-4 py-3 text-center text-graphite">
                        {r.activeCount ?? 0}/{r.activeRequired ?? 6}
                      </td>
                      <td className="tnum px-4 py-3 text-center text-graphite">
                        {r.standbyCount ?? 0}/{r.standbyRequired ?? 1}
                      </td>
                      <td className="px-4 py-3">
                        {r.complete ? (
                          <span className="text-xs font-semibold text-green">Complete</span>
                        ) : (
                          <span className="text-xs font-semibold text-amber">
                            {r.issues?.length || 0} issue{(r.issues?.length || 0) === 1 ? '' : 's'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Link
                            to={`/admin/teams/${team.id}`}
                            className="border border-rule px-2 py-1 text-xs font-medium text-graphite transition hover:border-ink hover:text-ink"
                            style={{ borderRadius: 'var(--radius-xs)' }}
                          >
                            Roster
                          </Link>
                          <button
                            type="button"
                            disabled={busyId === team.id}
                            onClick={() => onDelete(team)}
                            className="border border-scoreRed px-2 py-1 text-xs font-medium text-scoreRed transition hover:bg-scoreRed hover:text-white disabled:opacity-40"
                            style={{ borderRadius: 'var(--radius-xs)' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AsyncView>
    </div>
  );
}

const inputCls = 'w-full border border-rule bg-paper px-2.5 py-2 text-sm text-ink outline-none transition focus:border-ink';
const inputStyle = { borderRadius: 'var(--radius-xs)' };

function Field({ label, htmlFor, children }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
