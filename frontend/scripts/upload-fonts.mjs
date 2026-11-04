// One-off: upload the licensed font files from public/fonts/helvetica-now-text/
// to the private "lgn-fonts" Vercel Blob store, at the pathnames
// fetch-fonts.mjs downloads from. Run again to replace them (e.g. a new kit).
//
//   npx vercel env pull .env.blob.local --environment=development
//   node --env-file=.env.blob.local scripts/upload-fonts.mjs
//
// Needs BLOB_READ_WRITE_TOKEN in the environment; it is never printed.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { put } from '@vercel/blob';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'fonts', 'helvetica-now-text');
const FILES = ['regular.woff2', 'regular.woff', 'medium.woff2', 'medium.woff'];
const TYPES = { woff2: 'font/woff2', woff: 'font/woff' };

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('upload-fonts: BLOB_READ_WRITE_TOKEN is not set.');
  process.exit(1);
}

for (const name of FILES) {
  const body = await readFile(join(DIR, name));
  const blob = await put(`fonts/helvetica-now-text/${name}`, body, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: TYPES[name.split('.').pop()],
  });
  console.log(`upload-fonts: ${blob.pathname} (${body.length} bytes)`);
}
