#!/usr/bin/env node
/*
 * Dependency-free import-resolution check.
 *
 * The sandbox can't `npm install` (registry 403), so we can't run eslint/vite
 * here. This walks every JS/JSX file under src/, extracts its relative imports,
 * and verifies each target resolves to a real file (trying .js/.jsx/index.*).
 * It catches the most common breakage — a moved/renamed/mis-pathed import —
 * without needing a bundler. Exits non-zero if anything is unresolved.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(jsx?|mjs)$/.test(entry)) files.push(full);
  }
})(root);

const importRe = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g;
const bareImportRe = /import\s*['"]([^'"]+)['"]/g;
const exts = ['', '.js', '.jsx', '.mjs', '/index.js', '/index.jsx'];

let errors = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const specs = new Set();
  let m;
  while ((m = importRe.exec(src))) specs.add(m[1]);
  while ((m = bareImportRe.exec(src))) specs.add(m[1]);
  for (const spec of specs) {
    if (!spec.startsWith('.')) continue; // skip packages
    const base = resolve(dirname(file), spec);
    const ok = exts.some((e) => existsSync(base + e) && (extname(base + e) ? statSync(base + e).isFile() : false));
    if (!ok) {
      console.error(`UNRESOLVED  ${file.replace(root, 'src')}  ->  ${spec}`);
      errors++;
    }
  }
}

if (errors) {
  console.error(`\n${errors} unresolved import(s).`);
  process.exit(1);
}
console.log(`OK: all relative imports resolve across ${files.length} files.`);
