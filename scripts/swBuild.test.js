/** @jest-environment node */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildWorker } from './swBuild.js';

const write = (dir, rel, body) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), body); };

describe('buildWorker', () => {
  let dist;
  beforeEach(() => {
    dist = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-sw-'));
    write(dist, 'index.html', '<html>1</html>');
    write(dist, 'assets/app-abc.js', 'console.log(1)');
  });
  afterEach(() => fs.rmSync(dist, { recursive: true, force: true }));

  test('writes sw.js with the asset list and a version', async () => {
    const { version, files } = await buildWorker(dist, '/cc/');
    const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
    expect(files).toEqual(['/cc/assets/app-abc.js', '/cc/index.html']);
    expect(sw).toContain('/cc/assets/app-abc.js');
    expect(sw).toContain(version);
    expect(sw).not.toContain('__PRECACHE__');
  });

  test('the version follows the content: same build same version, a changed file a new one', async () => {
    const a = (await buildWorker(dist, '/cc/')).version;
    expect((await buildWorker(dist, '/cc/')).version).toBe(a);
    write(dist, 'assets/app-abc.js', 'console.log(2)');
    expect((await buildWorker(dist, '/cc/')).version).not.toBe(a);
  });
});
