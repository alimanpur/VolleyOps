import { useApi } from '../../hooks/useApi.js';
import { publicService } from '../../services/publicService.js';
import { AsyncView } from '../../components/ui/states.jsx';
import { SectionHead } from '../../components/ui/primitives.jsx';
import { formatDateRange } from '../../utils/format.js';

/*
 * The editorial "about" page. Tournament identity up top, then the practical
 * details and the playing format laid out as definition lists separated by
 * hairline rules — no cards, just type and whitespace.
 */
export default function InfoPage() {
  const query = useApi(() => publicService.tournament(), []);

  return (
    <div className="space-y-10">
      <AsyncView query={query} label="Loading tournament">
        {({ tournament: t }) => {
          const r = t.rules || {};
          return (
            <div className="space-y-10">
              <header className="rule-b border-rule pb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green">
                  {t.subtitle || 'Tournament'}
                </p>
                <h1 className="mt-1 font-display text-5xl leading-none text-ink sm:text-7xl">{t.name}</h1>
                {t.venue && <p className="mt-3 text-sm text-muted">{t.venue}</p>}
              </header>

              <section className="max-w-2xl">
                <p className="text-base leading-relaxed text-graphite">
                  This is the home of {t.name}. Follow every match as it happens, track the
                  standings as they shift, and dig into team rosters and player numbers — all
                  drawn straight from the scorer&apos;s table. Nothing here is invented; if a figure
                  hasn&apos;t been recorded yet, we say so.
                </p>
              </section>

              <section>
                <SectionHead kicker="Details" title="The essentials" />
                <dl className="divide-y divide-rule border-y border-rule">
                  <Row term="Dates" desc={formatDateRange(t.startDate, t.endDate)} />
                  {t.venue && <Row term="Venue" desc={t.venue} />}
                  {t.startTimeNote && <Row term="Start time" desc={t.startTimeNote} />}
                  {t.timezone && <Row term="Timezone" desc={t.timezone} />}
                </dl>
              </section>

              <section>
                <SectionHead kicker="Format" title="How it's played" />
                <dl className="divide-y divide-rule border-y border-rule">
                  {r.bestOf != null && <Row term="Match" desc={`Best of ${r.bestOf} sets`} />}
                  {r.pointsPerSet != null && <Row term="Sets to" desc={`${r.pointsPerSet} points`} />}
                  {r.pointsFinalSet != null && <Row term="Deciding set" desc={`${r.pointsFinalSet} points`} />}
                  {r.winBy != null && <Row term="Win by" desc={`${r.winBy} clear`} />}
                </dl>
              </section>
            </div>
          );
        }}
      </AsyncView>
    </div>
  );
}

function Row({ term, desc }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3">
      <dt className="text-sm uppercase tracking-wider text-muted">{term}</dt>
      <dd className="tnum text-right text-ink">{desc}</dd>
    </div>
  );
}
