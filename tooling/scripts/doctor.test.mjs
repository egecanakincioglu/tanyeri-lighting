import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  exitCodeFor,
  findCrlfFiles,
  formatReport,
  hint,
  hooksPathOk,
  keyMaterial,
  missingExcludes,
  parseNodeMajor,
  runChecks,
  signingKeyPath,
} from './doctor.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = '/work/tanyeri';
const HOME = '/home/dev';
// fake public key material, used only in tests
const KEY = 'AAAAC3NzaC1lZDI1NTE5AAAAIabc123'; // gitleaks:allow
const PUB = `ssh-ed25519 ${KEY} dev@example.com`;
const LOCAL_DIR = '.' + 'cl' + 'aude';

// A machine on which every check passes; each test breaks one thing.
function healthy() {
  const cfg = {
    'user.name': 'Dev',
    'user.email': 'dev@example.com',
    'core.hooksPath': `${ROOT}/tooling/git-hooks`,
    'gpg.format': 'ssh',
    'commit.gpgsign': 'true',
    'user.signingkey': `${HOME}/.ssh/k.pub`,
    'gpg.ssh.allowedSignersFile': `${HOME}/.ssh/signers`,
    'core.autocrlf': 'false',
  };
  const cmds = {
    'git ls-files --eol': 'i/lf    w/lf    attr/text=auto eol=lf          \tREADME.md',
    'git rev-parse --git-path info/exclude': '.git/info/exclude',
    'gitleaks version': '8.30.1',
    'gh auth status': 'Logged in',
    'pnpm --version': '10.0.0',
    'pnpm.cmd --version': '10.0.0',
  };
  const files = {
    [`${ROOT}/.node-version`]: '24\n',
    [`${HOME}/.ssh/k.pub`]: `${PUB}\n`,
    [`${HOME}/.ssh/signers`]: `dev@example.com ssh-ed25519 ${KEY}\n`,
    [`${ROOT}/.git/info/exclude`]: `# comment\n${LOCAL_DIR}/\n/.mcp.json\n`,
  };
  const env = { cfg, cmds, files, nodeVersion: 'v24.1.0', platform: 'linux' };
  return env;
}

function run(env) {
  const exec = (cmd, args) => {
    const line = `${cmd} ${args.join(' ')}`;
    if (cmd === 'git' && args[0] === 'config') {
      const v = env.cfg[args[2]];
      return { ok: v !== undefined, missing: false, out: v ?? '', err: '' };
    }
    if (line in env.cmds) {
      const v = env.cmds[line];
      return v === null
        ? { ok: false, missing: true, out: '', err: 'ENOENT' }
        : v === false
          ? { ok: false, missing: false, out: '', err: 'failed' }
          : { ok: true, missing: false, out: v, err: '' };
    }
    return { ok: false, missing: true, out: '', err: 'ENOENT' };
  };
  const items = runChecks({
    platform: env.platform,
    nodeVersion: env.nodeVersion,
    root: ROOT,
    home: HOME,
    exec,
    fileExists: (p) => p.replaceAll('\\', '/') in env.files,
    readText: (p) => {
      if (!(p in env.files)) throw new Error('ENOENT');
      return env.files[p];
    },
  });
  const by = Object.fromEntries(items.map((i) => [i.name, i]));
  return { items, by };
}

