#!/usr/bin/env node
/**
 * VolleyOps — Restore from MongoDB Backup
 *
 * This script restores the production database from a mongodump backup.
 * It uses the `mongorestore` command-line tool if available.
 *
 * Usage:
 *   node scripts/restore-from-backup.mjs <path-to-mongodump-directory>
 *
 * Example:
 *   node scripts/restore-from-backup.mjs ./backup/volleyops-2026-09-20
 *
 * Prerequisites:
 *   - MongoDB Database Tools installed (includes mongorestore)
 *   - MONGODB_URI environment variable set
 *
 * Install MongoDB Database Tools:
 *   npm install -g mongodb-database-tools
 *   or download from: https://www.mongodb.com/try/download/database-tools
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable is not set.');
  process.exit(1);
}

const backupDir = process.argv[2];
if (!backupDir) {
  console.error('Usage: node scripts/restore-from-backup.mjs <path-to-mongodump-directory>');
  process.exit(1);
}

async function main() {
  console.log('Checking for mongorestore...');
  
  // Try to find mongorestore
  const mongorestorePath = await findMongorestore();
  if (!mongorestorePath) {
    console.error('\nERROR: mongorestore not found.');
    console.error('Install MongoDB Database Tools:');
    console.error('  npm install -g mongodb-database-tools');
    console.error('  or download from https://www.mongodb.com/try/download/database-tools');
    process.exit(1);
  }

  console.log(`Found mongorestore at: ${mongorestorePath}`);
  console.log(`Backup directory: ${backupDir}`);
  console.log(`Target database: ${new URL(MONGODB_URI).pathname.slice(1)}`);
  
  console.log('\nWARNING: This will DROP and REPLACE all collections in the production database.');
  console.log('Press Ctrl+C to cancel, or wait 10 seconds to continue...');
  await new Promise((resolve) => setTimeout(resolve, 10000));

  const args = [
    '--uri', MONGODB_URI,
    '--dir', backupDir,
    '--drop',
    '--objcheck',
  ];

  console.log('\nRunning mongorestore...');
  
  const child = spawn(mongorestorePath, args, {
    stdio: 'inherit',
    shell: true,
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log('\nRecovery complete.');
      console.log('Verify the production data before proceeding.');
      console.log('Then run: node scripts/fix-semifinals.mjs');
    } else {
      console.error(`\nmongorestore exited with code ${code}`);
      process.exit(1);
    }
  });

  child.on('error', (err) => {
    console.error('Failed to start mongorestore:', err);
    process.exit(1);
  });
}

function findMongorestore() {
  const possiblePaths = [
    'mongorestore',
    'mongorestore.exe',
    join(process.env.LOCALAPPDATA || '', 'Programs', 'mongodb-database-tools', 'mongorestore.exe'),
    join(process.env.ProgramFiles || '', 'MongoDB', 'Tools', 'mongorestore.exe'),
  ];

  // Try each path
  for (const cmd of possiblePaths) {
    try {
      const result = spawn(cmd, ['--version'], { stdio: 'pipe', shell: true });
      return new Promise((resolve) => {
        result.on('close', (code) => {
          resolve(code === 0 ? cmd : null);
        });
        result.on('error', () => resolve(null));
      });
    } catch {
      continue;
    }
  }

  return null;
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
