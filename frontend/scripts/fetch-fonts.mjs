// Fetch LGN's licensed webfonts (Helvetica Now Text, from MyFonts) into
// public/fonts/helvetica-now-text/ before a build.
//
// The font files are licensed to LGN, and this repository is public, so they
// are not committed (see .gitignore): they live in a private Vercel Blob store
// and each build downloads them, to be served from the site's own domain.
// fonts.css, the @font-face rules with the licence notice, is committed.
//
// Credentials: on Vercel the store is connected to the project, which
// provides BLOB_READ_WRITE_TOKEN (or VERCEL_OIDC_TOKEN with BLOB_STORE_ID);
// the SDK reads them from the environment. Locally, files already in place
// are kept, so a developer with a copy of the kit needs no token.
//
// To replace the fonts: upload the new files to the same pathnames in the
// "lgn-fonts" store (vercel.com > Storage), then redeploy.

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get } from '@vercel/blob';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'fonts', 'helvetica-now-text');
const FILES = ['regular.woff2', 'regular.woff', 'medium.woff2', 'medium.woff'];
const BLOB_PREFIX = 'fonts/helvetica-now-text/';

const exists = (p) => stat(p).then((s) => s.size > 0, () => false);

const missing = [];
for (const name of FILES) if (!(await exists(join(DIR, name)))) missing.push(name);

if (missing.length === 0) {
  console.log('fetch-fonts: all font files already present.');
  process.exit(0);
}

const hasCredentials =
  Boolean(process.env.BLOB_READ_WRITE_TOKEN) || Boolean(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID);

if (!hasCredentials) {
  const message = `fetch-fonts: missing ${missing.join(', ')} and no Blob credentials to download them.`;
  // A deploy must never go out silently in the fallback font.
  if (process.env.VERCEL) {
    console.error(`${message} Connect the "lgn-fonts" Blob store to this project.`);
    process.exit(1);
  }
  console.warn(`${message} The site will fall back to Helvetica / Arial. Copy the kit's files into ${DIR} to fix.`);
  process.exit(0);
}

await mkdir(DIR, { recursive: true });
for (const name of missing) {
  const result = await get(BLOB_PREFIX + name, { access: 'private' });
  if (!result || result.statusCode !== 200) {
    console.error(`fetch-fonts: ${BLOB_PREFIX + name} was not found in the Blob store.`);
    process.exit(1);
  }
  const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
  await writeFile(join(DIR, name), bytes);
  console.log(`fetch-fonts: ${name} (${bytes.length} bytes)`);
}
