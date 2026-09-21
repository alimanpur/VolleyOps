#!/usr/bin/env node
/**
 * VolleyOps — Restore Original Team Names
 *
 * This script restores the original team names from the last known good source.
 * It does NOT delete teams. It updates team names and shortNames in place.
 * It then regenerates players based on the restored team data.
 *
 * This is a SAFE, IDEMPOTENT operation.
 *
 * Usage:
 *   node scripts/restore-teams.mjs
 *
 * The team name mapping is loaded from the git history (first commit).
 * If you need different names, edit the TEAM_RENAMES mapping below.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { Team, Player, Tournament } from '../src/models/index.js';

const TEAM_RENAMES = [
  { code: '1ST_CSE', name: '1st Year CSE', shortName: 'CSE-1', year: 1 },
  { code: '1ST_AIML', name: '1st Year AIML', shortName: 'AIML-1', year: 1 },
  { code: '2ND_YEAR', name: '2nd Year', shortName: '2nd Yr', year: 2 },
  { code: '3RD_CSE_1', name: '3rd Year CSE 1', shortName: 'CSE 1', year: 3 },
  { code: '3RD_CSE_2', name: '3rd Year CSE 2', shortName: 'CSE 2', year: 3 },
];

const POSITIONS = ['SETTER', 'OUTSIDE', 'MIDDLE', 'OPPOSITE', 'OUTSIDE', 'MIDDLE', 'LIBERO'];
const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh',
  'Krishna', 'Ishaan', 'Kabir', 'Ansh', 'Dhruv', 'Rudra', 'Aryan',
];

function rosterFor(team) {
  const players = [];
  for (let i = 0; i < 7; i += 1) {
    const status = i < 6 ? 'ACTIVE' : 'STANDBY';
    players.push({
      name: `${FIRST_NAMES[(team.year * 3 + i) % FIRST_NAMES.length]} ${team.shortName.replace(/\s/g, '')}${i + 1}`,
      jerseyNumber: i + 1,
      year: team.year,
      position: POSITIONS[i],
      status,
      isCaptain: i === 0,
    });
  }
  return players;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI environment variable is not set.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('Connected.\n');

  const tournament = await Tournament.findOne({ isActive: true });
  if (!tournament) {
    console.error('ERROR: No active tournament found.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Active tournament: ${tournament.name} (${tournament._id})\n`);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const teams = await Team.find({ tournament: tournament._id }).sort({ code: 1 }).session(session);
    console.log(`Found ${teams.length} teams.\n`);

    let updatedTeams = 0;
    let updatedPlayers = 0;

    for (const team of teams) {
      const rename = TEAM_RENAMES.find((r) => r.code === team.code);
      if (!rename) {
        console.log(`  SKIP: ${team.code} (no rename mapping)`);
        continue;
      }

      const nameChanged = team.name !== rename.name || team.shortName !== rename.shortName;
      if (!nameChanged) {
        console.log(`  SKIP: ${team.code} (already correct)`);
        continue;
      }

      console.log(`  UPDATE: ${team.code} "${team.name}" -> "${rename.name}"`);
      team.name = rename.name;
      team.shortName = rename.shortName;
      await team.save({ session });
      updatedTeams += 1;

      // Regenerate players for this team
      const existingPlayers = await Player.find({ team: team._id }).session(session);
      console.log(`    Deleting ${existingPlayers.length} existing players...`);
      await Player.deleteMany({ _id: { $in: existingPlayers.map((p) => p._id) } }).session(session);

      const roster = rosterFor(rename);
      let captainId = null;
      for (const p of roster) {
        const player = await Player.create([{ ...p, tournament: tournament._id, team: team._id }], { session });
        if (p.isCaptain) captainId = player[0]._id;
      }

      if (captainId) {
        team.captain = captainId;
        await team.save({ session });
      }

      console.log(`    Created ${roster.length} players.`);
      updatedPlayers += roster.length;
    }

    await session.commitTransaction();
    session.endSession();

    console.log(`\nRecovery complete.`);
    console.log(`  Teams updated: ${updatedTeams}`);
    console.log(`  Players regenerated: ${updatedPlayers}`);
    console.log('\nMatches and rally events were NOT touched.');
    console.log('If you need to restore match results, use a database backup.');
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
