#!/usr/bin/env node
/**
 * VolleyOps — Export current production database state to JSON backup.
 * This does NOT modify production. It only reads.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('ERROR: MONGODB_URI environment variable is not set.');
  process.exit(1);
}

const backupDir = process.argv[2];
if (!backupDir) {
  console.error('Usage: node scripts/export-db.mjs <backup-directory>');
  process.exit(1);
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('Connected.');

  const db = mongoose.connection.db;
  mkdirSync(backupDir, { recursive: true });

  const collections = [
    'tournaments', 'teams', 'players', 'matches', 'rallyevents',
    'courts', 'users', 'awards', 'notifications', 'auditentries',
    'substitutions', 'lineupentries', 'sessions', 'invitations',
  ];

  for (const name of collections) {
    const docs = await db.collection(name).find({}).toArray();
    const outPath = join(backupDir, `${name}.json`);
    writeFileSync(outPath, JSON.stringify(docs, null, 2));
    console.log(`  Exported ${docs.length} ${name} -> ${outPath}`);
  }

  await mongoose.disconnect();
  console.log('\nBackup complete.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
