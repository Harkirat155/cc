import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { buildAssetList } from '../src/sw/core.js';

const walk = (dir, rel = '') =>
  fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((e) => {
    const r = rel ? `${rel}/${e.name}` : e.name;
    return e.isDirectory() ? walk(dir, r) : [r];
  });

// Bundle src/sw/worker.js into <dist>/sw.js with the list of built files and a version made from their bytes.
export async function buildWorker(dist, base, { kill = false } = {}) {
  const files = buildAssetList(walk(dist), base);
  const hash = crypto.createHash('sha256');
  for (const url of files) {
    hash.update(url).update(fs.readFileSync(path.join(dist, url.slice(base.length))));
  }
  const version = hash.digest('hex').slice(0, 12);
  await build({
    entryPoints: [path.resolve(kill ? 'src/sw/kill.js' : 'src/sw/worker.js')],
    outfile: path.join(dist, 'sw.js'),
    bundle: true,
    minify: true,
    format: 'iife',
    define: { __VERSION__: JSON.stringify(version), __BASE__: JSON.stringify(base), __PRECACHE__: JSON.stringify(files) },
  });
  return { version, files };
}
