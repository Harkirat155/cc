/** @jest-environment node */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  fs.chmodSync(dest, 0o755);
}

function writeFile(filePath, content, mode) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  if (mode) fs.chmodSync(filePath, mode);
}

function createWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-deploy-'));
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'bin'), { recursive: true });

  copyFile(path.join(repoRoot, 'scripts/deploy-backend.sh'), path.join(root, 'scripts/deploy-backend.sh'));
  copyFile(path.join(repoRoot, 'scripts/deploy-frontend.sh'), path.join(root, 'scripts/deploy-frontend.sh'));
  fs.copyFileSync(path.join(repoRoot, 'package.json'), path.join(root, 'package.json'));
  writeFile(path.join(root, 'fly.toml'), 'app = "crisscross-backend"\n');

  return {
    root,
    bin: path.join(root, 'bin'),
    logFile: path.join(root, 'command-log.jsonl'),
  };
}

function createNodeStub(workspace, name, body) {
  writeFile(
    path.join(workspace.bin, name),
    `#!/bin/sh\nSTUB_CMD="$(basename "$0")" exec node --input-type=commonjs - "$@" <<'STUB'\n${body}\nSTUB\n`,
    0o755
  );
}

function installCommonStubs(workspace) {
  const recorder = `
const fs = require('node:fs');
const path = require('node:path');
function record(extra = {}) {
  const env = {
    NODE_ENV: process.env.NODE_ENV || null,
    VITE_SOCKET_SERVER: process.env.VITE_SOCKET_SERVER || null,
    VITE_API_BASE: process.env.VITE_API_BASE || null,
    FLY_API_TOKEN: process.env.FLY_API_TOKEN || null,
    NODE_ENV_VALUE: process.env.NODE_ENV || null,
    CORS_ORIGIN: process.env.CORS_ORIGIN || null,
    PORT: process.env.PORT || null,
  };
  fs.appendFileSync(process.env.COMMAND_LOG, JSON.stringify({
    cmd: process.env.STUB_CMD || path.basename(process.argv[1]),
    args: process.argv.slice(2),
    cwd: process.cwd(),
    env,
    ...extra,
  }) + '\\n');
}
`;

  createNodeStub(workspace, 'nvm', `${recorder}record(); process.exit(0);`);
  createNodeStub(workspace, 'flyctl', `${recorder}record(); process.exit(process.env.STUB_FLYCTL_EXIT ? Number(process.env.STUB_FLYCTL_EXIT) : 0);`);
  createNodeStub(workspace, 'fly', `${recorder}record(); process.exit(0);`);
  createNodeStub(workspace, 'railway', `${recorder}record(); process.exit(0);`);
  createNodeStub(workspace, 'koyeb', `${recorder}record(); process.exit(0);`);
  createNodeStub(workspace, 'curl', `${recorder}record(); process.stdout.write('{}'); process.exit(0);`);
  createNodeStub(
    workspace,
    'npm',
    `${recorder}
record();
const args = process.argv.slice(2);
if (args[0] === 'run' && args[1] === 'check') {
  if (process.env.STUB_NPM_FAIL_CHECK === '1') process.exit(42);
  fs.mkdirSync('dist/assets', { recursive: true });
  fs.writeFileSync('dist/index.html', '<script src="/cc/assets/app.js"></script>');
  fs.writeFileSync('dist/404.html', 'redirect');
  fs.writeFileSync('dist/assets/app.js', String(process.env.VITE_SOCKET_SERVER || ''));
}
if (args[0] === 'run' && args[1] === 'build') {
  if (process.env.STUB_NPM_FAIL_BUILD === '1') process.exit(43);
  fs.mkdirSync('dist/assets', { recursive: true });
  fs.writeFileSync('dist/index.html', '<script src="/cc/assets/app.js"></script>');
  fs.writeFileSync('dist/404.html', 'redirect');
  fs.writeFileSync('dist/assets/app.js', String(process.env.VITE_SOCKET_SERVER || ''));
}
if (args[0] === 'test' && process.env.STUB_NPM_FAIL_TEST === '1') process.exit(44);
process.exit(0);
`
  );
  createNodeStub(workspace, 'npx', `${recorder}record(); process.exit(0);`);
}

