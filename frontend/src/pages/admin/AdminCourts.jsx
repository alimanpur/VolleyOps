import { useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { adminService } from '../../services/adminService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { SectionHead, Button } from '../../components/ui/primitives.jsx';

/*
 * Courts are the physical stage for fixtures. A short list plus a two-field
 * create form; deletion confirms first since a court may be referenced by a
 * scheduled match.
 */

const inputCls = 'w-full border border-rule bg-paper px-2.5 py-2 text-sm text-ink outline-none transition focus:border-ink';
const inputStyle = { borderRadius: 'var(--radius-xs)' };

export default function AdminCourts() {
  const query = useApi(() => adminService.courts(), []);
  const [form, setForm] = useState({ name: '', location: '' });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function onCreate(e) {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      await adminService.createCourt(form);
      setForm({ name: '', location: '' });
      await query.refetch({ quiet: true });
    } catch (err) {
      setFormError(err?.message || 'Could not create the court.');
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(court) {
    if (!window.confirm(`Delete ${court.name}?`)) return;
    setBusyId(court._id);
    try {
      await adminService.deleteCourt(court._id);
      await query.refetch({ quiet: true });
    } catch (err) {
      window.alert(err?.message || 'Could not delete the court.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <SectionHead kicker="Venue" title="Courts" />

      <form onSubmit={onCreate} className="border border-rule bg-surface p-4" style={{ borderRadius: 'var(--radius-sm)' }}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green">Add a court</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="c-name" className="block text-xs font-semibold uppercase tracking-wider text-muted">Name</label>
            <input id="c-name" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} style={inputStyle} />
          </div>
          <div className="space-y-1">
            <label htmlFor="c-loc" className="block text-xs font-semibold uppercase tracking-wider text-muted">Location</label>
            <input id="c-loc" value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputCls} style={inputStyle} />
          </div>
        </div>
        {formError && <p className="mt-3 text-sm text-scoreRed">{formError}</p>}
        <div className="mt-4">
          <Button type="submit" variant="primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create court'}
          </Button>
        </div>
      </form>

      <AsyncView
        query={query}
        label="Loading courts"
        emptyWhen={(d) => !d.courts?.length}
        empty={<EmptyState title="No courts yet" hint="Add the courts your matches will be played on." />}
      >
        {({ courts }) => (
          <div className="border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="rule-b border-rule text-left text-xs uppercase tracking-wider text-muted">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Location</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courts.map((court) => (
                  <tr key={court._id} className="rule-b border-rule last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{court.name}</td>
                    <td className="px-4 py-3 text-graphite">{court.location || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={busyId === court._id}
                        onClick={() => onDelete(court)}
                        className="border border-scoreRed px-2 py-1 text-xs font-medium text-scoreRed transition hover:bg-scoreRed hover:text-white disabled:opacity-40"
                        style={inputStyle}
                      >
                        Delete
                      </button>
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
