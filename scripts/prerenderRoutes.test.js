/** @jest-environment node */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prerenderRoutes, ROUTES } from './prerenderRoutes.js';

const ORIGIN = 'https://harkirat155.github.io/cc';
const shell = fs.readFileSync(path.resolve('index.html'), 'utf8');
const meta = (html, key) =>
  (html.match(new RegExp(`<meta\\s+(?:property|name)="${key}"\\s+content="([^"]*)"`)) || [])[1];

describe('prerenderRoutes', () => {
  let dist;
  beforeAll(() => {
    dist = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-dist-'));
    fs.writeFileSync(path.join(dist, 'index.html'), shell);
    prerenderRoutes(dist);
  });
  afterAll(() => fs.rmSync(dist, { recursive: true, force: true }));

  test('daily gets its own title, canonical, og:url and daily card', () => {
    const html = fs.readFileSync(path.join(dist, 'daily', 'index.html'), 'utf8');
    expect(html).toMatch(/<title>[^<]*Daily[^<]*<\/title>/);
    expect(meta(html, 'og:url')).toBe(`${ORIGIN}/daily/`);
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/daily/" />`);
    expect(meta(html, 'og:image')).toBe(`${ORIGIN}/og-daily.png`);
    expect(meta(html, 'twitter:image')).toBe(`${ORIGIN}/og-daily.png`);
    expect(meta(html, 'twitter:card')).toBe('summary_large_image');
    expect(meta(html, 'og:title')).toMatch(/Daily/);
  });

  test('rush is a real page, so a shared challenge link answers 200 with a Rush preview', () => {
    const html = fs.readFileSync(path.join(dist, 'rush', 'index.html'), 'utf8');
    expect(html).toMatch(/<title>[^<]*Rush[^<]*<\/title>/);
    expect(meta(html, 'og:url')).toBe(`${ORIGIN}/rush/`);
    expect(meta(html, 'og:description')).toMatch(/3 minutes/);
  });

  test('every static route is emitted with its own og:url and none claims the home page', () => {
    expect(Object.keys(ROUTES).sort()).toEqual(['agents', 'arena', 'daily', 'live', 'lobby', 'rush']);
    for (const route of Object.keys(ROUTES)) {
      const html = fs.readFileSync(path.join(dist, route, 'index.html'), 'utf8');
      expect(meta(html, 'og:url')).toBe(`${ORIGIN}/${route}/`);
      expect(html).toContain(`href="${ORIGIN}/${route}/"`);
      expect(html).not.toContain(`rel="canonical" href="${ORIGIN}/"`);
    }
  });
});
