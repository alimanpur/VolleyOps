import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { adminService } from '../../services/adminService.js';
import { AsyncView } from '../../components/ui/states.jsx';
import { SectionHead, Button, Pill, TeamChip } from '../../components/ui/primitives.jsx';

/*
 * Roster editor for a single team. Completeness banner up top from the server's
 * report, then the squad split into Active and Standby. Players edit inline
 * (status, position, jersey, year); a captain can be set only when active. The
 * API enforces year-eligibility and the 6+1 shape, so its errors surface here
 * verbatim rather than being second-guessed on the client.
 */

const POSITIONS = ['SETTER', 'OUTSIDE', 'MIDDLE', 'OPPOSITE', 'LIBERO', 'UNSPECIFIED'];
const inputCls = 'w-full border border-rule bg-paper px-2.5 py-2 text-sm text-ink outline-none transition focus:border-ink';
const inputStyle = { borderRadius: 'var(--radius-xs)' };

export default function AdminTeamRoster() {
  const { teamId } = useParams();
  const query = useApi(() => adminService.teamRoster(teamId), [teamId]);

  return (
    <div className="space-y-8">
      <div>
        <Link to="/admin/teams" className="text-sm text-graphite underline-offset-2 hover:text-green hover:underline">
          ← All teams
        </Link>
      </div>
      <AsyncView query={query} label="Loading roster">
        {(data) => <RosterEditor data={data} refetch={() => query.refetch({ quiet: true })} teamId={teamId} />}
      </AsyncView>
    </div>
  );
}

