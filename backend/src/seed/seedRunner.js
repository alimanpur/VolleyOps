import bcrypt from 'bcryptjs';
import {
  Tournament, Team, Player, Court, Match, User, Award, Notification, AuditEntry, RallyEvent, Session,
} from '../models/index.js';
import { tournamentService } from '../services/tournamentService.js';
import { authService } from '../services/authService.js';
import { env } from '../config/env.js';
import { TOURNAMENT, TEAMS, COURTS, rosterFor } from './seedData.js';

/**
 * Idempotent-ish seed: wipes the collections it owns and rebuilds. Returns the
 * generated access codes so the caller can print them (codes are shown once).
 */
export async function runSeed({ log = () => {} } = {}) {
  const models = [
    Tournament, Team, Player, Court, Match, User,
    Award, Notification, AuditEntry, RallyEvent, Session,
  ];
  await Promise.all(models.map((m) => m.deleteMany({})));
  log('Cleared existing data');

  // Reconcile indexes with the current schemas before inserting. syncIndexes
  // drops any index no longer defined (e.g. a stale `teamId_1_jerseyNumber_1`
  // from an earlier schema) and builds the correct ones, so a reseed after a
  // schema change can't collide on a leftover unique index.
  await Promise.all(models.map((m) => m.syncIndexes()));
  log('Synced indexes');

  const tournament = await Tournament.create(TOURNAMENT);
  log(`Created tournament: ${tournament.name}`);

  // Teams + rosters
  const teamByCode = {};
  for (const def of TEAMS) {
    const team = await Team.create({ ...def, tournament: tournament._id });
    teamByCode[def.code] = team;
    const roster = rosterFor(def);
    let captainId = null;
    for (const p of roster) {
      const player = await Player.create({ ...p, tournament: tournament._id, team: team._id });
      if (p.isCaptain) captainId = player._id;
    }
    if (captainId) {
      team.captain = captainId;
      await team.save();
    }
  }
  log(`Created ${TEAMS.length} teams with full rosters`);

  // Courts
  const courts = [];
  for (const c of COURTS) courts.push(await Court.create({ ...c, tournament: tournament._id }));

  // Bracket
  const matches = await tournamentService.buildBracket(tournament._id);
  // Assign courts to the first playable matches.
  if (matches[0]) { matches[0].court = courts[0]._id; matches[0].scheduledAt = new Date('2026-09-21T15:00:00+05:30'); await matches[0].save(); }
  if (matches[1]) { matches[1].court = courts[0]._id; await matches[1].save(); }
  if (matches[2]) { matches[2].court = courts[1]._id; matches[2].scheduledAt = new Date('2026-09-21T15:00:00+05:30'); await matches[2].save(); }
  log(`Built bracket: ${matches.length} matches`);

  // Admin
  const admin = await User.create({
    tournament: tournament._id,
    role: 'ADMIN',
    displayName: 'Tournament Admin',
    username: env.admin.username.toLowerCase(),
    passwordHash: await bcrypt.hash(env.admin.password, 10),
  });

  // Captains (one per team) + codes
  const codes = { admin: { username: env.admin.username, password: env.admin.password }, captains: [], scorers: [] };
  for (const def of TEAMS) {
    const team = teamByCode[def.code];
    const user = await User.create({
      tournament: tournament._id,
      role: 'CAPTAIN',
      displayName: `${def.name} Captain`,
      team: team._id,
    });
    const code = await authService.issueCode(user._id);
    codes.captains.push({ team: def.name, code });
  }

  // Scorers + codes; assign scorer 1 to the two first-playable matches.
  const scorer1 = await User.create({ tournament: tournament._id, role: 'SCORER', displayName: 'Scorer One' });
  const scorer2 = await User.create({ tournament: tournament._id, role: 'SCORER', displayName: 'Scorer Two' });
  codes.scorers.push({ name: 'Scorer One', code: await authService.issueCode(scorer1._id) });
  codes.scorers.push({ name: 'Scorer Two', code: await authService.issueCode(scorer2._id) });

  const freshMatches = await Match.find({ tournament: tournament._id }).sort({ order: 1 });
  // M01 (round 1) and M03 (SF2, both teams seeded) are immediately playable.
  const playable = freshMatches.filter((m) => m.teamA && m.teamB);
  if (playable[0]) { playable[0].scorer = scorer1._id; await playable[0].save(); }
  if (playable[1]) { playable[1].scorer = scorer2._id; await playable[1].save(); }

  // Award templates (unpublished)
  for (const [key, title] of [
    ['BEST_ATTACKER', 'Best Attacker'],
    ['BEST_DEFENDER', 'Best Defender'],
    ['BEST_SETTER', 'Best Setter'],
    ['BEST_PLAYER', 'Best Player of the Tournament'],
  ]) {
    await Award.create({ tournament: tournament._id, key, title, published: false });
  }

  // A couple of notifications
  await Notification.create({
    tournament: tournament._id, type: 'GENERAL', audience: 'ALL',
    title: 'Tournament schedule published', body: 'Matches begin after 3:00 PM on 21 September.',
  });

  log('Seed complete');
  return { tournament, admin, codes };
}
