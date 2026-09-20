import { useParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { captainService } from '../../services/captainService.js';
import { AsyncView } from '../../components/ui/states.jsx';
import { Scoreboard } from '../../components/match/Scoreboard.jsx';
import { MatchTimeline } from '../../components/match/MatchTimeline.jsx';
import { SectionHead } from '../../components/ui/primitives.jsx';
import { STAGE_LABELS } from '../../utils/format.js';

export default function CaptainMatch() {
  const { matchId } = useParams();
  const query = useApi(() => captainService.match(matchId), [matchId], { poll: 12000 });
  return (
    <AsyncView query={query} label="Loading match">
      {(data) => (
        <div className="space-y-6">
          <SectionHead
            kicker={data.match.label || STAGE_LABELS[data.match.stage]}
            title={data.match.court?.name || 'Match center'}
          />
          <Scoreboard match={data.match} />
          <MatchTimeline timeline={data.timeline} match={data.match} />
        </div>
      )}
    </AsyncView>
  );
}