function RosterEditor({ data, refetch, teamId }) {
  const { team, players = [], report = {} } = data;
  const active = players.filter((p) => p.status === 'ACTIVE');
  const standby = players.filter((p) => p.status === 'STANDBY');

  return (
    <div className="space-y-8">
      <SectionHead
        kicker="Roster"
        title={
          <span className="inline-flex items-center gap-2">
            <TeamChip colorToken={team.colorToken} /> {team.name}
          </span>
        }
      />

      {/* Completeness banner */}
      <div
        className={`border px-4 py-3 ${report.complete ? 'border-green' : 'border-amber'}`}
        style={{ borderRadius: 'var(--radius-sm)' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className={`text-sm font-semibold ${report.complete ? 'text-green' : 'text-amber'}`}>
            {report.complete ? 'Roster complete' : 'Roster incomplete'}
          </span>
          <span className="tnum text-xs text-muted">
            Active {report.activeCount ?? active.length}/{report.activeRequired ?? 6} ·
            Standby {report.standbyCount ?? standby.length}/{report.standbyRequired ?? 1} ·
            Captain {report.hasCaptain ? 'set' : 'missing'}
          </span>
        </div>
        {report.issues?.length > 0 && (
          <ul className="mt-2 space-y-1">
            {report.issues.map((i, idx) => (
              <li key={idx} className="text-xs text-amber">• {i.message}</li>
            ))}
          </ul>
        )}
      </div>

      <AddPlayerForm teamId={teamId} teamYear={team.year} onDone={refetch} />

      <RosterGroup title="Active" players={active} refetch={refetch} teamId={teamId} />
      <RosterGroup title="Standby" players={standby} refetch={refetch} teamId={teamId} />
    </div>
  );
}

function RosterGroup({ title, players, refetch, teamId }) {
  return (
    <section>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green">
        {title} <span className="tnum text-muted">({players.length})</span>
      </p>
      {players.length === 0 ? (
        <p className="rule-t rule-b border-rule py-5 text-sm text-muted">No {title.toLowerCase()} players.</p>
      ) : (
        <div className="scroll-x border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="rule-b border-rule text-left text-xs uppercase tracking-wider text-muted">
                <th scope="col" className="px-3 py-2.5 font-semibold">#</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Name</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Year</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Position</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <PlayerRow key={p.id} player={p} refetch={refetch} teamId={teamId} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PlayerRow({ player, refetch, teamId }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function patch(data) {
    setBusy(true);
    setError(null);
    try {
      await adminService.updatePlayer(player.id, data);
      await refetch();
    } catch (err) {
      setError(err?.message || (err?.details ? JSON.stringify(err.details) : 'Update failed.'));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!window.confirm(`Remove ${player.name} from the roster?`)) return;
    setBusy(true);
    setError(null);
    try {
      await adminService.deletePlayer(player.id);
      await refetch();
    } catch (err) {
      setError(err?.message || 'Could not remove the player.');
      setBusy(false);
    }
  }

  async function onSetCaptain() {
    setBusy(true);
    setError(null);
    try {
      await adminService.setCaptain(teamId, player.id);
      await refetch();
    } catch (err) {
      setError(err?.message || 'Could not set captain.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <tr className="rule-b border-rule align-middle last:border-0">
        <td className="px-3 py-2.5">
          <label className="sr-only" htmlFor={`j-${player.id}`}>Jersey for {player.name}</label>
          <input
            id={`j-${player.id}`}
            type="number"
            defaultValue={player.jerseyNumber ?? ''}
            disabled={busy}
            onBlur={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              if (v !== (player.jerseyNumber ?? null)) patch({ jerseyNumber: v });
            }}
            className="tnum w-16 border border-rule bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-ink disabled:opacity-50"
            style={inputStyle}
          />
        </td>
        <td className="px-3 py-2.5">
          <span className="font-medium text-ink">{player.name}</span>
          {player.isCaptain && <Pill tone="green">Captain</Pill>}
        </td>
        <td className="px-3 py-2.5">
          <label className="sr-only" htmlFor={`y-${player.id}`}>Year for {player.name}</label>
          <select
            id={`y-${player.id}`}
            value={player.year}
            disabled={busy}
            onChange={(e) => patch({ year: Number(e.target.value) })}
            className="border border-rule bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-ink disabled:opacity-50"
            style={inputStyle}
          >
            {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Yr {y}</option>)}
          </select>
        </td>
        <td className="px-3 py-2.5">
          <label className="sr-only" htmlFor={`p-${player.id}`}>Position for {player.name}</label>
          <select
            id={`p-${player.id}`}
            value={player.position}
            disabled={busy}
            onChange={(e) => patch({ position: e.target.value })}
            className="border border-rule bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-ink disabled:opacity-50"
            style={inputStyle}
          >
            {POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
          </select>
        </td>
        <td className="px-3 py-2.5">
          <label className="sr-only" htmlFor={`s-${player.id}`}>Status for {player.name}</label>
          <select
            id={`s-${player.id}`}
            value={player.status}
            disabled={busy}
            onChange={(e) => patch({ status: e.target.value })}
            className="border border-rule bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-ink disabled:opacity-50"
            style={inputStyle}
          >
            <option value="ACTIVE">Active</option>
            <option value="STANDBY">Standby</option>
          </select>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex justify-end gap-1.5">
            {!player.isCaptain && player.status === 'ACTIVE' && (
              <button
                type="button"
                disabled={busy}
                onClick={onSetCaptain}
                className="border border-rule px-2 py-1 text-xs font-medium text-graphite transition hover:border-ink hover:text-ink disabled:opacity-40"
                style={inputStyle}
              >
                Make captain
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="border border-scoreRed px-2 py-1 text-xs font-medium text-scoreRed transition hover:bg-scoreRed hover:text-white disabled:opacity-40"
              style={inputStyle}
            >
              Remove
            </button>
          </div>
        </td>
      </tr>
      {error && (
        <tr className="rule-b border-rule">
          <td colSpan={6} className="px-3 pb-2">
            <p className="text-xs font-medium text-scoreRed">{error}</p>
          </td>
        </tr>
      )}
    </>
  );
}

function AddPlayerForm({ teamId, teamYear, onDone }) {
  const empty = { name: '', jerseyNumber: '', year: teamYear || 1, position: 'UNSPECIFIED', status: 'ACTIVE' };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminService.createPlayer(teamId, {
        name: form.name,
        jerseyNumber: form.jerseyNumber === '' ? null : Number(form.jerseyNumber),
        year: Number(form.year),
        position: form.position,
        status: form.status,
      });
      setForm(empty);
      await onDone();
    } catch (err) {
      setError(err?.message || (err?.details ? JSON.stringify(err.details) : 'Could not add the player.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="border border-rule bg-surface p-4" style={{ borderRadius: 'var(--radius-sm)' }}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green">Add a player</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <label htmlFor="np-name" className="block text-xs font-semibold uppercase tracking-wider text-muted">Name</label>
          <input id="np-name" required value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} style={inputStyle} />
        </div>
        <div className="space-y-1">
          <label htmlFor="np-jersey" className="block text-xs font-semibold uppercase tracking-wider text-muted">Jersey</label>
          <input id="np-jersey" type="number" value={form.jerseyNumber}
            onChange={(e) => setForm({ ...form, jerseyNumber: e.target.value })} className={inputCls} style={inputStyle} />
        </div>
        <div className="space-y-1">
          <label htmlFor="np-year" className="block text-xs font-semibold uppercase tracking-wider text-muted">Year</label>
          <select id="np-year" value={form.year}
            onChange={(e) => setForm({ ...form, year: e.target.value })} className={inputCls} style={inputStyle}>
            {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="np-pos" className="block text-xs font-semibold uppercase tracking-wider text-muted">Position</label>
          <select id="np-pos" value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })} className={inputCls} style={inputStyle}>
            {POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="np-status" className="block text-xs font-semibold uppercase tracking-wider text-muted">Status</label>
          <select id="np-status" value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls} style={inputStyle}>
            <option value="ACTIVE">Active</option>
            <option value="STANDBY">Standby</option>
          </select>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-scoreRed">{error}</p>}
      <div className="mt-4">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Adding…' : 'Add player'}
        </Button>
      </div>
    </form>
  );
}
