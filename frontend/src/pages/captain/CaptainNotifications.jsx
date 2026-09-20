import { useApi } from '../../hooks/useApi.js';
import { captainService } from '../../services/captainService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { SectionHead } from '../../components/ui/primitives.jsx';
import { formatDate, formatTime } from '../../utils/format.js';

export default function CaptainNotifications() {
  const query = useApi(() => captainService.notifications(), []);

  const markRead = async (id) => {
    await captainService.markRead(id).catch(() => {});
    query.refetch({ quiet: true });
  };

  return (
    <AsyncView
      query={query}
      label="Loading notifications"
      emptyWhen={(d) => d.notifications.length === 0}
      empty={<EmptyState title="No notifications" hint="Match assignments and notices from the admin appear here." />}
    >
      {(data) => (
        <div>
          <SectionHead kicker="Inbox" title="Notifications" />
          <ul>
            {data.notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => !n.read && markRead(n.id)}
                  className="flex w-full items-start gap-3 rule-b border-rule py-3 text-left last:border-0"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-rule' : 'bg-green'}`}
                    aria-hidden
                  />
                  <span className="flex-1">
                    <span className={`block ${n.read ? 'text-graphite' : 'font-semibold text-ink'}`}>
                      {n.title}
                    </span>
                    {n.body && <span className="mt-0.5 block text-sm text-muted">{n.body}</span>}
                    <span className="mt-1 block text-xs text-muted">
                      {formatDate(n.createdAt)} · {formatTime(n.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AsyncView>
  );
}
