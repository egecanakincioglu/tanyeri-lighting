import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { gitBashFromExecPath, resolveBash } from './bash.ts';

const exists =
  (...files: string[]) =>
  (f: string) =>
    files.includes(f);

describe('gitBashFromExecPath', () => {
  test('standard Git for Windows layout', () => {
    const p = 'C:/Program Files/Git/mingw64/libexec/git-core';
    assert.equal(
      gitBashFromExecPath(p, exists('C:/Program Files/Git/bin/bash.exe')),
      'C:/Program Files/Git/bin/bash.exe',
    );
  });
  test('backslashes and trailing separators are normalized', () => {
    const p = 'C:\\Program Files\\Git\\mingw64\\libexec\\git-core\\';
    assert.equal(
      gitBashFromExecPath(p, exists('C:/Program Files/Git/bin/bash.exe')),
      'C:/Program Files/Git/bin/bash.exe',
    );
  });
  test('falls back to usr/bin/bash.exe', () => {
    const p = 'D:/tools/Git/mingw64/libexec/git-core';
    assert.equal(gitBashFromExecPath(p, exists('D:/tools/Git/usr/bin/bash.exe')), 'D:/tools/Git/usr/bin/bash.exe');
  });
  test('prefers bin/bash.exe over usr/bin/bash.exe', () => {
    const p = 'C:/Git/mingw64/libexec/git-core';
    assert.equal(
      gitBashFromExecPath(p, exists('C:/Git/usr/bin/bash.exe', 'C:/Git/bin/bash.exe')),
      'C:/Git/bin/bash.exe',
    );
  });
  test('nothing found or empty input gives null', () => {
    assert.equal(gitBashFromExecPath('C:/Git/mingw64/libexec/git-core', exists()), null);
    assert.equal(gitBashFromExecPath('', exists('/bin/bash.exe')), null);
    assert.equal(gitBashFromExecPath(undefined, exists()), null);
  });
  test('never returns a System32 launcher', () => {
    assert.equal(gitBashFromExecPath('C:/Windows/System32/foo', exists('C:/Windows/System32/bash.exe')), null);
  });
});

describe('resolveBash', () => {
  test('non-Windows platforms use plain bash', () => {
    assert.equal(resolveBash({ platform: 'linux', run: () => assert.fail('must not run git') }), 'bash');
  });
  test('Windows resolves Git Bash via git --exec-path', () => {
    const run = (cmd: string, args: string[]) =>
      cmd === 'git' && args[0] === '--exec-path' ? 'C:/Program Files/Git/mingw64/libexec/git-core' : null;
    assert.equal(
      resolveBash({ platform: 'win32', run, existsFn: exists('C:/Program Files/Git/bin/bash.exe') }),
      'C:/Program Files/Git/bin/bash.exe',
    );
  });
  test('Windows without git or Git Bash gives null', () => {
    assert.equal(resolveBash({ platform: 'win32', run: () => null, existsFn: exists() }), null);
    assert.equal(
      resolveBash({ platform: 'win32', run: () => 'C:/Git/mingw64/libexec/git-core', existsFn: exists() }),
      null,
    );
  });
});
