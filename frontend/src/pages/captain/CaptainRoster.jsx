import { useApi } from '../../hooks/useApi.js';
import { captainService } from '../../services/captainService.js';
import { AsyncView } from '../../components/ui/states.jsx';
import { SectionHead, Pill } from '../../components/ui/primitives.jsx';

export default function CaptainRoster() {
  const query = useApi(() => captainService.roster(), []);
  return (
    <AsyncView query={query} label="Loading roster">
      {(data) => {
        const active = data.players.filter((p) => p.status === 'ACTIVE');
        const standby = data.players.filter((p) => p.status === 'STANDBY');
        return (
          <div className="space-y-8">
            <SectionHead kicker="Roster" title={data.team.name} />
            {!data.report.complete && (
              <div className="border border-amber bg-surface p-3 text-sm text-amber" style={{ borderRadius: 'var(--radius-sm)' }}>
                {data.report.issues.map((i) => i.message).join(' · ')}
              </div>
            )}
            <RosterGroup title={`Active (${active.length}/6)`} players={active} />
            <RosterGroup title={`Standby (${standby.length}/1)`} players={standby} />
            <p className="text-xs text-muted">Rosters are managed by the tournament admin.</p>
          </div>
        );
      }}
    </AsyncView>
  );
}

function RosterGroup({ title, players }) {
  return (
    <section>
      <h3 className="mb-2 rule-b border-rule pb-1 text-sm font-semibold uppercase tracking-wider text-muted">
        {title}
      </h3>
      {players.length === 0 ? (
        <p className="py-3 text-sm text-muted">No players in this group.</p>
      ) : (
        <ul>
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rule-b border-rule py-2.5 last:border-0">
              <span className="tnum w-8 text-center font-display text-lg text-ink">
                {p.jerseyNumber ?? '–'}
              </span>
              <span className="flex-1 text-ink">{p.name}</span>
              {p.position && p.position !== 'UNSPECIFIED' && (
                <span className="text-xs text-muted">{p.position}</span>
              )}
              {p.isCaptain && <Pill tone="green">Captain</Pill>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