function readLog(workspace) {
  if (!fs.existsSync(workspace.logFile)) return [];
  return fs.readFileSync(workspace.logFile, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function runScript(workspace, script, args = [], extraEnv = {}) {
  return spawnSync('bash', [path.join(workspace.root, 'scripts', script), ...args], {
    cwd: workspace.root,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...extraEnv,
      PATH: `${workspace.bin}${path.delimiter}${process.env.PATH}`,
      COMMAND_LOG: workspace.logFile,
    },
  });
}

function writeEnv(workspace, content) {
  const envPath = path.join(workspace.root, 'deploy.env');
  fs.writeFileSync(envPath, content);
  return envPath;
}

describe('deployment scripts integration', () => {
  let workspace;

  beforeEach(() => {
    workspace = createWorkspace();
    installCommonStubs(workspace);
  });

  afterEach(() => {
    fs.rmSync(workspace.root, { recursive: true, force: true });
  });

  test('frontend no-push deploy builds with backend URL and invokes gh-pages safely', () => {
    const result = runScript(workspace, 'deploy-frontend.sh', [
      '--backend-url', 'https://crisscross-backend.fly.dev',
      '--skip-checks',
      '--skip-tests',
      '--no-push',
      '--message', 'Test deploy',
    ]);

    expect(result.status).toBe(0);
    expect(fs.existsSync(path.join(workspace.root, 'dist/.nojekyll'))).toBe(true);
    expect(fs.readFileSync(path.join(workspace.root, 'dist/assets/app.js'), 'utf8'))
      .toContain('https://crisscross-backend.fly.dev');

    const log = readLog(workspace);
    const build = log.find((entry) => entry.cmd === 'npm' && entry.args.join(' ') === 'run build');
    expect(build.env.VITE_SOCKET_SERVER).toBe('https://crisscross-backend.fly.dev');
    expect(build.env.VITE_API_BASE).toBe('https://crisscross-backend.fly.dev');

    const publish = log.find((entry) => entry.cmd === 'npx');
    expect(publish.args).toEqual([
      '--no-install', 'gh-pages', '-d', 'dist', '-b', 'gh-pages', '-o', 'origin',
      '-m', 'Test deploy', '--nojekyll', '--no-push',
    ]);
  });

  test('frontend preflight runs check and test without duplicate build', () => {
    const result = runScript(workspace, 'deploy-frontend.sh', [
      '--backend-url', 'https://api.example.test',
      '--no-push',
    ]);

    expect(result.status).toBe(0);
    const log = readLog(workspace);
    expect(log.filter((entry) => entry.cmd === 'npm' && entry.args.join(' ') === 'run check')).toHaveLength(1);
    expect(log.filter((entry) => entry.cmd === 'npm' && entry.args.join(' ') === 'run build')).toHaveLength(0);
    const test = log.find((entry) => entry.cmd === 'npm' && entry.args[0] === 'test');
    expect(test.env.NODE_ENV).toBe('test');
    expect(log.find((entry) => entry.cmd === 'npx')).toBeTruthy();
  });

  test('frontend infers backend URL from FLY_APP and supports custom gh-pages options', () => {
    const envPath = writeEnv(workspace, 'FLY_APP=custom-crisscross\n');
    const result = runScript(workspace, 'deploy-frontend.sh', [
      '--env-file', envPath,
      '--skip-checks',
      '--skip-tests',
      '--dry-run',
      '--branch', 'pages',
      '--remote', 'upstream',
      '--repo', 'https://github.com/example/repo.git',
      '--dest', 'cc',
      '--message', 'Custom publish',
      '--cname', 'play.example.com',
      '--no-history',
    ]);

    expect(result.status).toBe(0);
    const log = readLog(workspace);
    const build = log.find((entry) => entry.cmd === 'npm' && entry.args.join(' ') === 'run build');
    expect(build.env.VITE_SOCKET_SERVER).toBe('https://custom-crisscross.fly.dev');

    const publish = log.find((entry) => entry.cmd === 'npx');
    expect(publish.args).toEqual([
      '--no-install', 'gh-pages', '-d', 'dist', '-b', 'pages', '-o', 'upstream',
      '-m', 'Custom publish', '--nojekyll', '-r', 'https://github.com/example/repo.git',
      '-e', 'cc', '--cname', 'play.example.com', '--no-history', '--no-push',
    ]);
  });

  test('frontend fails before build when no backend URL can be resolved', () => {
    const result = runScript(workspace, 'deploy-frontend.sh', ['--skip-checks', '--skip-tests', '--no-push'], {
      BACKEND_URL: '',
      VITE_SOCKET_SERVER: '',
      FLY_APP: '',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Set --backend-url, BACKEND_URL, VITE_SOCKET_SERVER, or FLY_APP');
    expect(readLog(workspace).some((entry) => entry.cmd === 'npm')).toBe(false);
  });

  test('frontend preflight failure stops before gh-pages publish', () => {
    const result = runScript(workspace, 'deploy-frontend.sh', ['--backend-url', 'https://api.example.test'], {
      STUB_NPM_FAIL_CHECK: '1',
    });

    expect(result.status).toBe(42);
    const log = readLog(workspace);
    expect(log.find((entry) => entry.cmd === 'npm' && entry.args.join(' ') === 'run check')).toBeTruthy();
    expect(log.some((entry) => entry.cmd === 'npx')).toBe(false);
  });

  test('backend fly deploy sets secrets, deploys, and unsets FLY_API_TOKEN for local auth', () => {
    const envPath = writeEnv(workspace, [
      'NODE_ENV=production',
      'CORS_ORIGIN="https://example.com; touch PWNED"',
      'PORT=10000',
      'FLY_APP=crisscross-backend',
      'FLY_API_TOKEN=super-secret',
      'FLY_USE_LOCAL_AUTH=1',
      '',
    ].join('\n'));

    const result = runScript(workspace, 'deploy-backend.sh', [
      'fly',
      '--env-file', envPath,
      '--skip-checks',
      '--skip-tests',
    ]);

    expect(result.status).toBe(0);
    expect(fs.existsSync(path.join(workspace.root, 'PWNED'))).toBe(false);

    const log = readLog(workspace).filter((entry) => entry.cmd === 'flyctl');
    const secrets = log.find((entry) => entry.args[0] === 'secrets');
    expect(secrets.env.FLY_API_TOKEN).toBeNull();
    expect(secrets.args).toEqual(expect.arrayContaining([
      'set', '-a', 'crisscross-backend', 'NODE_ENV=production',
      'CORS_ORIGIN=https://example.com; touch PWNED', 'PORT=10000',
    ]));

    const deploy = log.find((entry) => entry.args[0] === 'deploy');
    expect(deploy.args).toEqual([
      'deploy', '--config', path.join(workspace.root, 'fly.toml'),
      '--app', 'crisscross-backend', '--remote-only',
    ]);
  });

  test('backend malformed env file fails before provider command runs', () => {
    const envPath = writeEnv(workspace, 'FLY_APP=crisscross-backend\nMALFORMED LINE\n');
    const result = runScript(workspace, 'deploy-backend.sh', [
      'fly',
      '--env-file', envPath,
      '--skip-checks',
      '--skip-tests',
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Invalid env file line 2');
    expect(readLog(workspace).some((entry) => entry.cmd === 'flyctl')).toBe(false);
  });

  test('backend missing required provider env fails before external command', () => {
    const result = runScript(workspace, 'deploy-backend.sh', [
      'render',
      '--skip-checks',
      '--skip-tests',
    ], {
      RENDER_SERVICE_ID: '',
      RENDER_API_KEY: '',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Missing required env var: RENDER_SERVICE_ID');
    expect(result.stderr).toContain('Missing required env var: RENDER_API_KEY');
    expect(readLog(workspace).some((entry) => entry.cmd === 'curl')).toBe(false);
  });
});