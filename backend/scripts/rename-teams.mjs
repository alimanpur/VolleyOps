#!/usr/bin/env node
/**
 * Safe in-place team rename migration for VolleyOps.
 *
 * This script updates ONLY the team names in the existing production database.
 * It does NOT delete, recreate, or modify any other records.
 * Team IDs, players, matches, fixtures, and statistics remain untouched.
 *
 * Usage:
 *   npm run rename-teams
 *
 * Or directly:
 *   node scripts/rename-teams.mjs
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { Team } from '../src/models/index.js';

const RENAMES = [
  { from: '1st year aiml', to: 'ONE HIT WONDERS' },
  { from: '1st year cse', to: 'LOCAL SPRINTERS' },
  { from: '2nd year', to: 'NET DESTROYERS' },
  { from: '3rd year cse 1', to: 'HIGH IMPACT' },
  { from: '3rd year cse 2', to: 'BLOCK PARTY' },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI environment variable is not set.');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
  });
  console.log('Connected.\n');

  // Find the active tournament
  const { Tournament } = await import('../src/models/index.js');
  const tournament = await Tournament.findOne({ isActive: true });
  if (!tournament) {
    console.error('ERROR: No active tournament found in the database.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Active tournament: ${tournament.name} (${tournament._id})\n`);

  // List current teams before rename
  const currentTeams = await Team.find({ tournament: tournament._id }).sort({ code: 1 });
  console.log('Current teams in database:');
  for (const t of currentTeams) {
    console.log(`  [${t.code}] ${t.name} (id: ${t._id})`);
  }
  console.log('');

  // Verify we have exactly the 5 teams we expect to rename
  const currentNames = currentTeams.map((t) => t.name);
  const expectedOldNames = RENAMES.map((r) => r.from);
  const missing = expectedOldNames.filter((name) => !currentNames.includes(name));
  const extra = currentNames.filter((name) => !expectedOldNames.includes(name));

  if (missing.length > 0) {
    console.warn('WARNING: Some expected old names not found in database:');
    for (const name of missing) {
      console.warn(`  - "${name}"`);
    }
    console.warn('These may have already been renamed. Continuing with available teams...\n');
  }

  if (extra.length > 0) {
    console.warn('WARNING: Extra teams found in database that are not in rename list:');
    for (const name of extra) {
      console.warn(`  - "${name}"`);
    }
    console.warn('These teams will NOT be modified.\n');
  }

  // Perform the renames
  console.log('Renaming teams:');
  let updatedCount = 0;
  for (const rename of RENAMES) {
    const team = currentTeams.find((t) => t.name === rename.from);
    if (!team) {
      console.warn(`  SKIP: Team "${rename.from}" not found`);
      continue;
    }

    // Check if already renamed (idempotent)
    if (team.name === rename.to) {
      console.log(`  SKIP: ${rename.from} → ${rename.to} (already renamed)`);
      continue;
    }

    team.name = rename.to;
    await team.save();
    console.log(`  OK: ${rename.from} → ${rename.to} (id: ${team._id})`);
    updatedCount += 1;
  }
  console.log(`\nUpdated ${updatedCount} team(s).\n`);

  // Verify after rename
  const updatedTeams = await Team.find({ tournament: tournament._id }).sort({ code: 1 });
  console.log('Teams after rename:');
  for (const t of updatedTeams) {
    console.log(`  [${t.code}] ${t.name} (id: ${t._id})`);
  }
  console.log('');

  // Verify players and matches are still intact
  const { Player, Match } = await import('../src/models/index.js');
  const playerCount = await Player.countDocuments({ tournament: tournament._id });
  const matchCount = await Match.countDocuments({ tournament: tournament._id });
  console.log(`Verification: ${playerCount} players, ${matchCount} matches still in database.`);

  await mongoose.disconnect();
  console.log('\nDone. Disconnected.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
