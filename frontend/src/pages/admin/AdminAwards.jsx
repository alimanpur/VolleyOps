import { useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { adminService } from '../../services/adminService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { SectionHead, Button, Pill } from '../../components/ui/primitives.jsx';

/*
 * Award management. Each award edits its title and description in place, picks a
 * winner from the tournament's player pool, and toggles published (published is
 * the gate that lets the award surface to spectators). New awards are created by
 * key up top. The player pool comes from the stats endpoint.
 */

const inputCls = 'w-full border border-rule bg-paper px-2.5 py-2 text-sm text-ink outline-none transition focus:border-ink';
const inputStyle = { borderRadius: 'var(--radius-xs)' };

export default function AdminAwards() {
  const query = useApi(() => adminService.awards(), []);
  const stats = useApi(() => adminService.stats(), []);

  const players = (stats.data?.stats || []).map((s) => ({
    id: s.player?.id || s.playerId,
    name: s.player?.name,
    team: s.team,
  }));

  return (
    <div className="space-y-8">
      <SectionHead kicker="Recognition" title="Awards" />

      <CreateAward onDone={() => query.refetch({ quiet: true })} />

      <AsyncView
        query={query}
        label="Loading awards"
        emptyWhen={(d) => !d.awards?.length}
        empty={<EmptyState title="No awards yet" hint="Create your first award above." />}
      >
        {({ awards }) => (
          <div className="space-y-4">
            {awards.map((award) => (
              <AwardCard
                key={award._id}
                award={award}
                players={players}
                onDone={() => query.refetch({ quiet: true })}
              />
            ))}
          </div>
        )}
      </AsyncView>
    </div>
  );
}

function CreateAward({ onDone }) {
  const [form, setForm] = useState({ key: '', title: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminService.upsertAward({ key: form.key.trim().toUpperCase(), title: form.title.trim() });
      setForm({ key: '', title: '' });
      await onDone();
    } catch (err) {
      setError(err?.message || 'Could not create the award.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="border border-rule bg-surface p-4" style={{ borderRadius: 'var(--radius-sm)' }}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green">Add an award</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="aw-key" className="block text-xs font-semibold uppercase tracking-wider text-muted">Key</label>
          <input id="aw-key" required placeholder="BEST_ATTACKER" value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })} className={inputCls} style={inputStyle} />
        </div>
        <div className="space-y-1">
          <label htmlFor="aw-title" className="block text-xs font-semibold uppercase tracking-wider text-muted">Title</label>
          <input id="aw-title" required placeholder="Best Attacker" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} style={inputStyle} />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-scoreRed">{error}</p>}
      <div className="mt-4">
        <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Adding…' : 'Create award'}</Button>
      </div>
    </form>
  );
}

function AwardCard({ award, players, onDone }) {
  const [title, setTitle] = useState(award.title || '');
  const [description, setDescription] = useState(award.description || '');
  const [savingMeta, setSavingMeta] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const winnerId = award.winner?._id || '';

  async function saveMeta() {
    setSavingMeta(true);
    setError(null);
    try {
      await adminService.upsertAward({ key: award.key, title: title.trim(), description: description.trim() });
      await onDone();
    } catch (err) {
      setError(err?.message || 'Could not save the award.');
    } finally {
      setSavingMeta(false);
    }
  }

  async function update(patch) {
    setBusy(true);
    setError(null);
    try {
      await adminService.updateAward(award._id, patch);
      await onDone();
    } catch (err) {
      setError(err?.message || 'Update failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onSetWinner(playerId) {
    const player = players.find((p) => p.id === playerId);
    await update({
      winner: playerId || null,
      winnerTeam: player?.team?.id || null,
    });
  }

  return (
    <div className="border border-rule bg-surface p-4" style={{ borderRadius: 'var(--radius-sm)' }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted">{award.key}</span>
          {award.published ? <Pill tone="green">Published</Pill> : <Pill tone="muted">Draft</Pill>}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => update({ published: !award.published })}
          className="border border-rule px-2.5 py-1 text-xs font-medium text-graphite transition hover:border-ink hover:text-ink disabled:opacity-40"
          style={inputStyle}
        >
          {award.published ? 'Unpublish' : 'Publish'}
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`title-${award._id}`} className="block text-xs font-semibold uppercase tracking-wider text-muted">Title</label>
          <input id={`title-${award._id}`} value={title}
            onChange={(e) => setTitle(e.target.value)} className={inputCls} style={inputStyle} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`desc-${award._id}`} className="block text-xs font-semibold uppercase tracking-wider text-muted">Description</label>
          <input id={`desc-${award._id}`} value={description}
            onChange={(e) => setDescription(e.target.value)} className={inputCls} style={inputStyle} />
        </div>
      </div>
      <div className="mt-3">
        <Button variant="outline" onClick={saveMeta} disabled={savingMeta}>
          {savingMeta ? 'Saving…' : 'Save details'}
        </Button>
      </div>

      <div className="mt-4 rule-t border-rule pt-4">
        <label htmlFor={`winner-${award._id}`} className="block text-xs font-semibold uppercase tracking-wider text-muted">Winner</label>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <select
            id={`winner-${award._id}`}
            value={winnerId}
            disabled={busy || players.length === 0}
            onChange={(e) => onSetWinner(e.target.value)}
            className="min-w-56 border border-rule bg-paper px-2.5 py-2 text-sm text-ink outline-none focus:border-ink disabled:opacity-50"
            style={inputStyle}
          >
            <option value="">{players.length ? '— No winner —' : 'No players available'}</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.team?.code ? ` (${p.team.code})` : ''}
              </option>
            ))}
          </select>
          {award.winner?.name && (
            <span className="text-sm text-graphite">
              Current: <span className="font-medium text-ink">{award.winner.name}</span>
              {award.winnerTeam?.name ? ` · ${award.winnerTeam.name}` : ''}
            </span>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-scoreRed">{error}</p>}
    </div>
  );
}