describe('pure helpers', () => {
  test('hooksPathOk accepts relative and absolute forms of tooling/git-hooks only', () => {
    assert.equal(hooksPathOk('tooling/git-hooks', ROOT), true);
    assert.equal(hooksPathOk(`${ROOT}/tooling/git-hooks`, ROOT), true);
    assert.equal(hooksPathOk('C:\\Work\\Tanyeri\\tooling\\git-hooks', 'c:/work/tanyeri'), true);
    assert.equal(hooksPathOk('/other/tooling/git-hooks', ROOT), false);
    assert.equal(hooksPathOk('.git/hooks', ROOT), false);
    assert.equal(hooksPathOk('', ROOT), false);
    assert.equal(hooksPathOk(undefined, ROOT), false);
  });
  test('parseNodeMajor', () => {
    assert.equal(parseNodeMajor('24\n'), 24);
    assert.equal(parseNodeMajor('v22.3.1'), 22);
    assert.equal(parseNodeMajor(''), null);
  });
  test('signingKeyPath and keyMaterial', () => {
    assert.equal(signingKeyPath('~/.ssh/k.pub', '/h'), path.join('/h', '.ssh/k.pub'));
    assert.equal(signingKeyPath(PUB), null);
    assert.equal(signingKeyPath(''), null);
    assert.equal(keyMaterial(PUB), KEY);
    assert.equal(keyMaterial('garbage'), null);
  });
  test('findCrlfFiles lists crlf and mixed working copies only', () => {
    const out = [
      'i/lf    w/lf    attr/text=auto eol=lf \tok.md',
      'i/lf    w/crlf  attr/text=auto eol=lf \ta b.md',
      'i/lf    w/mixed attr/                 \tm.sh',
      'i/-text w/-text attr/-text            \timg.png',
    ].join('\n');
    assert.deepEqual(findCrlfFiles(out), ['a b.md', 'm.sh']);
  });
  test('findCrlfFiles skips files git treats as non-text', () => {
    const out = [
      'i/crlf  w/crlf  attr/-text \tpublic/pdf-placeholder.svg',
      'i/-text w/crlf  attr/      \tbin.dat',
      'i/lf    w/crlf  attr/text=auto eol=lf \treal.md',
    ].join('\n');
    assert.deepEqual(findCrlfFiles(out), ['real.md']);
  });
  test('missingExcludes tolerates slashes and ignores comments', () => {
    assert.deepEqual(missingExcludes(`${LOCAL_DIR}\n/.mcp.json\n`), []);
    assert.deepEqual(missingExcludes(`# ${LOCAL_DIR}\n`), [LOCAL_DIR, '.mcp.json']);
    assert.deepEqual(missingExcludes(null), [LOCAL_DIR, '.mcp.json']);
  });
  test('hints differ per OS', () => {
    for (const tool of ['node', 'gitleaks', 'gh', 'pnpm'])
      assert.notEqual(hint('win32', tool), hint('linux', tool));
  });
});

