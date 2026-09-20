# VolleyOps Frontend Build Contract (for contributors)

This is the shared reference for building pages. The foundation (design system,
services, shared components, routing) is DONE. Build pages against these exact
shapes and reuse the primitives. Do not invent new colors or fetch directly.

## Design system (Tailwind v4 tokens — use these utility classes)
Colors: `paper` (#F6F3EC bg), `surface` (#FBF9F4), `ink` (#141414 text),
`graphite`, `muted`, `rule` (#D9D4C7 borders), `green` (#0F6B3C), `deepGreen`,
`greenTint`, `scoreRed` (#C8321F live/scoring), `amber`.
Use e.g. `text-ink`, `bg-surface`, `border-rule`, `text-green`, `bg-scoreRed`.
- Display type: add class `font-display` (Barlow Condensed). Use for headings/scores.
- Body: default (Instrument Sans).
- Scores & stats: add class `tnum` for tabular numerals.
- Radius: inline `style={{ borderRadius: 'var(--radius-sm)' }}` (4px) or `--radius-xs` (2px).
- Hairline rules: classes `rule-t` / `rule-b` add 1px top/bottom borders in rule color.
- Live pulse: class `live-dot`.
- DO NOT use: purple/neon/gradients, glassmorphism, heavy shadows, big rounded cards,
  everything-is-a-card. Prefer 1px rules + whitespace. Cards only for real grouping.
- Editorial/athletic sports-ops feel. LIVE = scoreRed and unmistakable.
- Accessibility: semantic HTML, labels, keyboard focus is already styled globally.

## Shared components (import and reuse — do NOT rebuild)
- `components/ui/primitives.jsx`: `Button` (variants: primary|ink|outline|quiet|danger; props `to` for links, `variant`, `onClick`, `disabled`), `StatusBadge` ({state}), `SectionHead` ({title, kicker, action}), `Pill` ({tone}), `TeamChip` ({colorToken}), `Card`.
- `components/ui/states.jsx`: `Spinner`, `LoadingBlock` ({label}), `EmptyState` ({title, hint, action}), `ErrorState` ({error, onRetry}), `AsyncView` ({query, label, emptyWhen, empty, children:(data)=>jsx}). ALWAYS render loading/empty/error via AsyncView or the individual states.
- `components/match/MatchCard.jsx`: `MatchCard` ({match, to, compact}).
- `components/match/Scoreboard.jsx`: `Scoreboard` ({match}) — big set-by-set board.
- `components/match/Bracket.jsx`: `Bracket` ({matches}).
- `hooks/useApi.js`: `useApi(fn, deps=[], { poll })` → `{ data, error, loading, refetch, setData }`. Use `poll: 12000` for live pages.
- `utils/format.js`: `formatDate`, `formatTime`, `formatDateRange`, `slotName(slot)`, `slotShort(slot)`, `POINT_TYPE_LABELS`, `STAGE_LABELS`.

## Services (call these; never fetch directly)
`services/publicService.js`, `captainService.js`, `scorerService.js`, `adminService.js`, `authService.js`. Methods return the parsed JSON body (see shapes below). Errors throw `ApiError` with `.status`, `.code`, `.message`.

## Data shapes

### serialized Match (everywhere)
```
{ id, code, stage:'ROUND_1'|'SEMIFINAL'|'FINAL', label, order, state,
  court: { id, name } | null,
  scheduledAt, currentSet, serving:'A'|'B'|null,
  teamA: SLOT, teamB: SLOT,
  setScores: [{ setNumber, a, b, winner:'A'|'B'|null, complete }],
  setsWon: { A, B },
  winner:'A'|'B'|null, winnerTeam: { id, name, code } | null,
  hasScorer, startedAt, finishedAt }
```
SLOT = `{ id, name, code, tbd:false }` when resolved, or `{ tbd:true, label:'Winner of Round 1' }` when not. ALWAYS render slots via `slotName(slot)` (never assume `.name`).

### timeline (match center / scorer)
`[{ id, seq, setNumber, winner, pointType, player:{id,name,jersey}|null, assistPlayer, errorType, scoreAfter:{a,b}, at }]`

### publicService
- `tournament()` → `{ tournament: { id,name,subtitle,venue,startDate,endDate,startTimeNote,timezone,rules:{bestOf,pointsPerSet,pointsFinalSet,winBy},status } }`
- `overview()` → `{ live:[Match], next:Match|null, upcoming:[Match], recentResults:[Match], standings:[Row] }`
- `fixtures()` → `{ matches:[Match] }`
- `results()` → `{ matches:[Match] }`
- `standings()` → `{ standings:[Row] }`
- `teams()` → `{ teams:[{ id,code,name,shortName,year,seed,colorToken,captain,playerCount }] }`
- `team(id)` → `{ team, players:[Player], matches:[Match] }`
- `players()` → `{ players:[Player] }`
- `player(id)` → `{ player:Player, stats:StatLine|null }`
- `stats(teamId?)` → `{ stats:[StatLine] }`
- `awards()` → `{ awards:[{ id,key,title,description,winner:{id,name}|null,winnerTeam:{id,name}|null }] }`
- `match(id)` → `{ match:Match, timeline:[...] }`
- `search(q)` → `{ results:[{ type:'team'|'player', id, label, sub }] }`

Row (standings) = `{ teamId, rank, played, wins, losses, points, setsWon, setsLost, pointsFor, pointsAgainst, setRatio, pointRatio, team:{ id,name,code,year,colorToken } }`
Player = `{ id,name,jerseyNumber,year,position,status:'ACTIVE'|'STANDBY',isCaptain, team:{id,name,code} }`
StatLine = `{ playerId, kills, attackErrors, attackAttempts, blocks, aces, serviceErrors, assists, digs, receptions, receptionErrors, pointsScored, efficiency, player:{id,name,jersey,position}, team:{id,name,code} }`

### captainService (session team-scoped; no ids passed)
- `dashboard()` → `{ team, roster:{players:[Player],report:RosterReport}, matches:[Match], next:Match|null, live:Match|null, unreadNotifications }`
- `roster()` → `{ team, players:[Player], report:RosterReport }`
- `fixtures()` → `{ matches:[Match] }`
- `standings()` → `{ standings:[Row] }`
- `stats()` → `{ stats:[StatLine] }`
- `match(id)` → `{ match, timeline }`
- `notifications()` → `{ notifications:[{ id,type,title,body,createdAt,read }] }`
- `markRead(id)`

RosterReport = `{ complete, activeCount, standbyCount, activeRequired:6, standbyRequired:1, hasCaptain, issues:[{code,message,playerIds?}] }`

### scorerService
- `assignments()` → `{ assignments:[Match] }`
- `match(id)` → `{ match:Match, onCourt:{A:[{id,name,jersey,position}],B:[...]}, roster:{A:[{id,name,jersey,position,status}],B:[...]}, timeline }`
- `setLineups(id, { a:[playerId], b:[playerId] })` → `{ match, onCourt }`
- `start(id)` → `{ match }`
- `rally(id, { clientEventId, winner:'A'|'B', pointType, player?, assistPlayer?, errorType?, errorPlayer? })` → `{ match, duplicate, timeline }`
- `undo(id)` → `{ match, timeline }`
- `patchRally(id, { pointType?, player?, ... })` → `{ match, timeline }`
- `substitute(id, { side:'A'|'B', playerOut, playerIn, setNumber? })` → `{ match, onCourt }`

pointType ∈ `ATTACK_KILL, BLOCK, ACE, OPPONENT_ERROR, OTHER`. errorType ∈ `ATTACK_ERROR, SERVICE_ERROR, RECEPTION_ERROR, OTHER_ERROR`.

### adminService — see services/adminService.js for the full method list.
- `dashboard()` → `{ tournament:{id,name,status}, live:[Match], next:Match|null, attention:{ incompleteRosters:[{team,issues}], unassignedUpcoming:[Match], waitingForWinner:[Match], unreadNotifications }, counts:{teams,players,matches,courts} }`
- `teams()` → `{ teams:[team + { report:RosterReport }] }`
- `teamRoster(id)` → `{ team, players:[Player], report }`
- `access()` → `{ users:[{ id,role,displayName,team:{id,name,code}|null,hasCode,redeemed,codeVersion }] }`
- `createAccess({role,displayName,teamId?})` → `{ user, code }`  (code shown ONCE)
- `regenerateAccess(id)` → `{ code }`
- `audit()` → `{ entries:[{ action, actorLabel, targetType, targetLabel, metadata, createdAt }] }`
- `awards()` → `{ awards:[...] }`; `stats()`/`standings()` same shape as public.

## Auth context
`context/AuthContext.jsx`: `useAuth()` → `{ user, setUser, ready, refresh, logout }`.
`user` = `{ id, role, displayName, team:{id,name,code,year}|null, tournament }`.
After login/redeem, call `setUser(resp.user)` then navigate to the role home.

## Routing already wired in App.jsx
Public under PublicLayout. `/admin/*`→AdminApp, `/captain/*`→CaptainApp, `/scorer/*`→ScorerApp (all behind ProtectedRoute). Access pages: `/admin/login`, `/captain/access`, `/scorer/access`. Each role app owns its own sub-routes and layout.
