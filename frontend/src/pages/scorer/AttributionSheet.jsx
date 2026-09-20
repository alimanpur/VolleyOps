import { useState } from 'react';
import { slotName } from '../../utils/format.js';

/*
 * Quick attribution sheet, shown after a team's Point button is tapped. Kept to
 * 1–3 taps: choose the point type, then (where it applies) the player. Every
 * screen offers an immediate "Skip / unattributed" path so scoring stays fast.
 */
const POINT_TYPES = [
  { key: 'ATTACK_KILL', label: 'Attack kill', needs: 'own' },
  { key: 'BLOCK', label: 'Block', needs: 'own' },
  { key: 'ACE', label: 'Ace', needs: 'own' },
  { key: 'OPPONENT_ERROR', label: 'Opponent error', needs: 'error' },
  { key: 'OTHER', label: 'Other', needs: 'none' },
];

const ERROR_TYPES = [
  { key: 'ATTACK_ERROR', label: 'Attack error' },
  { key: 'SERVICE_ERROR', label: 'Service error' },
  { key: 'RECEPTION_ERROR', label: 'Reception error' },
  { key: 'OTHER_ERROR', label: 'Other error' },
];

export default function AttributionSheet({ winner, match, onCourt, onConfirm, onCancel }) {
  const [step, setStep] = useState('type');
  const [pointType, setPointType] = useState(null);
  const [errorType, setErrorType] = useState('OTHER_ERROR');

  const ownSide = winner;
  const otherSide = winner === 'A' ? 'B' : 'A';
  const ownPlayers = onCourt[ownSide] || [];
  const otherPlayers = onCourt[otherSide] || [];

  const finish = (attribution) => onConfirm({ winner, pointType, ...attribution });

  const choose = (type) => {
    setPointType(type.key);
    if (type.needs === 'none') {
      onConfirm({ winner, pointType: type.key });
    } else if (type.needs === 'error') {
      setStep('error');
    } else {
      setStep('player');
    }
  };

  const title =
    step === 'type'
      ? `Point · ${slotName(match[winner === 'A' ? 'teamA' : 'teamB'])}`
      : step === 'error'
        ? 'How was the point lost?'
        : 'Who made the play?';

  return (
    <Sheet title={title} onCancel={onCancel}>
      {step === 'type' && (
        <div className="grid grid-cols-2 gap-2">
          {POINT_TYPES.map((t) => (
            <BigButton key={t.key} onClick={() => choose(t)}>
              {t.label}
            </BigButton>
          ))}
        </div>
      )}

      {step === 'error' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {ERROR_TYPES.map((t) => (
              <BigButton
                key={t.key}
                active={errorType === t.key}
                onClick={() => setErrorType(t.key)}
              >
                {t.label}
              </BigButton>
            ))}
          </div>
          <p className="text-xs text-muted">Charge the error to an opponent (optional):</p>
          <PlayerGrid
            players={otherPlayers}
            onPick={(id) => finish({ errorType, errorPlayerId: id })}
          />
          <SkipButton onClick={() => finish({ errorType })}>Skip player</SkipButton>
        </div>
      )}

      {step === 'player' && (
        <div className="space-y-3">
          <PlayerGrid players={ownPlayers} onPick={(id) => finish({ playerId: id })} />
          <SkipButton onClick={() => finish({})}>Unattributed</SkipButton>
        </div>
      )}
    </Sheet>
  );
}

function Sheet({ title, children, onCancel }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={onCancel}>
      <div
        className="w-full max-w-[430px] rounded-t-lg border-t border-rule bg-paper p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-xl text-ink">{title}</h3>
          <button type="button" onClick={onCancel} className="text-sm text-muted" aria-label="Cancel">
            Cancel
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BigButton({ children, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-3 py-4 text-sm font-medium transition ${
        active ? 'border-green bg-greenTint text-ink' : 'border-rule text-graphite hover:border-ink'
      }`}
      style={{ borderRadius: 'var(--radius-sm)', minHeight: 56 }}
    >
      {children}
    </button>
  );
}

function PlayerGrid({ players, onPick }) {
  if (players.length === 0) return <p className="text-sm text-muted">No players on court recorded.</p>;
  return (
    <div className="grid grid-cols-2 gap-2">
      {players.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(p.id)}
          className="flex items-center gap-2 border border-rule px-3 py-3 text-left text-sm text-graphite transition hover:border-ink"
          style={{ borderRadius: 'var(--radius-sm)', minHeight: 52 }}
        >
          <span className="tnum w-6 text-center font-display text-base text-ink">{p.jersey ?? '–'}</span>
          <span className="flex-1 truncate">{p.name}</span>
        </button>
      ))}
    </div>
  );
}

function SkipButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full border border-ink px-3 py-3 text-sm font-medium text-ink"
      style={{ borderRadius: 'var(--radius-sm)', minHeight: 52 }}
    >
      {children}
    </button>
  );
}
