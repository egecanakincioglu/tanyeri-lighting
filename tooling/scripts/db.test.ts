// Tests for db.ts: the pure parts and the flow against a fake docker; the real docker is never called.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { main, parseInspect, runArgs, upAction } from './db.ts';
import type { DockerResult } from './db.ts';

const IMAGE = 'postgres:18.4@sha256:' + 'a'.repeat(64);
const quiet = () => {};

describe('runArgs', () => {
  const args = runArgs(IMAGE);
  test('binds to loopback only', () => assert.ok(args.includes('127.0.0.1:5432:5432')));
  test('keeps data in a volume under /var/lib/postgresql', () =>
    assert.ok(args.includes('tanyeri-postgres-data:/var/lib/postgresql')));
  test('the image is the last argument', () => assert.equal(args.at(-1), IMAGE));
});

describe('upAction', () => {
  test('no container creates one', () => assert.equal(upAction({ exists: false }, IMAGE), 'create'));
  test('a stopped container starts', () =>
    assert.equal(upAction({ exists: true, running: false, image: IMAGE }, IMAGE), 'start'));
  test('a running container is left alone', () =>
    assert.equal(upAction({ exists: true, running: true, image: IMAGE }, IMAGE), 'none'));
  test('a different image is drift', () =>
    assert.equal(upAction({ exists: true, running: true, image: 'postgres:18.3@sha256:x' }, IMAGE), 'image-drift'));
});

describe('parseInspect', () => {
  test('reads a running container', () =>
    assert.deepEqual(parseInspect(`true ${IMAGE}\n`), { exists: true, running: true, image: IMAGE }));
  test('reads a stopped container', () =>
    assert.deepEqual(parseInspect(`false ${IMAGE}`), { exists: true, running: false, image: IMAGE }));
});

describe('main', () => {
  test('an unknown command is a usage error', () =>
    assert.equal(
      main(['x'], () => ({ status: 0, stdout: '' }), quiet, quiet),
      1,
    ));
  test('missing Docker exits 2', () =>
    assert.equal(
      main(['up'], () => ({ status: null, stdout: '' }), quiet, quiet),
      2,
    ));
  test('down without a container exits 0 and stops nothing', () => {
    const calls: string[][] = [];
    const docker = (a: string[]): DockerResult => {
      calls.push(a);
      return { status: a[0] === 'inspect' ? 1 : 0, stdout: '' };
    };
    assert.equal(main(['down'], docker, quiet, quiet), 0);
    assert.ok(!calls.some((a) => a[0] === 'stop'));
  });
  test('down stops an existing container', () => {
    const calls: string[][] = [];
    const docker = (a: string[]): DockerResult => {
      calls.push(a);
      return { status: 0, stdout: `true ${IMAGE}` };
    };
    assert.equal(main(['down'], docker, quiet, quiet), 0);
    assert.ok(calls.some((a) => a[0] === 'stop'));
  });
});
