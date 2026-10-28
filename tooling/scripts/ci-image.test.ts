import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { imageVersion, main, parseManifest, resolveImage } from './ci-image.ts';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ci-image.ts');
const DIGEST = `sha256:${'a'.repeat(64)}`;
const MANIFEST = [
  '# comment',
  `FROM ghcr.io/gitleaks/gitleaks:v8.30.1@${DIGEST} AS gitleaks`,
  `FROM postgres:18.1@${DIGEST} AS postgres`,
  'FROM node:24 AS undigested',
  '',
].join('\n');

describe('parseManifest', () => {
  test('maps every stage to its reference', () => {
    const m = parseManifest(MANIFEST);
    assert.equal(m.get('gitleaks'), `ghcr.io/gitleaks/gitleaks:v8.30.1@${DIGEST}`);
    assert.equal(m.get('undigested'), 'node:24');
    assert.equal(m.size, 3);
  });
  test('tolerates CRLF line endings', () => {
    assert.equal(parseManifest(MANIFEST.replace(/\n/g, '\r\n')).get('postgres'), `postgres:18.1@${DIGEST}`);
  });
});

describe('resolveImage and imageVersion', () => {
  test('returns the digest-pinned reference', () => {
    assert.equal(resolveImage(MANIFEST, 'postgres'), `postgres:18.1@${DIGEST}`);
  });
  test('rejects a missing stage', () => {
    assert.equal(resolveImage(MANIFEST, 'nope'), null);
  });
  test('rejects a stage without a digest', () => {
    assert.equal(resolveImage(MANIFEST, 'undigested'), null);
  });
  test('version is the tag without the leading v', () => {
    assert.equal(imageVersion(MANIFEST, 'gitleaks'), '8.30.1');
    assert.equal(imageVersion(MANIFEST, 'postgres'), '18.1');
    assert.equal(imageVersion(MANIFEST, 'undigested'), null);
  });
});

describe('main', () => {
  const quiet = () => {};
  test('usage error without a stage', () => {
    assert.equal(main([], MANIFEST, quiet, quiet), 1);
  });
  test('exit 1 for unknown stage', () => {
    assert.equal(main(['nope'], MANIFEST, quiet, quiet), 1);
  });
  test('prints the reference', () => {
    const out: string[] = [];
    assert.equal(
      main(['gitleaks'], MANIFEST, (s) => out.push(s), quiet),
      0,
    );
    assert.deepEqual(out, [`ghcr.io/gitleaks/gitleaks:v8.30.1@${DIGEST}`]);
  });
  test('--version prints only the version', () => {
    const out: string[] = [];
    assert.equal(
      main(['--version', 'gitleaks'], MANIFEST, (s) => out.push(s), quiet),
      0,
    );
    assert.deepEqual(out, ['8.30.1']);
  });
});

describe('cli against the real manifest', () => {
  test('gitleaks resolves to a digest-pinned reference', () => {
    const r = spawnSync(process.execPath, [SCRIPT, 'gitleaks'], { encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout.trim(), /^ghcr\.io\/gitleaks\/gitleaks:v\d+\.\d+\.\d+@sha256:[0-9a-f]{64}$/);
  });
  test('unknown stage exits 1', () => {
    const r = spawnSync(process.execPath, [SCRIPT, 'no-such-stage'], { encoding: 'utf8' });
    assert.equal(r.status, 1);
  });
});
