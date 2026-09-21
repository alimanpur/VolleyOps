#!/usr/bin/env node
/**
 * VolleyOps — Fix Semifinal Pairings
 *
 * This script corrects the semifinal match participants to:
 *   SF1 = #1 vs #2
 *   SF2 = #3 vs #4
 *
 * It uses the existing tournament standings to determine rankings.
 * It updates existing semifinal records in place (preserving match IDs).
 * If no semifinals exist, it creates them.
 *
 * This script is SAFE and IDEMPOTENT.
 * It will NOT modify league matches, teams, players, or rosters.
 *
 * Usage:
 *   node scripts/fix-semifinals.mjs
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { Tournament, Match } from '../src/models/index.js';
import { semifinalBlueprint, STAGES } from '../src/domain/bracket.js';
import { statsService } from '../src/services/statsService.js';

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

  // Get all matches and compute standings manually
  const matches = await Match.find({ tournament: tournament._id });
  const leagueMatches = matches.filter((m) => m.stage === STAGES.LEAGUE);

  // Check if all league matches are completed
  const leagueCompleted = leagueMatches.filter((m) =>
    ['FINISHED', 'LOCKED'].includes(m.state)
  ).length;
  console.log(`League matches: ${leagueCompleted}/${leagueMatches.length} completed`);

  if (leagueCompleted !== leagueMatches.length) {
    console.error('ERROR: Not all league matches are completed. Cannot generate semifinals.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Use the actual standings service
  const standingsRows = await statsService.standings(tournament._id);
  const sorted = standingsRows.filter((r) => r.team).map((r) => ({
    teamId: r.teamId,
    name: r.team.name,
    wins: r.wins,
    losses: r.losses,
    points: r.points,
  }));

  console.log('\nFinal Standings:');
  sorted.forEach((s, i) => {
    console.log(`  #${i + 1}: ${s.name} (${s.wins}W-${s.losses}L, ${s.points} pts)`);
  });

  if (sorted.length < 4) {
    console.error('\nERROR: Need at least 4 teams with results to generate semifinals.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const qualifiedTeamIds = sorted.slice(0, 4).map((s) => s.teamId);
  console.log(`\nQualified teams: ${qualifiedTeamIds.join(', ')}`);

  // Find existing semifinals
  const existingSemis = await Match.find({ tournament: tournament._id, stage: STAGES.SEMIFINAL }).sort({ order: 1 });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const sfDefs = semifinalBlueprint(qualifiedTeamIds);

    if (existingSemis.length === 2) {
      // Check if any semifinal has started
      const started = existingSemis.some((m) =>
        ['LIVE', 'FINISHED', 'LOCKED', 'MATCH_DECIDED'].includes(m.state)
      );
      if (started) {
        console.error('\nERROR: One or more semifinals have already started. Cannot reassign.');
        await session.abortTransaction();
        session.endSession();
        await mongoose.disconnect();
        process.exit(1);
      }

      console.log('\nUpdating existing semifinals...');
      for (let i = 0; i < existingSemis.length; i++) {
        const m = existingSemis[i];
        const def = sfDefs[i];
        const teamAId = new mongoose.Types.ObjectId(def.seeds.A);
        const teamBId = new mongoose.Types.ObjectId(def.seeds.B);
        console.log(`  ${m.code}: ${m.teamA} vs ${m.teamB} -> ${teamAId} vs ${teamBId}`);
        m.teamA = teamAId;
        m.teamB = teamBId;
        m.source = {
          A: def.sources?.A ? { matchId: null, label: def.sources.A.label } : null,
          B: def.sources?.B ? { matchId: null, label: def.sources.B.label } : null,
        };
        await m.save({ session });
      }
    } else {
      console.log('\nCreating new semifinals...');
      for (const def of sfDefs) {
        const teamAId = new mongoose.Types.ObjectId(def.seeds.A);
        const teamBId = new mongoose.Types.ObjectId(def.seeds.B);
        const doc = await Match.create(
          [
            {
              tournament: tournament._id,
              code: def.code,
              stage: def.stage,
              label: def.label,
              order: def.order,
              teamA: teamAId,
              teamB: teamBId,
              source: {
                A: def.sources?.A ? { matchId: null, label: def.sources.A.label } : null,
                B: def.sources?.B ? { matchId: null, label: def.sources.B.label } : null,
              },
              state: 'SCHEDULED',
            },
          ],
          { session }
        );
        console.log(`  Created ${def.code}: ${teamAId} vs ${teamBId}`);
      }
    }

    await session.commitTransaction();
    session.endSession();

    console.log('\nSemifinals fixed successfully.');
    console.log('SF1 = #1 vs #2');
    console.log('SF2 = #3 vs #4');
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
