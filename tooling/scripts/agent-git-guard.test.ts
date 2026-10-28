// Tests for agent-git-guard.ts. Real git repositories in the OS temp dir; nothing is mocked.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const GUARD_SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agent-git-guard.ts');
const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'guard-test-'));

function sh(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

// A repository that carries its own copy of the guard (the guard judges "the repository it lives in").
function makeRepo(name: string, { guard = true }: { guard?: boolean } = {}): string {
  const dir = path.join(root, name);
  mkdirSync(dir, { recursive: true });
  sh(dir, 'init', '-q', '-b', 'main');
  sh(dir, 'config', 'user.name', 'tester');
  sh(dir, 'config', 'user.email', 'tester@example.com');
  sh(dir, 'config', 'commit.gpgsign', 'false');
  if (guard) {
    mkdirSync(path.join(dir, 'tooling', 'scripts'), { recursive: true });
    copyFileSync(GUARD_SRC, path.join(dir, 'tooling', 'scripts', 'agent-git-guard.ts'));
  }
  sh(dir, 'add', '-A');
  sh(dir, 'commit', '-q', '--allow-empty', '-m', 'chore: init');
  return dir;
}

function runGuardRaw(repo: string, stdin: string) {
  const r = spawnSync('node', [path.join(repo, 'tooling', 'scripts', 'agent-git-guard.ts')], {
    cwd: repo,
    input: stdin,
    encoding: 'utf8',
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

type Decision = { allowed: boolean; reason?: string };

function decide(repo: string, command: string, extra: Record<string, unknown> = {}): Decision {
  const { status, stdout } = runGuardRaw(
    repo,
    JSON.stringify({ tool_name: 'Bash', tool_input: { command }, ...extra }),
  );
  assert.equal(status, 0, 'the guard must always exit 0');
  if (stdout.trim() === '') return { allowed: true };
  const out = JSON.parse(stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  return { allowed: false, reason: out.hookSpecificOutput.permissionDecisionReason };
}

const denied = (repo: string, command: string, match?: RegExp): void => {
  const d = decide(repo, command);
  assert.equal(d.allowed, false, `expected deny: ${command}`);
  if (match) assert.match(d.reason as string, match, command);
};
const allowed = (repo: string, command: string, extra?: Record<string, unknown>): void => {
  const d = decide(repo, command, extra);
  assert.equal(d.allowed, true, `expected allow: ${command} (${d.reason})`);
};

let onMain: string; // this repository, checked out on main
let onFeature: string; // this repository, checked out on a feature branch
let other: string; // a different repository on main (without a guard copy)
let pushed: string; // feat/pushed: HEAD is contained in a remote-tracking branch
let local: string; // pushed history plus one commit that exists only locally

before(() => {
  onMain = makeRepo('on-main');
  onFeature = makeRepo('on-feature');
  sh(onFeature, 'switch', '-q', '-c', 'feat/demo');
  other = makeRepo('other-repo', { guard: false });

  // repositories with a remote, to tell pushed history from purely local commits
  const bare = path.join(root, 'remote.git');
  sh(root, 'init', '-q', '--bare', '-b', 'main', bare);
  pushed = makeRepo('pushed');
  sh(pushed, 'remote', 'add', 'origin', bare);
  sh(pushed, 'switch', '-q', '-c', 'feat/pushed');
  sh(pushed, 'commit', '-q', '--allow-empty', '-m', 'chore: second');
  sh(pushed, 'commit', '-q', '--allow-empty', '-m', 'chore: third');
  sh(pushed, 'push', '-q', 'origin', 'feat/pushed');
  local = path.join(root, 'local');
  sh(root, 'clone', '-q', bare, local);
  sh(local, 'config', 'user.name', 'tester');
  sh(local, 'config', 'user.email', 'tester@example.com');
  sh(local, 'config', 'commit.gpgsign', 'false');
  sh(local, 'switch', '-q', 'feat/pushed');
  sh(local, 'commit', '-q', '--allow-empty', '-m', 'chore: local only');
  // a descendant of the pushed HEAD for the "reset forward" case
  sh(pushed, 'branch', 'feat/ahead');
  sh(pushed, 'switch', '-q', 'feat/ahead');
  sh(pushed, 'commit', '-q', '--allow-empty', '-m', 'chore: ahead');
  sh(pushed, 'switch', '-q', 'feat/pushed');
});

after(() => rmSync(root, { recursive: true, force: true }));

describe('deny rules (repository on main)', () => {
  test('commit on main', () => denied(onMain, 'git commit -m "x"', /Direct commits to main/));
  test('commit on main through git -c options', () =>
    denied(onMain, 'git -c user.name=a commit -m x', /Direct commits to main/));
  test('commit --amend on main', () => denied(onMain, 'git commit --amend --no-edit', /Direct commits to main/));
  test('merge on main', () => denied(onMain, 'git merge feat/demo', /Local merges into main/));
  test('push from main without a refspec', () => {
    denied(onMain, 'git push', /Pushing from main/);
    denied(onMain, 'git push -u origin', /Pushing from main/);
  });
  test('push HEAD while on main', () => denied(onMain, 'git push origin HEAD', /Pushing to main/));
  test('a branch switch earlier in the same command lifts the main restriction', () => {
    allowed(onMain, 'git switch -c feat/new && git commit -m x');
    allowed(onMain, 'git checkout -b feat/new; git commit -m x');
  });
  test('switching to main earlier in the command brings the restriction back', () =>
    denied(onFeature, 'git switch main && git commit -m x', /Direct commits to main/));
});

describe('deny rules (any branch)', () => {
  for (const repo of ['onMain', 'onFeature']) {
    const get = () => (repo === 'onMain' ? onMain : onFeature);
    test(`${repo}: --no-verify and -n on commit`, () => {
      denied(get(), 'git commit --no-verify -m x', /--no-verify/);
      denied(get(), 'git commit -n -m x', /--no-verify/);
      denied(get(), 'git commit -nm x', /--no-verify/);
      denied(get(), 'git commit -am x -n', /--no-verify/);
    });
    test(`${repo}: --no-verify on push`, () => denied(get(), 'git push --no-verify origin feat/x', /--no-verify/));
    test(`${repo}: every refspec form that targets main`, () => {
      for (const spec of [
        'main',
        'HEAD:main',
        'feat/x:main',
        'refs/heads/main',
        'HEAD:refs/heads/main',
        '+main',
        ':main',
        'refs/heads/*:refs/heads/*',
      ]) {
        denied(get(), `git push origin ${spec}`, /to main|Force push/);
      }
    });
    test(`${repo}: force push to main`, () => {
      denied(get(), 'git push --force origin main', /Force push/);
      denied(get(), 'git push -f origin main', /Force push/);
      denied(get(), 'git push --force-with-lease origin HEAD:main', /Force push/);
      denied(get(), 'git push origin +main', /Force push/);
    });
    test(`${repo}: push --all and --mirror`, () => {
      denied(get(), 'git push --all origin');
      denied(get(), 'git push --mirror origin');
    });
    test(`${repo}: writing core.hooksPath`, () => {
      denied(get(), 'git config core.hooksPath /dev/null', /core\.hooksPath/);
      denied(get(), 'git config --local core.hooksPath /dev/null', /core\.hooksPath/);
      denied(get(), 'git config --global core.hooksPath /dev/null', /core\.hooksPath/);
      denied(get(), 'git config --unset core.hooksPath', /core\.hooksPath/);
      denied(get(), 'git config --replace-all core.hooksPath x', /core\.hooksPath/);
      denied(get(), 'git config set core.hooksPath x', /core\.hooksPath/);
      denied(get(), 'git config CORE.HOOKSPATH x', /core\.hooksPath/);
      denied(get(), 'git -c core.hooksPath=/dev/null status', /core\.hooksPath/);
    });
    test(`${repo}: admin merge`, () => {
      denied(get(), 'gh pr merge 5 --admin --merge', /Admin-override/);
      denied(get(), 'gh pr merge --admin', /Admin-override/);
    });
  }
});

describe('allowed commands', () => {
  test('feature branch work', () => {
    allowed(onFeature, 'git status');
    allowed(onFeature, 'git commit -m "feat: x"');
    allowed(onFeature, 'git commit -am "feat: x"');
    allowed(onFeature, 'git push -u origin feat/demo');
    allowed(onFeature, 'git push origin feat/demo:feat/demo');
    allowed(onFeature, 'git push origin HEAD');
    allowed(onFeature, 'git push -n origin feat/demo');
    allowed(onFeature, 'git merge main');
    allowed(onFeature, 'git switch main && git pull --ff-only');
    allowed(onFeature, 'gh pr create --fill');
    allowed(onFeature, 'gh pr merge 5 --auto --merge --delete-branch');
  });
  test('main is fine for read-only and sync commands', () => {
    allowed(onMain, 'git status');
    allowed(onMain, 'git pull --ff-only');
    allowed(onMain, 'git switch -c feat/x');
    allowed(onMain, 'git log --oneline -5 main');
    allowed(onMain, 'git diff main..HEAD');
  });
  test('reading core.hooksPath is allowed', () => {
    for (const c of [
      'git config --get core.hooksPath',
      'git config core.hooksPath',
      'git config --get-all core.hooksPath',
      'git config --local --get core.hooksPath',
      'git config --list | grep core.hooksPath',
      'git config get core.hooksPath',
    ]) {
      allowed(onFeature, c);
      allowed(onMain, c);
    }
  });
  test('text that merely mentions forbidden commands is not a command', () => {
    allowed(onFeature, 'git commit -m "docs: explain git push origin main is blocked"');
    allowed(onFeature, 'echo "git push origin main"');
    allowed(
      onFeature,
      'git commit -m "$(cat <<\'EOF\'\nfeat: x\n\ngit push origin main is blocked by the guard\nEOF\n)"',
    );
  });
  test('the setup script may write core.hooksPath', () => {
    allowed(onFeature, 'git config core.hooksPath tooling/git-hooks && tooling/scripts/setup-git-hooks.sh');
    allowed(onFeature, 'tooling/scripts/setup-git-hooks.sh');
  });
  test('commands without git or gh', () => {
    allowed(onMain, 'ls -la');
    allowed(onMain, 'node --test tooling/');
  });
});

describe('force pushes to any branch', () => {
  test('every force form is denied, whatever the branch', () => {
    for (const c of [
      'git push --force origin feat/demo',
      'git push -f origin feat/demo',
      'git push -fu origin feat/demo',
      'git push --force-with-lease origin feat/demo',
      'git push --force-with-lease=feat/demo origin feat/demo',
      'git push --force-if-includes --force-with-lease origin feat/demo',
      'git push origin +feat/demo',
      'git push origin +HEAD:feat/demo',
      'git push --force',
    ]) {
      denied(onFeature, c, /only run by the project owner by hand/);
    }
  });
  test('ordinary pushes stay allowed', () => {
    allowed(onFeature, 'git push -u origin feat/demo');
    allowed(onFeature, 'git push origin feat/demo');
    allowed(onFeature, 'git push --dry-run origin feat/demo');
  });
});

describe('tags are never pushed by the assistant', () => {
  test('tag pushes in every form are denied', () => {
    for (const c of [
      'git push --tags',
      'git push --tags origin',
      'git push origin --tags',
      'git push --follow-tags',
      'git push --follow-tags origin feat/demo',
      'git push --mirror',
      'git push origin v2026.10.12',
      'git push origin refs/tags/x',
      'git push origin +v2026.10.12',
      'git push origin tag v2026.10.12',
      'git push origin :refs/tags/x',
      'git push origin :v2026.10.12',
      'git push origin HEAD:refs/tags/x',
      'git push origin refs/tags/x:refs/tags/y',
      'git -C . push --tags',
      'git push origin "v2026.10.12"',
      "git push origin 'refs/tags/x'",
      'git push origin feat/demo --tags',
      'FOO=1 git push --follow-tags',
      'git status && git push --tags',
      'sudo git push origin v1.2.3',
      'bash -c "git push --tags"',
    ]) {
      denied(onFeature, c);
    }
  });
  test('a local tag name is treated as a tag even without a version-like name', () => {
    sh(onFeature, 'tag', 'release-candidate-x');
    denied(onFeature, 'git push origin release-candidate-x', /tag/i);
    allowed(onFeature, 'git push origin feat/demo');
  });
  test('push.followTags can not be switched on', () => {
    for (const c of [
      'git config push.followTags true',
      'git config --global push.followTags true',
      'git config --local push.followtags 1',
      'git config set push.followTags true',
      'git -c push.followTags=true push',
      'git -c push.followTags push origin feat/demo',
      'git -c push.followTags=yes push origin feat/demo',
      'git --config-env=push.followTags=ENVVAR push',
      'git config --add push.followTags true',
    ]) {
      denied(onFeature, c);
    }
  });
  test('tags can be created and listed locally, ordinary pushes and followTags reads stay allowed', () => {
    for (const c of [
      'git tag v2026.10.12',
      'git tag -a v1 -m x',
      'git tag -l',
      'git tag -d v1',
      'git push -u origin feat/x',
      'git push origin feat/demo',
      'git push --dry-run origin feat/demo',
      'git config push.followTags',
      'git config --get push.followTags',
      'git config push.followTags false',
      'git config --unset push.followTags',
      'git -c push.followTags=false push origin feat/demo',
      'git -c push.default=simple push origin feat/demo',
    ]) {
      allowed(onFeature, c);
    }
  });
  test('another repository is not judged', () => allowed(onFeature, `git -C "${other}" push --tags`));
});

describe('releases are never created by the assistant', () => {
  test('gh release writes are denied', () => {
    for (const c of [
      'gh release create v2026.10.12',
      'gh release create v1 --generate-notes',
      'gh release edit v1 --draft=false',
      'gh release delete v1 --yes',
      'gh release upload v1 file.zip',
      'gh release delete-asset v1 file.zip',
      'gh release',
      'gh release unknown-sub',
      'gh -R x/y release create v1',
      'gh --repo x/y release create v1',
      'GH_TOKEN=x gh release create v1',
      'echo ok && gh release create v1',
      'bash -c "gh release create v1"',
      'gh release "create" v1',
    ]) {
      denied(onFeature, c);
    }
  });
  test('gh api writes to releases are denied', () => {
    for (const c of [
      'gh api -X POST repos/o/r/releases',
      'gh api -X POST repos/o/r/releases -f tag_name=v1',
      'gh api -X PATCH repos/o/r/releases/1',
      'gh api --method=PATCH repos/o/r/releases/1 -F draft=false',
      'gh api -XDELETE repos/o/r/releases/1',
      'gh api repos/o/r/releases -f tag_name=v1',
      'gh api -X POST repos/o/r/releases/generate-notes',
      'gh api -X DELETE repos/o/r/releases/assets/5',
      'gh api -X POST https://uploads.github.com/repos/o/r/releases/1/assets?name=a.zip',
      'gh api -X POST /repos/o/r/releases',
      'gh api -X POST "repos/o/r/releases/$ID"',
      "gh api graphql -f query='mutation { createRelease(input: {}) { clientMutationId } }'",
    ]) {
      denied(onFeature, c);
    }
  });
  test('reading releases stays allowed', () => {
    for (const c of [
      'gh release list',
      'gh release view v1',
      'gh release view v1 --json tagName',
      'gh release download v1 -p "*.zip"',
      'gh api repos/o/r/releases',
      'gh api -X GET repos/o/r/releases/1',
      'gh api repos/o/r/releases/latest --jq .tag_name',
      'gh api graphql -f query=\'query { repository(owner: "o", name: "r") { releases(first: 1) { totalCount } } }\'',
    ]) {
      allowed(onFeature, c);
    }
  });
});

describe('rewriting pushed history', () => {
  test('amend, rebase, reset and filter-* are denied when HEAD is already on a remote', () => {
    for (const c of [
      'git commit --amend --no-edit',
      'git commit -a --amend -m "chore: x"',
      'git rebase main',
      'git rebase -i HEAD~2',
      'git reset --hard HEAD~1',
      'git reset --soft HEAD~1',
      'git reset --mixed HEAD~2',
      'git reset HEAD~1',
      'git reset --hard main',
      'git filter-branch --env-filter true',
      'git filter-repo --force',
    ]) {
      denied(pushed, c, /already pushed|rewrite/);
    }
  });
  test('the same operations are allowed on purely local commits', () => {
    allowed(local, 'git commit --amend --no-edit');
    allowed(local, 'git rebase main');
    allowed(local, 'git reset --soft HEAD~1');
    allowed(local, 'git reset --hard HEAD~1');
    allowed(local, 'git filter-branch --env-filter true');
  });
  test('harmless variants stay allowed even on pushed history', () => {
    allowed(pushed, 'git reset --hard');
    allowed(pushed, 'git reset --hard HEAD');
    allowed(pushed, 'git reset HEAD some-file.txt');
    allowed(pushed, 'git reset -- some-file.txt');
    allowed(pushed, 'git reset --hard feat/ahead'); // moving forward to a descendant
    allowed(pushed, 'git rebase --abort');
    allowed(pushed, 'git rebase --continue');
    allowed(pushed, 'git commit -m "chore: new commit"');
  });
  test('a repository without remotes has nothing pushed', () => {
    allowed(onFeature, 'git commit --amend --no-edit');
  });
});

describe('commit signing cannot be bypassed', () => {
  test('per-command bypasses are denied', () => {
    for (const c of [
      'git commit --no-gpg-sign -m x',
      'git commit -m x --no-gpg-sign',
      'git merge --no-gpg-sign main',
      'git rebase --no-gpg-sign main',
      'git cherry-pick --no-gpg-sign abc',
      'git -c commit.gpgsign=false commit -m x',
      'git -c commit.gpgsign=0 commit -m x',
      'git -c commit.gpgsign= commit -m x',
      'git -c tag.gpgsign=false tag v1',
      'git -c gpg.format=openpgp commit -m x',
      'git -c user.signingkey=/tmp/other commit -m x',
      'git -c gpg.ssh.program=/bin/true commit -m x',
      'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=commit.gpgsign GIT_CONFIG_VALUE_0=false git commit -m x',
      'env GIT_CONFIG_PARAMETERS="commit.gpgsign=false" git commit -m x',
      'export GIT_CONFIG_GLOBAL=/dev/null',
    ]) {
      denied(onFeature, c);
    }
  });
  test('turning signing off or editing the signing configuration is denied', () => {
    for (const c of [
      'git config commit.gpgsign false',
      'git config --local commit.gpgsign false',
      'git config --global commit.gpgsign false',
      'git config tag.gpgsign no',
      'git config --unset commit.gpgsign',
      'git config --unset-all tag.gpgsign',
      'git config set commit.gpgsign false',
      'git config unset commit.gpgsign',
      'git config --replace-all commit.gpgsign off',
      'git config gpg.format openpgp',
      'git config user.signingkey /tmp/other.pub',
      'git config gpg.ssh.allowedSignersFile /dev/null',
      'git config gpg.program true',
      'git config --unset user.signingkey',
    ]) {
      denied(onFeature, c, /signing/i);
    }
  });
  test('reading the signing configuration and switching signing on is allowed', () => {
    for (const c of [
      'git config commit.gpgsign',
      'git config --get commit.gpgsign',
      'git config --get user.signingkey',
      'git config --get gpg.format',
      'git config gpg.ssh.allowedSignersFile',
      'git config --local --get-all user.signingkey',
      'git config commit.gpgsign true',
      'git -c commit.gpgsign=true commit -m x',
      'git log --show-signature -1',
    ]) {
      allowed(onFeature, c);
    }
  });
  test('the signing setup script may write the signing configuration', () => {
    allowed(onFeature, 'git config user.signingkey /x.pub && tooling/scripts/setup-commit-signing.sh');
    allowed(onFeature, 'bash tooling/scripts/setup-commit-signing.sh');
    allowed(onFeature, 'tooling/scripts/setup-git-hooks.sh');
    allowed(onFeature, 'bash tooling/scripts/setup-git-hooks.sh');
  });
  test('even with the setup script, signing can not be switched off', () => {
    denied(onFeature, 'git config commit.gpgsign false && tooling/scripts/setup-commit-signing.sh', /signing/i);
    denied(onFeature, 'tooling/scripts/setup-commit-signing.sh && git commit --no-gpg-sign -m x', /signing/i);
  });
});

describe('repository and account settings', () => {
  test('gh api writes to settings, protection, rulesets, refs and keys are denied', () => {
    for (const c of [
      'gh api -X PATCH repos/x/y/branches/main/protection',
      'gh api --method PUT repos/x/y/branches/main/protection -f enforce_admins=false',
      'gh api --method=DELETE repos/x/y/branches/main/protection',
      'gh api -XPATCH repos/x/y/branches/main/protection',
      'gh api repos/x/y/branches/main/protection -X PATCH',
      'gh api repos/x/y/branches/main/protection --input body.json',
      'gh api repos/x/y/rulesets -f name=x',
      'gh api -X DELETE repos/x/y/rulesets/1',
      'gh api -X PUT repos/x/y/actions/permissions -F enabled=false',
      'gh api -X PUT repos/x/y/actions/secrets/NAME -f encrypted_value=x',
      'gh api -X PATCH repos/x/y -f allow_squash_merge=true',
      'gh api -X PATCH repos/{owner}/{repo} -f delete_branch_on_merge=false',
      'gh api -X POST repos/x/y/hooks -f name=web',
      'gh api -X PUT repos/x/y/collaborators/someone',
      'gh api -X PATCH repos/x/y/git/refs/heads/feat/demo -F force=true',
      'gh api -X PUT repos/x/y/pulls/5/merge -f merge_method=squash',
      'gh api -X POST user/ssh_signing_keys -f key=abc',
      'gh api -X DELETE user/ssh_signing_keys/1',
      'gh api -X POST user/keys -f key=abc',
      'gh api -X PATCH https://api.github.com/repos/x/y/branches/main/protection',
      "gh api graphql -f query='mutation { updateBranchProtectionRule(input: {}) { clientMutationId } }'",
      'gh api graphql -F query=@mutation.graphql',
      'gh api -X PATCH "repos/x/y/branches/$B/protection"',
      'gh api -X PATCH "$ENDPOINT"',
    ]) {
      denied(onFeature, c);
    }
  });
  test('reads and ordinary pull request / issue calls are allowed', () => {
    for (const c of [
      'gh api repos/x/y/branches/main/protection',
      'gh api -X GET repos/x/y/rulesets',
      'gh api repos/x/y/rulesets --jq ".[].name"',
      'gh api user/ssh_signing_keys',
      'gh api user/ssh_signing_keys --jq ".[].key"',
      'gh api repos/x/y/commits/abc --jq .commit.verification.verified',
      'gh api repos/x/y/pulls -f title=x -f head=feat/x -f base=main',
      'gh api repos/x/y/issues/1/comments -f body=hello',
      'gh api -X GET repos/x/y/pulls -f state=open',
      "gh api graphql -f query='query { viewer { login } }'",
    ]) {
      allowed(onFeature, c);
    }
  });
  test('gh subcommands that change settings or keys are denied', () => {
    for (const c of [
      'gh repo edit --delete-branch-on-merge=false',
      'gh repo delete x/y --yes',
      'gh repo rename new-name',
      'gh repo archive x/y',
      'gh repo deploy-key add key.pub',
      'gh secret set TOKEN',
      'gh variable set NAME',
      'gh workflow disable ci',
      'gh ssh-key add key.pub --type signing',
      'gh gpg-key delete 1',
      'gh auth token',
      'gh auth status --show-token',
    ]) {
      denied(onFeature, c);
    }
    for (const c of [
      'gh repo view',
      'gh repo clone x/y',
      'gh pr list',
      'gh pr view 3',
      'gh run list',
      'gh ssh-key list',
      'gh auth status',
      'gh secret list',
    ])
      allowed(onFeature, c);
  });
  test('curl / wget writes to the GitHub API are denied, reads are allowed', () => {
    denied(onFeature, 'curl -X PATCH https://api.github.com/repos/x/y -d "{}"');
    denied(onFeature, 'curl -XPUT https://api.github.com/repos/x/y/branches/main/protection');
    denied(onFeature, 'curl -d @body.json https://api.github.com/repos/x/y/rulesets');
    denied(onFeature, 'wget --method=DELETE https://api.github.com/repos/x/y');
    allowed(onFeature, 'curl https://api.github.com/repos/x/y');
    allowed(onFeature, 'curl -sS -X GET https://api.github.com/repos/x/y');
    allowed(onFeature, 'curl -d x https://example.com/hook');
  });

  test('a Host header naming the GitHub API counts, one naming another host does not', () => {
    denied(onFeature, 'curl -k -X DELETE -H "Host: api.github.com" https://140.82.112.6/repos/o/r');
    denied(onFeature, 'curl -XDELETE --header "host:api.github.com" https://1.2.3.4/repos/o/r');
    denied(onFeature, 'wget --method=DELETE "--header=Host: api.github.com" https://1.2.3.4/repos/o/r');
    denied(onFeature, 'http DELETE 1.2.3.4/repos/o/r Host:api.github.com');
    denied(onFeature, 'curl -X DELETE -H "Host: API.GitHub.com.:443" https://1.2.3.4/x');
    allowed(onFeature, 'curl -X DELETE -H "Host: example.com" https://1.2.3.4/x');
    allowed(onFeature, 'curl -X DELETE -H "Host: api.github.com.evil.example" https://1.2.3.4/x');
  });

  test('the GitHub API host is recognised in every spelling, and only the host', () => {
    for (const url of [
      'https://api.github.com/repos/x/y',
      'http://api.github.com/repos/x/y',
      'api.github.com/repos/x/y',
      'API.GitHub.COM/repos/x/y',
      'https://x@api.github.com/repos/x/y',
      'https://user:pw@api.github.com:443/repos/x/y', // gitleaks:allow
      'api.github.com:443/repos/x/y',
      'https://api.github.com',
      'api.github.com',
      '--url=https://api.github.com/repos/x/y',
    ]) {
      denied(onFeature, `curl -X DELETE ${url}`);
    }
    for (const url of [
      'https://evil.example/api.github.com',
      'https://api.github.com.evil.example/',
      'https://evil.example/?u=api.github.com',
      'https://api.github.com@evil.example/x',
      'https://notapi.github.com/x',
    ]) {
      allowed(onFeature, `curl -X DELETE ${url}`);
    }
  });
});

describe('gh pr merge', () => {
  test('only queued merge commits are allowed', () => {
    allowed(onFeature, 'gh pr merge 1 --auto --merge --delete-branch');
    allowed(onFeature, 'gh pr merge --auto --merge');
    allowed(onFeature, 'gh pr merge 1 -m --auto -d');
    allowed(onFeature, 'gh pr merge 1 --auto -md');
    allowed(onFeature, 'gh pr merge 1 --disable-auto');
  });
  test('squash and rebase are denied', () => {
    for (const c of [
      'gh pr merge 1 --squash',
      'gh pr merge 1 --auto --squash',
      'gh pr merge 1 --rebase --auto',
      'gh pr merge 1 -s --auto',
      'gh pr merge 1 --auto -sd',
      'gh pr merge 1 -r',
    ]) {
      denied(onFeature, c, /Squash and rebase/);
    }
  });
  test('a merge without --merge or without --auto is denied', () => {
    denied(onFeature, 'gh pr merge 1', /--merge/);
    denied(onFeature, 'gh pr merge 1 --auto', /--merge/);
    denied(onFeature, 'gh pr merge 1 --merge', /--auto/);
    denied(onFeature, 'gh pr merge 1 --merge --delete-branch', /--auto/);
  });
});

describe('nested and compound commands', () => {
  test('separators', () => {
    denied(onMain, 'echo hi && git commit -m x', /Direct commits/);
    denied(onMain, 'echo hi; git commit -m x', /Direct commits/);
    denied(onMain, 'false || git commit -m x', /Direct commits/);
    denied(onMain, 'echo hi | git commit -m x', /Direct commits/);
    denied(onMain, 'echo hi\ngit commit -m x', /Direct commits/);
    denied(onFeature, 'git status && git push origin main', /to main/);
  });
  test('shells, eval, substitutions, wrappers and env prefixes', () => {
    denied(onFeature, 'bash -c "git push origin HEAD:main"', /to main/);
    denied(onFeature, "sh -lc 'git commit --no-verify -m x'", /--no-verify/);
    denied(onFeature, 'eval "git push origin main"', /to main/);
    denied(onFeature, 'echo $(git push origin main)', /to main/);
    denied(onFeature, 'echo `git push origin main`', /to main/);
    denied(onFeature, 'sudo git push origin main', /to main/);
    denied(onFeature, 'FOO=1 git push origin main', /to main/);
    denied(onFeature, 'env FOO=1 git push origin main', /to main/);
    denied(onFeature, '/usr/bin/git push origin main', /to main/);
    denied(onFeature, 'if true; then git push origin main; fi', /to main/);
  });
  test('quoted separators do not split commands', () => {
    allowed(onFeature, 'git commit -m "a; b && c | d"');
  });
});

describe('commands that target another repository', () => {
  test('other repository on main is not judged by this repository', () => {
    allowed(onMain, `git -C "${other}" commit -m x`);
    allowed(onFeature, `git -C "${other}" commit -m x`);
    allowed(onMain, `cd "${other}" && git commit -m x`);
    allowed(onMain, `cd "${other}"; git push origin main`);
    allowed(onMain, `git -C "${other}" push origin main`);
    allowed(onMain, `git -C "${other}" merge feat/x`);
  });
  test('the process working directory / cwd field decides the default target', () => {
    allowed(onMain, 'git commit -m x', { cwd: other });
  });
  test('cd back into this repository is judged again', () => {
    denied(onMain, `cd "${other}" && git status && cd "${onMain}" && git commit -m x`, /Direct commits/);
  });
  test('a subshell cd does not leak out', () => {
    denied(onMain, `(cd "${other}" && git status); git commit -m x`, /Direct commits/);
  });
  test('relative -C chains resolve against the working directory', () => {
    allowed(onMain, 'git -C ../other-repo commit -m x');
    denied(onMain, 'git -C ../on-main commit -m x', /Direct commits/);
  });
  test('global config writes are never skipped', () => {
    denied(onFeature, `git -C "${other}" config --global core.hooksPath /dev/null`, /core\.hooksPath/);
  });
  test('rules still apply to this repository when other repositories are mentioned too', () => {
    denied(onMain, `git -C "${other}" status && git commit -m x`, /Direct commits/);
  });
  test('a directory that is not a git repository is skipped', () => {
    allowed(onMain, `git -C "${root}" commit -m x`);
  });
  test('an unknown directory is judged conservatively', () => {
    denied(onMain, 'cd "$SOMEWHERE" && git commit -m x', /Direct commits/);
    denied(onMain, 'cd /definitely/not/there && git commit -m x', /Direct commits/);
  });
  test('git worktrees of this repository share its rules', () => {
    const wt = path.join(root, 'wt-main');
    sh(onFeature, 'worktree', 'add', '-q', wt, 'main');
    denied(onFeature, `git -C "${wt}" commit -m x`, /Direct commits/);
    denied(onFeature, `cd "${wt}" && git commit -m x`, /Direct commits/);
  });
});

describe('shell-specific quoting of -C paths', () => {
  const WIN = process.platform === 'win32';
  const dec = (repo: string, tool: string, command: string): Decision => {
    const { stdout } = runGuardRaw(repo, JSON.stringify({ tool_name: tool, tool_input: { command } }));
    if (stdout.trim() === '') return { allowed: true };
    return { allowed: false, reason: JSON.parse(stdout).hookSpecificOutput.permissionDecisionReason };
  };
  const ok = (repo: string, tool: string, c: string) => assert.equal(dec(repo, tool, c).allowed, true, `${tool}: ${c}`);
  const no = (repo: string, tool: string, c: string, match?: RegExp) => {
    const d = dec(repo, tool, c);
    assert.equal(d.allowed, false, `${tool}: ${c}`);
    if (match) assert.match(d.reason as string, match, c);
  };
  let featWt: string; // worktree of onMain on a feature branch
  let mainWt: string; // worktree of onFeature on main
  before(() => {
    featWt = path.join(root, 'bs-feat-wt');
    sh(onMain, 'worktree', 'add', '-q', '-b', 'feat/bs-wt', featWt);
    mainWt = path.join(root, 'bs-main-wt');
    sh(onFeature, 'worktree', 'add', '-q', '--force', mainWt, 'main');
  });

  test('PowerShell: unquoted, single- and double-quoted native paths resolve', { skip: !WIN }, () => {
    ok(onMain, 'PowerShell', `git -C ${featWt} commit -m x`);
    ok(onMain, 'PowerShell', `git -C '${featWt}' commit -m x`);
    ok(onMain, 'PowerShell', `git -C "${featWt}" commit -m x`);
    no(onFeature, 'PowerShell', `git -C ${mainWt} commit -m x`, /Direct commits/);
    no(onFeature, 'PowerShell', `git -C '${mainWt}' commit -m x`, /Direct commits/);
    no(onFeature, 'PowerShell', `git -C "${mainWt}" commit -m x`, /Direct commits/);
  });
  test('Bash: single- and double-quoted native paths resolve', { skip: !WIN }, () => {
    ok(onMain, 'Bash', `git -C '${featWt}' commit -m x`);
    ok(onMain, 'Bash', `git -C "${featWt}" commit -m x`);
    no(onFeature, 'Bash', `git -C '${mainWt}' commit -m x`, /Direct commits/);
    no(onFeature, 'Bash', `git -C "${mainWt}" commit -m x`, /Direct commits/);
  });
  test('Bash: an unquoted backslash path is judged as bash passes it (fail closed)', () => {
    const bs = featWt.replace(/\//g, '\\');
    no(onMain, 'Bash', `git -C ${bs} commit -m x`, /Cannot resolve the git -C path.*forward-slash/);
    no(onMain, 'Bash', `git -C ${bs} push origin feat/x`, /Cannot resolve/);
    ok(onMain, 'Bash', `git -C ${bs} status`);
  });
  test('PowerShell: backtick escapes, backslash does not', () => {
    ok(onMain, 'PowerShell', `git -C ${featWt.replace(/ /g, '` ')} commit -m x`);
    no(onMain, 'PowerShell', 'git -C C:\\definitely\\not\\there commit -m x', /Cannot resolve/);
  });
  test('forward-slash paths work in both shells', () => {
    const fwd = featWt.replace(/\\/g, '/');
    ok(onMain, 'Bash', `git -C ${fwd} commit -m x`);
    ok(onMain, 'PowerShell', `git -C ${fwd} commit -m x`);
    no(onFeature, 'Bash', `git -C ${mainWt.replace(/\\/g, '/')} commit -m x`, /Direct commits/);
  });
});

describe('Actions runner and variable API', () => {
  test('writes are denied; reads are allowed', () => {
    for (const c of [
      'gh api -X POST repos/x/y/actions/runners/generate-jitconfig -f name=x',
      'gh api -X DELETE repos/x/y/actions/runners/5',
      'gh api -X POST repos/x/y/actions/runners/registration-token',
      'gh api -X PATCH repos/x/y/actions/variables/NAME -f value=1',
      'gh api -X POST repos/x/y/actions/variables -f name=A -f value=1',
    ]) {
      denied(onFeature, c);
    }
    allowed(onFeature, 'gh api repos/x/y/actions/runners --jq ".runners[].name"');
    allowed(onFeature, 'gh api repos/x/y/actions/variables');
  });
});

describe('fail closed', () => {
  test('malformed JSON is denied', () => {
    const { status, stdout } = runGuardRaw(onFeature, 'not json');
    assert.equal(status, 0);
    assert.equal(JSON.parse(stdout).hookSpecificOutput.permissionDecision, 'deny');
    assert.match(JSON.parse(stdout).hookSpecificOutput.permissionDecisionReason, /fail closed/);
  });
  test('empty stdin is denied', () => {
    const { stdout } = runGuardRaw(onFeature, '');
    assert.equal(JSON.parse(stdout).hookSpecificOutput.permissionDecision, 'deny');
  });
  test('a non-string command is denied', () => {
    const { stdout } = runGuardRaw(onFeature, JSON.stringify({ tool_input: { command: ['git', 'push'] } }));
    assert.equal(JSON.parse(stdout).hookSpecificOutput.permissionDecision, 'deny');
  });
  test('JSON that is not an object is denied', () => {
    const { stdout } = runGuardRaw(onFeature, '42');
    assert.equal(JSON.parse(stdout).hookSpecificOutput.permissionDecision, 'deny');
  });
  test('input without a command is allowed (other tools)', () => {
    const { status, stdout } = runGuardRaw(
      onFeature,
      JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'x' } }),
    );
    assert.equal(status, 0);
    assert.equal(stdout.trim(), '');
  });
  test('absurdly nested commands are denied rather than ignored', () => {
    let c = 'git push origin main';
    for (let i = 0; i < 12; i++) c = `bash -c ${JSON.stringify(c)}`;
    denied(onFeature, c);
  });
});
