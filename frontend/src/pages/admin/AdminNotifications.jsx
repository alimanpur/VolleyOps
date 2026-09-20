import { useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { adminService } from '../../services/adminService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { SectionHead, Button, Pill } from '../../components/ui/primitives.jsx';
import { formatDate, formatTime } from '../../utils/format.js';

/*
 * Broadcast log. A compose form up top targets an audience, then the log lists
 * everything sent, newest first, with its type and audience. Read state is per
 * viewer; here it just marks which ones the admin has already seen.
 */

const TYPES = ['GENERAL', 'FIXTURE', 'MATCH', 'ROSTER', 'AWARD', 'ADMIN'];
const AUDIENCES = ['ALL', 'ADMIN', 'CAPTAIN', 'SCORER'];
const inputCls = 'w-full border border-rule bg-paper px-2.5 py-2 text-sm text-ink outline-none transition focus:border-ink';
const inputStyle = { borderRadius: 'var(--radius-xs)' };

export default function AdminNotifications() {
  const query = useApi(() => adminService.notifications(), []);
  const [form, setForm] = useState({ type: 'GENERAL', audience: 'ALL', title: '', body: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminService.createNotification({
        type: form.type,
        audience: form.audience,
        title: form.title.trim(),
        body: form.body.trim(),
      });
      setForm({ type: 'GENERAL', audience: 'ALL', title: '', body: '' });
      await query.refetch({ quiet: true });
    } catch (err) {
      setError(err?.message || 'Could not send the notification.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <SectionHead kicker="Broadcast" title="Notifications" />

      <form onSubmit={onSubmit} className="border border-rule bg-surface p-4" style={{ borderRadius: 'var(--radius-sm)' }}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green">Compose</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="n-type" className="block text-xs font-semibold uppercase tracking-wider text-muted">Type</label>
            <select id="n-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls} style={inputStyle}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="n-aud" className="block text-xs font-semibold uppercase tracking-wider text-muted">Audience</label>
            <select id="n-aud" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} className={inputCls} style={inputStyle}>
              {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <label htmlFor="n-title" className="block text-xs font-semibold uppercase tracking-wider text-muted">Title</label>
          <input id="n-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} style={inputStyle} />
        </div>
        <div className="mt-3 space-y-1">
          <label htmlFor="n-body" className="block text-xs font-semibold uppercase tracking-wider text-muted">Message</label>
          <textarea id="n-body" rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className={inputCls} style={inputStyle} />
        </div>
        {error && <p className="mt-3 text-sm text-scoreRed">{error}</p>}
        <div className="mt-4">
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Sending…' : 'Send notification'}</Button>
        </div>
      </form>

      <AsyncView
        query={query}
        label="Loading notifications"
        emptyWhen={(d) => !d.notifications?.length}
        empty={<EmptyState title="Nothing sent yet" hint="Broadcasts you send appear here." />}
      >
        {({ notifications }) => (
          <div className="divide-y divide-rule border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
            {notifications.map((n) => (
              <div key={n.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="ink">{n.type}</Pill>
                  <Pill tone="muted">{n.audience}</Pill>
                  <span className="font-medium text-ink">{n.title}</span>
                  {!n.read && <span className="text-[11px] font-semibold uppercase tracking-wide text-green">Unread</span>}
                  <span className="tnum ml-auto text-xs text-muted">
                    {formatDate(n.createdAt)} · {formatTime(n.createdAt)}
                  </span>
                </div>
                {n.body && <p className="mt-1 text-sm text-graphite">{n.body}</p>}
              </div>
            ))}
          </div>
        )}
      </AsyncView>
    </div>
  );
}
