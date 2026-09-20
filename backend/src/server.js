import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';

async function main() {
  await connectDb();
  // eslint-disable-next-line no-console
  console.log(`[db] connected to MongoDB`);
  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] VolleyOps API listening on http://localhost:${env.port}/api/v1`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[fatal] failed to start server', err);
  process.exit(1);
});
