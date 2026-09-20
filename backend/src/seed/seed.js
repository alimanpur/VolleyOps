import { connectDb, disconnectDb } from '../config/db.js';
import { runSeed } from './seedRunner.js';

/** CLI entry: `npm run seed`. Prints the one-time access codes at the end. */
async function main() {
  await connectDb();
  const { codes } = await runSeed({ log: (m) => console.log(`[seed] ${m}`) });

  console.log('\n==================== ACCESS ====================');
  console.log(`ADMIN     login: ${codes.admin.username} / ${codes.admin.password}`);
  console.log('\nCAPTAIN codes (redeem at /captain):');
  for (const c of codes.captains) console.log(`  ${c.team.padEnd(18)} ${c.code}`);
  console.log('\nSCORER codes (redeem at /scorer):');
  for (const s of codes.scorers) console.log(`  ${s.name.padEnd(18)} ${s.code}`);
  console.log('================================================\n');

  await disconnectDb();
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
