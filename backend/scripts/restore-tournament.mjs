#!/usr/bin/env node
/**
 * VolleyOps — Restore exact tournament data
 *
 * This script restores:
 * 1. Team display names (correct casing)
 * 2. Exact player rosters
 * 3. Five league matches with exact set scores
 * 4. Match results and completion state
 *
 * It does NOT touch semifinals or finals.
 * It does NOT run the seed.
 * It preserves existing team IDs.
 *
 * WARNING: This modifies production data.
 * A backup was created at: backup/pre-recovery-2026-09-21T19-20-09/
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { Tournament, Team, Player, Match } from '../src/models/index.js';
import { STAGES } from '../src/domain/bracket.js';

const OFFICIAL_TEAMS = [
  { code: '1ST_AIML', name: 'ONE HIT WONDERS', shortName: 'ONE HIT WONDERS', year: 1 },
  { code: '1ST_CSE', name: 'LOCAL SPRINTERS', shortName: 'LOCAL SPRINTERS', year: 1 },
  { code: '2ND_YEAR', name: 'NET DESTROYERS', shortName: 'NET DESTROYERS', year: 2 },
  { code: '3RD_CSE_1', name: 'HIGH IMPACT', shortName: 'HIGH IMPACT', year: 3 },
  { code: '3RD_CSE_2', name: 'BLOCK PARTY', shortName: 'BLOCK PARTY', year: 3 },
];

const OFFICIAL_ROSTERS = {
  '1ST_AIML': {
    name: 'ONE HIT WONDERS',
    players: [
      { jersey: 1, name: 'Shashank Sharma', position: 'SETTER', isCaptain: true },
      { jersey: 2, name: 'Devyansh Tiwari', position: 'OUTSIDE', isCaptain: false },
      { jersey: 3, name: 'Abhishek Soni', position: 'MIDDLE', isCaptain: false },
      { jersey: 4, name: 'Kashyap', position: 'OPPOSITE', isCaptain: false },
      { jersey: 5, name: 'Vivek Tanwar', position: 'OUTSIDE', isCaptain: false },
      { jersey: 6, name: 'Keshav Patidar', position: 'MIDDLE', isCaptain: false },
    ],
  },
  '1ST_CSE': {
    name: 'LOCAL SPRINTERS',
    players: [
      { jersey: 1, name: 'Mohmmad Asgar', position: 'SETTER', isCaptain: true },
      { jersey: 2, name: 'Mayur', position: 'OUTSIDE', isCaptain: false },
      { jersey: 3, name: 'Himanshu', position: 'MIDDLE', isCaptain: false },
      { jersey: 4, name: 'Snehil Raj', position: 'OPPOSITE', isCaptain: false },
      { jersey: 5, name: 'Aaryan Purty', position: 'OUTSIDE', isCaptain: false },
      { jersey: 6, name: 'Ansh', position: 'MIDDLE', isCaptain: false },
    ],
  },
  '2ND_YEAR': {
    name: 'NET DESTROYERS',
    players: [
      { jersey: 1, name: 'Saurabh', position: 'SETTER', isCaptain: true },
      { jersey: 2, name: 'Neeraj', position: 'OUTSIDE', isCaptain: false },
      { jersey: 3, name: 'Abhishek', position: 'MIDDLE', isCaptain: false },
      { jersey: 4, name: 'Ujjawal', position: 'OPPOSITE', isCaptain: false },
      { jersey: 5, name: 'Depansh', position: 'OUTSIDE', isCaptain: false },
      { jersey: 6, name: 'Mohit', position: 'MIDDLE', isCaptain: false },
    ],
  },
  '3RD_CSE_2': {
    name: 'BLOCK PARTY',
    players: [
      { jersey: 1, name: 'Arvind', position: 'SETTER', isCaptain: true },
      { jersey: 2, name: 'Hardik', position: 'OUTSIDE', isCaptain: false },
      { jersey: 3, name: 'Ansh', position: 'MIDDLE', isCaptain: false },
      { jersey: 4, name: 'Madhur', position: 'OPPOSITE', isCaptain: false },
      { jersey: 5, name: 'Kritik', position: 'OUTSIDE', isCaptain: false },
      { jersey: 6, name: 'Nitesh', position: 'MIDDLE', isCaptain: false },
      { jersey: 7, name: 'Abhishek Tanwar', position: 'LIBERO', status: 'STANDBY', isCaptain: false },
    ],
  },
  '3RD_CSE_1': {
    name: 'HIGH IMPACT',
    players: [
      { jersey: 1, name: 'Aliasger', position: 'SETTER', isCaptain: true },
      { jersey: 2, name: 'Aryan', position: 'OUTSIDE', isCaptain: false },
      { jersey: 3, name: 'Arpan', position: 'MIDDLE', isCaptain: false },
      { jersey: 4, name: 'Sai', position: 'OPPOSITE', isCaptain: false },
      { jersey: 5, name: 'Kanishk', position: 'OUTSIDE', isCaptain: false },
      { jersey: 6, name: 'Mahendra', position: 'MIDDLE', isCaptain: false },
      { jersey: 7, name: 'Manan', position: 'LIBERO', status: 'STANDBY', isCaptain: false },
    ],
  },
};

const OFFICIAL_MATCHES = [
  {
    code: 'M01',
    stage: STAGES.LEAGUE,
    order: 1,
    label: 'Block Party vs Local Sprinters',
    teamA_code: '3RD_CSE_2',
    teamB_code: '1ST_CSE',
    scheduledAt: new Date('2026-09-21T15:00:00+05:30'),
    state: 'FINISHED',
    winner: 'A',
    setScores: [
      { setNumber: 1, a: 15, b: 8, winner: 'A', complete: true },
      { setNumber: 2, a: 15, b: 13, winner: 'A', complete: true },
    ],
  },
  {
    code: 'M02',
    stage: STAGES.LEAGUE,
    order: 2,
    label: 'Net Destroyers vs Local Sprinters',
    teamA_code: '2ND_YEAR',
    teamB_code: '1ST_CSE',
    scheduledAt: new Date('2026-09-21T15:00:00+05:30'),
    state: 'FINISHED',
    winner: 'A',
    setScores: [
      { setNumber: 1, a: 15, b: 8, winner: 'A', complete: true },
      { setNumber: 2, a: 15, b: 5, winner: 'A', complete: true },
    ],
  },
  {
    code: 'M03',
    stage: STAGES.LEAGUE,
    order: 3,
    label: 'One Hit Wonders vs High Impact',
    teamA_code: '1ST_AIML',
    teamB_code: '3RD_CSE_1',
    scheduledAt: new Date('2026-09-21T15:00:00+05:30'),
    state: 'FINISHED',
    winner: 'B',
    setScores: [
      { setNumber: 1, a: 8, b: 15, winner: 'B', complete: true },
      { setNumber: 2, a: 11, b: 15, winner: 'B', complete: true },
    ],
  },
  {
    code: 'M04',
    stage: STAGES.LEAGUE,
    order: 4,
    label: 'Block Party vs One Hit Wonders',
    teamA_code: '3RD_CSE_2',
    teamB_code: '1ST_AIML',
    scheduledAt: new Date('2026-09-22T15:00:00+05:30'),
    state: 'FINISHED',
    winner: 'A',
    setScores: [
      { setNumber: 1, a: 8, b: 15, winner: 'B', complete: true },
      { setNumber: 2, a: 15, b: 8, winner: 'A', complete: true },
      { setNumber: 3, a: 15, b: 11, winner: 'A', complete: true },
    ],
  },
  {
    code: 'M05',
    stage: STAGES.LEAGUE,
    order: 5,
    label: 'High Impact vs Net Destroyers',
    teamA_code: '3RD_CSE_1',
    teamB_code: '2ND_YEAR',
    scheduledAt: new Date('2026-09-22T15:00:00+05:30'),
    state: 'FINISHED',
    winner: 'B',
    setScores: [
      { setNumber: 1, a: 10, b: 15, winner: 'B', complete: true },
      // Set 2 requires organizer confirmation — left blank intentionally
      { setNumber: 3, a: 9, b: 15, winner: 'B', complete: true },
    ],
  },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI environment variable is not set.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('Connected.\n');

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const tournament = await Tournament.findOne({ isActive: true }).session(session);
    if (!tournament) {
      throw new Error('No active tournament found.');
    }
    console.log(`Tournament: ${tournament.name} (${tournament._id})\n`);

    // 1. Update team names
    const teams = await Team.find({ tournament: tournament._id }).sort({ code: 1 }).session(session);
    const teamByCode = {};
    for (const team of teams) {
      const official = OFFICIAL_TEAMS.find((t) => t.code === team.code);
      if (!official) {
        console.warn(`  WARNING: No official mapping for team code ${team.code}`);
        continue;
      }
      teamByCode[team.code] = team;
      const nameChanged = team.name !== official.name || team.shortName !== official.shortName;
      if (nameChanged) {
        console.log(`  Team ${team.code}: "${team.name}" -> "${official.name}"`);
        team.name = official.name;
        team.shortName = official.shortName;
        await team.save({ session });
      } else {
        console.log(`  Team ${team.code}: already correct (${team.name})`);
      }
    }

    // 2. Restore players
    for (const [code, roster] of Object.entries(OFFICIAL_ROSTERS)) {
      const team = teamByCode[code];
      if (!team) {
        console.warn(`  WARNING: Team ${code} not found, skipping roster.`);
        continue;
      }

      const existingPlayers = await Player.find({ team: team._id }).session(session);
      const existingById = new Map(existingPlayers.map((p) => [String(p._id), p]));

      // Delete players that shouldn't exist
      const officialIds = new Set(roster.players.map((p) => `official-${code}-${p.jersey}`));
      for (const p of existingPlayers) {
        const key = `official-${code}-${p.jerseyNumber}`;
        if (!officialIds.has(key)) {
          await Player.deleteOne({ _id: p._id }).session(session);
          console.log(`    Deleted extra player: ${p.name} (${p._id})`);
        }
      }

      // Create/update official players
      let captainId = null;
      for (const def of roster.players) {
        const key = `official-${code}-${def.jersey}`;
        const existing = existingPlayers.find((p) => `official-${code}-${p.jerseyNumber}` === key);

        if (existing) {
          const nameChanged = existing.name !== def.name || existing.position !== def.position || existing.isCaptain !== def.isCaptain || existing.status !== (def.status || 'ACTIVE');
          if (nameChanged) {
            console.log(`    Update player #${def.jersey}: "${existing.name}" -> "${def.name}"`);
            existing.name = def.name;
            existing.position = def.position;
            existing.isCaptain = def.isCaptain;
            existing.status = def.status || 'ACTIVE';
            await existing.save({ session });
          }
          if (def.isCaptain) captainId = existing._id;
        } else {
          console.log(`    Create player #${def.jersey}: "${def.name}"`);
          const player = await Player.create(
            [
              {
                tournament: tournament._id,
                team: team._id,
                name: def.name,
                jerseyNumber: def.jersey,
                year: team.year,
                position: def.position,
                status: def.status || 'ACTIVE',
                isCaptain: def.isCaptain,
              },
            ],
            { session }
          );
          if (def.isCaptain) captainId = player[0]._id;
        }
      }

      if (captainId && String(team.captain) !== String(captainId)) {
        team.captain = captainId;
        await team.save({ session });
        console.log(`    Updated captain for ${roster.name}`);
      }
    }

    // 3. Restore league matches
    // First, identify matches by code
    const existingMatches = await Match.find({ tournament: tournament._id, stage: STAGES.LEAGUE }).sort({ order: 1 }).session(session);
    const matchByCode = new Map(existingMatches.map((m) => [m.code, m]));

    // Build lookup of teams by code
    const teamIdsByCode = {};
    for (const [code, team] of Object.entries(teamByCode)) {
      teamIdsByCode[code] = String(team._id);
    }

    for (const def of OFFICIAL_MATCHES) {
      const match = matchByCode.get(def.code);
      const teamAId = teamIdsByCode[def.teamA_code];
      const teamBId = teamIdsByCode[def.teamB_code];

      if (!teamAId || !teamBId) {
        throw new Error(`Missing team for match ${def.code}: A=${def.teamA_code} B=${def.teamB_code}`);
      }

      if (match) {
        // Update existing match
        match.teamA = teamAId;
        match.teamB = teamBId;
        match.label = def.label;
        match.state = def.state;
        match.winner = def.winner;
        match.scheduledAt = def.scheduledAt;
        match.setScores = def.setScores;
        await match.save({ session });
        console.log(`  Match ${def.code}: UPDATED (${def.label})`);
      } else {
        // Create new match
        await Match.create(
          [
            {
              tournament: tournament._id,
              code: def.code,
              stage: def.stage,
              label: def.label,
              order: def.order,
              teamA: teamAId,
              teamB: teamBId,
              scheduledAt: def.scheduledAt,
              state: def.state,
              winner: def.winner,
              setScores: def.setScores,
              court: null,
              scorer: null,
              source: { A: null, B: null },
            },
          ],
          { session }
        );
        console.log(`  Match ${def.code}: CREATED (${def.label})`);
      }
    }

    await session.commitTransaction();
    session.endSession();

    console.log('\n=== RESTORATION COMPLETE ===');
    console.log('Teams, players, and league matches restored.');
    console.log('\nNOTE: Match 5 (High Impact vs Net Destroyers) Set 2 score was AMBIGUOUS.');
    console.log('It has been left BLANK. Please confirm with the organizer before entering.');
    console.log('\nNext steps:');
    console.log('1. Verify the restored data in the Admin UI');
    console.log('2. Confirm Match 5 Set 2 score with the organizer');
    console.log('3. Enter the confirmed score');
    console.log('4. Then and only then: fix semifinals');
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('\nFATAL ERROR:', err);
    process.exit(1);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
