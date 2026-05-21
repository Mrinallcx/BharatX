import * as esbuild from 'esbuild';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('..', import.meta.url)));
const outDir = path.join(root, 'public', 'widget');
const outfile = path.join(outDir, 'v1.js');

await mkdir(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, 'widget-src', 'index.ts')],
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'BharatXWidget',
  target: ['es2020'],
  outfile,
  logLevel: 'info',
});

console.log('Built', outfile);
