#!/usr/bin/env node
/**
 * VolleyOps — Production Data Recovery
 *
 * This script restores the original tournament state from a MongoDB backup.
 * It does NOT generate new demo data. It does NOT run the seed.
 *
 * Usage:
 *   node scripts/recover-from-backup.mjs <path-to-mongodump-directory>
 *
 * Example:
 *   node scripts/recover-from-backup.mjs ./backup/volleyops-2026-09-20
 *
 * The mongodump directory should contain the BSON files for the collections:
 *   tournaments.bson, teams.bson, players.bson, matches.bson,
 *   rallyevents.bson, courts.bson, users.bson, etc.
 *
 * IMPORTANT:
 * - This script connects directly to the production database.
 * - It replaces collections with the backup data.
 * - Ensure you have a PRE-RECOVERY snapshot before running.
 * - Verify the backup contains the original production data before restoring.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable is not set.');
  process.exit(1);
}

const backupDir = process.argv[2];
if (!backupDir) {
  console.error('Usage: node scripts/recover-from-backup.mjs <path-to-mongodump-directory>');
  process.exit(1);
}

async function main() {
  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log('Connected.\n');

  const db = mongoose.connection.db;
  const dbName = db.databaseName;

  // Read backup directory
  let files;
  try {
    files = await readdir(backupDir);
  } catch (err) {
    console.error(`ERROR: Cannot read backup directory: ${backupDir}`);
    console.error(err.message);
    await mongoose.disconnect();
    process.exit(1);
  }

  const bsonFiles = files.filter((f) => f.endsWith('.bson'));
  if (bsonFiles.length === 0) {
    console.error('ERROR: No .bson files found in backup directory.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Found ${bsonFiles.length} collection(s) in backup: ${bsonFiles.map(f => f.replace('.bson', '')).join(', ')}\n`);

  // Confirm with user
  console.log('WARNING: This will REPLACE the following collections in the production database:');
  for (const file of bsonFiles) {
    const collName = file.replace('.bson', '');
    const count = await db.collection(collName).countDocuments();
    console.log(`  - ${collName} (currently ${count} documents)`);
  }
  console.log('\nPress Ctrl+C to cancel, or wait 10 seconds to continue...');
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Restore each collection
  const { ObjectId } = mongoose.Types;
  const { BSON } = await import('mongodb');
  const deserializer = new BSON.Deserializer();

  for (const file of bsonFiles) {
    const collName = file.replace('.bson', '');
    const filePath = join(backupDir, file);
    console.log(`\nRestoring ${collName}...`);

    const data = await readFile(filePath);
    const docs = deserializer.deserialize(data);

    if (!Array.isArray(docs) || docs.length === 0) {
      console.log(`  Skipping ${collName}: empty or invalid backup file.`);
      continue;
    }

    // Drop and recreate
    await db.collection(collName).deleteMany({});
    await db.collection(collName).insertMany(docs, { ordered: false });
    console.log(`  Restored ${docs.length} document(s) to ${collName}`);
  }

  console.log('\nRecovery complete.');
  console.log('Verify the production data before proceeding.');
  console.log('Then run: node scripts/fix-semifinals.mjs');

  await mongoose.disconnect();
}

function readFile(path) {
  const fs = require('node:fs/promises');
  return fs.readFile(path);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
