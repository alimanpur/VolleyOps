/**
 * Pure standings computation from finished matches.
 *
 * Tournament rules: win = 2 points, loss = 0. Tiebreakers, in order:
 *   1. tournament points
 *   2. wins
 *   3. set ratio (sets won / sets lost)
 *   4. point ratio (points for / points against)
 *   5. head-to-head result
 *
 * Input matches are plain objects that are FINISHED and carry:
 *   { teamA, teamB, winner: 'A'|'B', setScores: [{ a, b }] }
 * Only matches with a decided winner contribute. Nothing is fabricated: teams
 * with no finished matches show zeroed rows.
 */

const WIN_POINTS = 2;

function emptyRow(teamId) {
  return {
    teamId: String(teamId),
    played: 0,
    wins: 0,
    losses: 0,
    points: 0,
    setsWon: 0,
    setsLost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  };
}

function ratio(numerator, denominator) {
  if (denominator === 0) return numerator > 0 ? Infinity : 0;
  return numerator / denominator;
}

/**
 * @param {string[]} teamIds  every team in the tournament (so zero rows appear)
 * @param {object[]} matches  finished matches with winner + setScores
 */
export function computeStandings(teamIds, matches) {
  const rows = new Map();
  for (const id of teamIds) rows.set(String(id), emptyRow(id));

  // head-to-head[a][b] = winner teamId of the a-vs-b meeting(s), last wins.
  const h2h = new Map();

  for (const match of matches) {
    if (!match.winner || !match.teamA || !match.teamB) continue;
    const aId = String(match.teamA);
    const bId = String(match.teamB);
    if (!rows.has(aId)) rows.set(aId, emptyRow(aId));
    if (!rows.has(bId)) rows.set(bId, emptyRow(bId));
    const A = rows.get(aId);
    const B = rows.get(bId);

    A.played += 1;
    B.played += 1;

    let aSets = 0;
    let bSets = 0;
    for (const s of match.setScores || []) {
      A.pointsFor += s.a;
      A.pointsAgainst += s.b;
      B.pointsFor += s.b;
      B.pointsAgainst += s.a;
      if (s.a > s.b) aSets += 1;
      else if (s.b > s.a) bSets += 1;
    }
    A.setsWon += aSets;
    A.setsLost += bSets;
    B.setsWon += bSets;
    B.setsLost += aSets;

    const winnerId = match.winner === 'A' ? aId : bId;
    const loserId = match.winner === 'A' ? bId : aId;
    rows.get(winnerId).wins += 1;
    rows.get(winnerId).points += WIN_POINTS;
    rows.get(loserId).losses += 1;

    if (!h2h.has(winnerId)) h2h.set(winnerId, new Set());
    h2h.get(winnerId).add(loserId);
  }

  const ordered = [...rows.values()].sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.wins !== x.wins) return y.wins - x.wins;
    const xSet = ratio(x.setsWon, x.setsLost);
    const ySet = ratio(y.setsWon, y.setsLost);
    if (ySet !== xSet) return ySet - xSet;
    const xPt = ratio(x.pointsFor, x.pointsAgainst);
    const yPt = ratio(y.pointsFor, y.pointsAgainst);
    if (yPt !== xPt) return yPt - xPt;
    // head-to-head: if x beat y, x ranks higher
    if (h2h.get(x.teamId)?.has(y.teamId)) return -1;
    if (h2h.get(y.teamId)?.has(x.teamId)) return 1;
    return 0;
  });

  return ordered.map((row, i) => ({
    ...row,
    rank: i + 1,
    setRatio: Number(ratio(row.setsWon, row.setsLost).toFixed(3)),
    pointRatio: Number(ratio(row.pointsFor, row.pointsAgainst).toFixed(3)),
  }));
}
