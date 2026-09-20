import { useApi } from '../../hooks/useApi.js';
import { adminService } from '../../services/adminService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { SectionHead } from '../../components/ui/primitives.jsx';
import { formatDate, formatTime } from '../../utils/format.js';

/*
 * The audit trail — reverse-chronological record of every admin action, so it's
 * always clear who changed what and when. Times are tabular; metadata is shown
 * compactly so a row stays scannable.
 */
export default function AdminAudit() {
  const query = useApi(() => adminService.audit(), []);

  return (
    <div className="space-y-8">
      <SectionHead kicker="Trail" title="Audit" />
      <AsyncView
        query={query}
        label="Loading audit log"
        emptyWhen={(d) => !d.entries?.length}
        empty={<EmptyState title="No activity yet" hint="Admin actions are recorded here as they happen." />}
      >
        {({ entries }) => (
          <div className="scroll-x border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="rule-b border-rule text-left text-xs uppercase tracking-wider text-muted">
                  <th scope="col" className="px-4 py-2.5 font-semibold">When</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Actor</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Action</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Target</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e._id} className="rule-b border-rule align-top last:border-0">
                    <td className="tnum whitespace-nowrap px-4 py-3 text-muted">
                      {formatDate(e.createdAt)} · {formatTime(e.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-graphite">{e.actorLabel || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-medium text-ink">{e.action}</span>
                    </td>
                    <td className="px-4 py-3 text-graphite">
                      {e.targetType ? (
                        <>
                          <span className="text-xs uppercase tracking-wide text-muted">{e.targetType}</span>
                          {e.targetLabel && <span className="ml-1.5">{e.targetLabel}</span>}
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{formatMeta(e.metadata)}</td>
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

function formatMeta(meta) {
  if (!meta || typeof meta !== 'object') return meta || '—';
  const entries = Object.entries(meta);
  if (entries.length === 0) return '—';
  return entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ');
}
