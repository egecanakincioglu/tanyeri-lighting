// Runs the pinned gitleaks image with the repository's .gitleaks.toml on a temp repo seeded with fixtures.
// Skipped with a message when no container engine is reachable.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveImage } from './ci-image.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const image = resolveImage(
  readFileSync(path.join(root, 'tooling', 'ci-images', 'Dockerfile'), 'utf8'),
  'gitleaks',
) as string;
type Finding = { RuleID: string; File: string };
const docker = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf8' });
// Windows runners have docker but run Windows containers, which can not start this Linux image.
const engineOs =
  docker.status === 0
    ? spawnSync('docker', ['info', '--format', '{{.OSType}}'], { encoding: 'utf8' }).stdout.trim()
    : '';
const skip =
  docker.status !== 0
    ? 'docker is not available (no reachable daemon); gitleaks rules not exercised'
    : engineOs !== 'linux'
      ? `docker runs ${engineOs || 'unknown'} containers, not linux; gitleaks rules not exercised`
      : false;

describe('.gitleaks.toml custom rules', { skip }, () => {
  test('detects a JSON password, URL credentials and a Turkish mobile number', () => {
    const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'gitleaks-rules-')));
    try {
      const repo = path.join(dir, 'repo');
      const out = path.join(dir, 'out');
      mkdirSync(repo);
      mkdirSync(out);
      copyFileSync(path.join(root, '.gitleaks.toml'), path.join(repo, '.gitleaks.toml'));
      writeFileSync(path.join(repo, 'cfg.json'), '{ "password": "Zq9xLm2Vb7Kd" }\n'); // gitleaks:allow
      writeFileSync(path.join(repo, 'conn.txt'), 'url = postgres://app_user:hunter2pass@db.internal:5432/shop\n'); // gitleaks:allow
      writeFileSync(path.join(repo, 'contact.txt'), 'call 0532 123 45 67 now\n'); // gitleaks:allow
      writeFileSync(path.join(repo, 'code.mjs'), "const o = { token: 'invalid' };\n"); // gitleaks:allow
      const git = (...args: string[]) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
      git('init', '-q', '-b', 'main');
      git('add', '-A');
      git('-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'seed');
      const r = spawnSync(
        'docker',
        [
          'run',
          '--rm',
          '-v',
          `${repo}:/repo:ro`,
          '-v',
          `${out}:/out`,
          image,
          'git',
          '/repo',
          '--config',
          '/repo/.gitleaks.toml',
          '--report-format',
          'json',
          '--report-path',
          '/out/r.json',
          '--exit-code',
          '0',
          '--no-banner',
        ],
        { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } },
      );
      assert.equal(r.status, 0, r.stderr);
      const rules = new Set(JSON.parse(readFileSync(path.join(out, 'r.json'), 'utf8')).map((f: Finding) => f.RuleID));
      const files = JSON.parse(readFileSync(path.join(out, 'r.json'), 'utf8'))
        .filter((f: Finding) => f.RuleID === 'json-secret-field')
        .map((f: Finding) => f.File);
      assert.deepEqual(files, ['cfg.json'], 'json-secret-field must fire on the .json file only, not on code.mjs');
      const jsonFiles = JSON.parse(readFileSync(path.join(out, 'r.json'), 'utf8'))
        .filter((f: Finding) => f.RuleID === 'json-secret-field')
        .map((f: Finding) => f.File);
      assert.deepEqual(jsonFiles, ['cfg.json'], 'json-secret-field must fire on the .json file only, not on code.mjs');
      for (const id of ['json-secret-field', 'url-credentials', 'tr-phone-number']) {
        assert.ok(rules.has(id), `${id} not detected; got ${[...rules].join(', ')}`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
