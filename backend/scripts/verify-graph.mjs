#!/usr/bin/env node
/*
 * Load the entire server module graph without starting the HTTP server or
 * connecting to Mongo. Because Node's ESM loader resolves every import eagerly,
 * this throws on any bad *named* export (e.g. importing `slotsResolved` from a
 * module that doesn't export it) — a class of bug that a syntax check or a
 * file-existence check silently misses. app.js is safe to import: it builds the
 * Express app but does not open a DB connection or listen (that lives in
 * server.js), so this runs offline.
 *
 * Exits non-zero if any module in the graph fails to load.
 */
try {
  await import('../src/app.js');
  console.log('OK: server module graph loads (all imports + named exports resolve).');
} catch (err) {
  console.error('MODULE GRAPH FAILED TO LOAD:\n');
  console.error(err);
  process.exit(1);
}