describe('runChecks', () => {
  test('a healthy machine passes everything', () => {
    const { items } = run(healthy());
    assert.deepEqual(
      items.filter((i) => i.level !== 'ok'),
      [],
    );
    assert.equal(exitCodeFor(items), 0);
  });

  test('node: wrong major fails with an OS hint, unreadable .node-version fails', () => {
    const e = healthy();
    e.nodeVersion = 'v22.1.0';
    assert.equal(run(e).by.node.level, 'error');
    assert.match(run(e).by.node.fix, /fnm/);
    e.platform = 'win32';
    assert.match(run(e).by.node.fix, /winget/);
    delete e.files[`${ROOT}/.node-version`];
    assert.match(run(e).by.node.detail, /could not be read/);
  });

  test('git identity: name and email must both be set', () => {
    const e = healthy();
    delete e.cfg['user.email'];
    const r = run(e).by['git identity'];
    assert.equal(r.level, 'error');
    assert.match(r.detail, /user\.email/);
    assert.doesNotMatch(r.detail, /user\.name/);
    delete e.cfg['user.name'];
    assert.match(run(e).by['git identity'].detail, /user\.name and user\.email/);
  });

  test('hooks: missing or foreign core.hooksPath fails, relative value passes', () => {
    const e = healthy();
    e.cfg['core.hooksPath'] = 'tooling/git-hooks';
    assert.equal(run(e).by['git hooks'].level, 'ok');
    delete e.cfg['core.hooksPath'];
    const r = run(e).by['git hooks'];
    assert.equal(r.level, 'error');
    assert.match(r.fix, /setup-git-hooks\.sh/);
    e.cfg['core.hooksPath'] = '/elsewhere/hooks';
    assert.equal(run(e).by['git hooks'].level, 'error');
  });

  test('signing: gpg.format and commit.gpgsign', () => {
    for (const [k, v] of [
      ['gpg.format', 'openpgp'],
      ['commit.gpgsign', 'false'],
    ]) {
      const e = healthy();
      e.cfg[k] = v;
      const { by } = run(e);
      assert.equal(by['commit signing'].level, 'error');
      assert.equal(by['allowed signers'], undefined);
    }
  });

  test('signing: unset key, missing key file, unreadable key', () => {
    const e = healthy();
    delete e.cfg['user.signingkey'];
    assert.match(run(e).by['commit signing'].detail, /not set/);
    e.cfg['user.signingkey'] = `${HOME}/.ssh/gone.pub`;
    assert.match(run(e).by['commit signing'].detail, /does not exist/);
    e.cfg['user.signingkey'] = `${HOME}/.ssh/k.pub`;
    e.files[`${HOME}/.ssh/k.pub`] = 'not a key';
    assert.match(run(e).by['commit signing'].detail, /not a readable public key/);
  });

  test('signing: a private key path resolves to its .pub, a literal key works', () => {
    const e = healthy();
    e.cfg['user.signingkey'] = `${HOME}/.ssh/k`;
    assert.equal(run(e).by['commit signing'].level, 'ok');
    e.cfg['user.signingkey'] = PUB;
    assert.equal(run(e).by['commit signing'].level, 'ok');
  });

  test('allowed signers: unset, missing file, key absent', () => {
    const e = healthy();
    delete e.cfg['gpg.ssh.allowedSignersFile'];
    assert.equal(run(e).by['allowed signers'].level, 'error');
    e.cfg['gpg.ssh.allowedSignersFile'] = `${HOME}/.ssh/none`;
    assert.match(run(e).by['allowed signers'].detail, /does not exist/);
    e.cfg['gpg.ssh.allowedSignersFile'] = `${HOME}/.ssh/signers`;
    e.files[`${HOME}/.ssh/signers`] = 'dev@example.com ssh-ed25519 AAAAother\n';
    assert.match(run(e).by['allowed signers'].detail, /does not contain/);
  });

  test('core.autocrlf=true fails', () => {
    const e = healthy();
    e.cfg['core.autocrlf'] = 'true';
    assert.equal(run(e).by['core.autocrlf'].level, 'error');
    delete e.cfg['core.autocrlf'];
    assert.equal(run(e).by['core.autocrlf'].level, 'ok');
  });

  test('CRLF files fail and are capped at 10', () => {
    const e = healthy();
    e.cmds['git ls-files --eol'] = Array.from(
      { length: 12 },
      (_, i) => `i/lf    w/crlf  attr/text=auto eol=lf \tf${i}.md`,
    ).join('\n');
    const r = run(e).by['line endings'];
    assert.equal(r.level, 'error');
    assert.match(r.detail, /12 tracked/);
    assert.match(r.detail, /f9\.md/);
    assert.doesNotMatch(r.detail, /f10\.md/);
    assert.match(r.detail, /and 2 more/);
    e.cmds['git ls-files --eol'] = false;
    assert.equal(run(e).by['line endings'].level, 'warn');
  });

  test('gitleaks: binary, container runtime, or neither', () => {
    const e = healthy();
    e.cmds['gitleaks version'] = null;
    assert.equal(run(e).by.gitleaks.level, 'error');
    assert.match(run(e).by.gitleaks.fix, /Gitleaks/i);
    e.cmds['podman info'] = 'ok';
    assert.match(run(e).by.gitleaks.detail, /podman/);
    assert.equal(run(e).by.gitleaks.level, 'ok');
    e.cmds['docker info'] = false;
    assert.match(run(e).by.gitleaks.detail, /podman/);
  });

  test('gh: not installed and not authenticated both fail', () => {
    const e = healthy();
    e.cmds['gh auth status'] = null;
    assert.match(run(e).by.gh.detail, /not installed/);
    e.cmds['gh auth status'] = false;
    const r = run(e).by.gh;
    assert.equal(r.level, 'error');
    assert.match(r.fix, /gh auth login/);
  });

  test('pnpm is only a warning, and uses the .cmd shim on Windows', () => {
    const e = healthy();
    e.cmds['pnpm --version'] = null;
    const r = run(e);
    assert.equal(r.by.pnpm.level, 'warn');
    assert.equal(exitCodeFor(r.items), 0);
    e.platform = 'win32';
    assert.equal(run(e).by.pnpm.level, 'ok');
  });

  test('local excludes: both entries are required', () => {
    const e = healthy();
    e.files[`${ROOT}/.git/info/exclude`] = `${LOCAL_DIR}\n`;
    const r = run(e).by['local excludes'];
    assert.equal(r.level, 'error');
    assert.match(r.detail, /\.mcp\.json/);
    assert.match(r.fix, /info\/exclude/);
    delete e.files[`${ROOT}/.git/info/exclude`];
    assert.match(run(e).by['local excludes'].detail, new RegExp(LOCAL_DIR.replace('.', '\\.')));
  });

  test('every failing check is listed and the exit code is 1', () => {
    const e = healthy();
    e.nodeVersion = 'v20.0.0';
    e.cfg['core.autocrlf'] = 'true';
    e.cmds['gh auth status'] = false;
    const { items } = run(e);
    assert.equal(items.filter((i) => i.level === 'error').length, 3);
    assert.equal(exitCodeFor(items), 1);
    const text = formatReport(items);
    assert.match(text, /FAIL .*node/);
    assert.match(text, /fix: gh auth login/);
  });
});

describe('cli', () => {
  test('--json prints parseable output with ok and items', () => {
    const r = spawnSync(process.execPath, [path.join(HERE, 'doctor.mjs'), '--json'], { encoding: 'utf8' });
    const data = JSON.parse(r.stdout);
    assert.equal(typeof data.ok, 'boolean');
    assert.ok(Array.isArray(data.items) && data.items.length > 0);
    assert.equal(r.status, data.ok ? 0 : 1);
  });
});
