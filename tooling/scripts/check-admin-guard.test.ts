// Tests for check-admin-guard.ts against temporary source trees.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { main } from './check-admin-guard.ts';

const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'admin-guard-'));
let counter = 0;
after(() => rmSync(root, { recursive: true, force: true }));

const PAGE = 'src/app/[locale]/(admin)/dashboard/page.tsx';
const LAYOUT = 'src/app/[locale]/(admin)/layout.tsx';
const SIGN_IN = 'src/app/[locale]/(admin)/dashboard/sign-in/page.tsx';
const ROUTE = 'src/app/api/media/route.ts';
const AUTH_ROUTE = 'src/app/api/auth/[...all]/route.ts';
const ACTIONS = 'src/server/media/actions.ts';

const GUARD = "import { guardPage } from '../../../../server/auth/guard.ts';\n";

type Result = { code: number; err: string };

function run(files: Record<string, string> | null): Result {
  const dir = path.join(root, String(counter++));
  mkdirSync(dir);
  for (const [file, contents] of Object.entries(files ?? {})) {
    const full = path.join(dir, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  if (files === null) return { code: main(dir), err: '' };
  let err = '';
  const write = process.stderr.write;
  const out = process.stdout.write;
  process.stderr.write = ((chunk: string) => ((err += chunk), true)) as typeof process.stderr.write;
  process.stdout.write = () => true;
  try {
    return { code: main(dir), err };
  } finally {
    process.stderr.write = write;
    process.stdout.write = out;
  }
}

function passes(files: Record<string, string>) {
  const { code, err } = run(files);
  assert.equal(code, 0, err);
}

function fails(files: Record<string, string>, ...messages: (string | RegExp)[]) {
  const { code, err } = run(files);
  assert.equal(code, 1, err);
  for (const message of messages) {
    assert.match(
      err,
      typeof message === 'string' ? new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : message,
    );
  }
}

describe('check-admin-guard', () => {
  test('a tree without admin entry points passes', () =>
    passes({ 'src/app/page.tsx': 'export default function P() {}' }));
  test('a missing src directory is exit code 2', () => assert.equal(run(null).code, 2));

  describe('admin pages and layouts', () => {
    test('a page that calls guardPage passes', () =>
      passes({
        [PAGE]: `${GUARD}export default async function Page({ params }) { await guardPage((await params).locale); return null; }`,
      }));

    test('a layout without the guard fails and is named', () =>
      fails({ [LAYOUT]: 'export default function Layout({ children }) { return children; }' }, LAYOUT, 'guardPage()'));

    test('a page without the guard fails', () =>
      fails({ [PAGE]: 'export default function Page() { return null; }' }, PAGE, 'the default export'));

    test('a page without a default export fails', () =>
      fails({ [PAGE]: `${GUARD}export const x = 1;` }, PAGE, 'no default export'));

    test('a nested page deep in the admin tree is checked', () =>
      fails(
        { 'src/app/[locale]/(admin)/dashboard/media/[id]/page.tsx': 'export default () => null;' },
        'media/[id]/page.tsx',
      ));

    test('a page outside the admin group is not checked', () =>
      passes({ 'src/app/[locale]/(site)/page.tsx': 'export default function P() { return null; }' }));

    test('the sign-in page is on the allowlist and needs no guard', () =>
      passes({ [SIGN_IN]: 'export default function SignIn() { return null; }' }));

    test('a page next to sign-in is not covered by the allowlist', () =>
      fails(
        { 'src/app/[locale]/(admin)/dashboard/sign-in/help/page.tsx': 'export default () => null;' },
        'help/page.tsx',
      ));

    test('an aliased import of the guard counts', () =>
      passes({
        [PAGE]:
          "import { guardPage as requireAdmin } from '../../../../server/auth/guard.ts';\nexport default async function P() { await requireAdmin('tr'); }",
      }));

    test('a default export by name counts when the function calls the guard', () =>
      passes({ [PAGE]: `${GUARD}async function Page() { await guardPage('tr'); }\nexport default Page;` }));

    test('a default arrow function counts when it calls the guard', () =>
      passes({ [PAGE]: `${GUARD}const Page = async () => { await guardPage('tr'); };\nexport default Page;` }));

    test('a default export that never calls the guard fails even when another function does', () =>
      fails(
        {
          [PAGE]: `${GUARD}async function helper() { await guardPage('tr'); }\nexport default function P() { return null; }`,
        },
        PAGE,
      ));

    test('a guardPage defined in the file itself does not count', () =>
      fails(
        {
          [PAGE]:
            'const guardPage = async (_: string) => {};\nexport default async function P() { await guardPage("tr"); }',
        },
        PAGE,
      ));

    test('a guardPage from another module does not count', () =>
      fails(
        {
          [PAGE]:
            "import { guardPage } from './other.ts';\nexport default async function P() { await guardPage('tr'); }",
        },
        PAGE,
      ));

    test('a type-only import of the guard does not count', () =>
      fails(
        {
          [PAGE]:
            "import type { guardPage } from '../../../../server/auth/guard.ts';\nexport default function P() { return null; }",
        },
        PAGE,
      ));

    test('another guard function does not count for a page', () =>
      fails(
        {
          [PAGE]:
            "import { guardAction } from '../../../../server/auth/guard.ts';\nexport default async function P() { await guardAction(); }",
        },
        'guardPage()',
      ));

    test('a re-exported default can not be verified and fails', () =>
      fails({ [PAGE]: "export { default } from './other.tsx';" }, PAGE, 'can not see'));
  });

  describe('route handlers', () => {
    const GUARD_H = "import { guardHandler } from '../../../server/auth/guard.ts';\n";

    test('handlers that all call guardHandler pass', () =>
      passes({
        [ROUTE]: `${GUARD_H}export async function GET() { const s = await guardHandler(); return s instanceof Response ? s : Response.json({}); }\nexport const POST = async () => { await guardHandler(); return new Response(); };`,
      }));

    test('a handler without the guard fails and is named', () =>
      fails(
        { [ROUTE]: 'export function GET() { return new Response(); }' },
        ROUTE,
        'the export GET',
        'guardHandler()',
      ));

    test('every method must call it: one unguarded method fails', () =>
      fails(
        {
          [ROUTE]: `${GUARD_H}export async function GET() { await guardHandler(); return new Response(); }\nexport function DELETE() { return new Response(); }`,
        },
        'the export DELETE',
      ));

    test('route config exports are not handlers', () =>
      passes({
        [ROUTE]: `${GUARD_H}export const dynamic = 'force-dynamic';\nexport async function GET() { await guardHandler(); return new Response(); }`,
      }));

    test('the Better Auth route is on the public allowlist', () =>
      passes({ [AUTH_ROUTE]: 'export function GET() { return new Response(); }' }));

    test('another route under api/auth is not covered by the allowlist', () =>
      fails(
        { 'src/app/api/auth/extra/route.ts': 'export function GET() { return new Response(); }' },
        'api/auth/extra/route.ts',
      ));

    test('a handler list re-exported from another file fails', () =>
      fails({ [ROUTE]: "export { GET, POST } from './handlers.ts';" }, 'the export GET', 'the export POST'));

    test('export * can hide handlers and fails', () =>
      fails({ [ROUTE]: "export * from './handlers.ts';" }, 'the export *'));

    test('a route file outside src/app/api is checked too', () =>
      fails({ 'src/app/feed/route.ts': 'export function GET() { return new Response(); }' }, 'feed/route.ts'));

    test('a route file under the admin group is checked', () =>
      fails({ 'src/app/[locale]/(admin)/dashboard/export/route.ts': 'export function GET() {}' }, 'export/route.ts'));

    test('a route.tsx file is checked', () =>
      fails({ 'src/app/api/y/route.tsx': 'export function GET() { return new Response(); }' }, 'api/y/route.tsx'));

    test('a destructured export can not be verified and fails', () =>
      fails({ [ROUTE]: 'const h = {};\nexport const { GET, POST } = h;' }, ROUTE, 'the export (destructured)'));

    test('a guard imported from another module than src/server/auth/guard.ts does not count', () =>
      fails(
        {
          [ROUTE]:
            "import { guardHandler } from './stub/auth/guard.ts';\nexport async function GET() { await guardHandler(); }",
        },
        'the export GET',
      ));
  });

  describe('Server Action files', () => {
    const GUARD_A = "import { guardAction } from '../auth/guard.ts';\n";

    test('every exported function calling guardAction passes', () =>
      passes({
        [ACTIONS]: `'use server';\n${GUARD_A}export async function save() { await guardAction(); }\nexport const remove = async () => { await guardAction(); };\nasync function reorder() { await guardAction(); }\nexport { reorder };`,
      }));

    test('an exported action without the guard fails and is named', () =>
      fails(
        { [ACTIONS]: "'use server';\nexport async function save() {}" },
        ACTIONS,
        'the export save',
        'guardAction()',
      ));

    test('one unguarded export among guarded ones fails', () =>
      fails(
        {
          [ACTIONS]: `'use server';\n${GUARD_A}export async function a() { await guardAction(); }\nexport const b = async () => {};`,
        },
        'the export b',
      ));

    test('a non-exported helper does not need the guard', () =>
      passes({
        [ACTIONS]: `'use server';\n${GUARD_A}function helper() {}\nexport async function a() { await guardAction(); helper(); }`,
      }));

    test('type exports are ignored', () =>
      passes({
        [ACTIONS]: `'use server';\n${GUARD_A}export type Result = { ok: boolean };\nexport interface Input { a: string }\nexport async function a() { await guardAction(); }`,
      }));

    test('the double-quoted directive after another directive counts', () =>
      fails({ [ACTIONS]: '"use strict";\n"use server";\nexport async function save() {}' }, 'the export save'));

    test('a re-exported action can not be verified and fails', () =>
      fails({ [ACTIONS]: "'use server';\nexport { save } from './other.ts';" }, 'the export save', 'can not see'));

    test('a file without the directive is not an action file', () =>
      passes({ [ACTIONS]: 'export async function save() {}' }));

    test('a directive after the first statement is not a directive', () =>
      passes({ [ACTIONS]: "import 'x';\n'use server';\nexport async function save() {}" }));

    test('the text use server inside a string is not a directive', () =>
      passes({ [ACTIONS]: "export const text = 'use server';\nexport async function save() {}" }));

    test('an action file is checked wherever it is under src', () =>
      fails(
        { 'src/app/[locale]/(site)/contact/actions.ts': "'use server';\nexport async function send() {}" },
        'contact/actions.ts',
      ));

    test('the public contact form action is on the allowlist and needs no guard', () =>
      passes({ 'src/server/contact/actions.ts': "'use server';\nexport async function submit() {}" }));

    test('another action file next to the contact form is not covered by the allowlist', () =>
      fails(
        { 'src/server/contact/admin-actions.ts': "'use server';\nexport async function remove() {}" },
        'contact/admin-actions.ts',
      ));

    const RUN = "import { runAction } from '../admin/form.ts';\n";

    test('a guard that sits in a closure which never runs fails', () =>
      fails(
        {
          [ACTIONS]: `'use server';
${GUARD_A}export async function act() { const never = () => guardAction(); return 'write'; }`,
        },
        'the export act',
      ));

    test('an unawaited guard call fails', () =>
      fails(
        {
          [ACTIONS]: `'use server';
${GUARD_A}export async function act() { guardAction(); }`,
        },
        'the export act',
      ));

    test('a stub guard module does not count for an action', () =>
      fails(
        {
          [ACTIONS]:
            "'use server';\nimport { guardAction } from './stub/auth/guard.ts';\nexport async function act() { await guardAction(); }",
        },
        'the export act',
      ));

    test('an awaited guard inside the runAction callback passes', () =>
      passes({
        [ACTIONS]: `'use server';
${GUARD_A}${RUN}export async function act() { return runAction(async () => { await guardAction(); }); }`,
      }));

    test('the guard inside a try block at the top level passes', () =>
      passes({
        [ACTIONS]: `'use server';
${GUARD_A}export async function act() { try { await guardAction(); } catch {} }`,
      }));

    test('an unawaited guard inside the runAction callback fails', () =>
      fails(
        {
          [ACTIONS]: `'use server';
${GUARD_A}${RUN}export async function act() { return runAction(async () => { guardAction(); }); }`,
        },
        'the export act',
      ));

    test('a runAction that is not the one from admin/form.ts does not count', () =>
      fails(
        {
          [ACTIONS]: `'use server';
${GUARD_A}function runAction(f) {}
export async function act() { return runAction(async () => { await guardAction(); }); }`,
        },
        'the export act',
      ));

    test('a wrapper in the same file that calls its callback counts like runAction', () =>
      passes({
        [ACTIONS]: `'use server';\n${GUARD_A}async function checked(work) { return await work(); }\nexport async function act() { return checked(async () => { await guardAction(); }); }`,
      }));

    test('an inline use server function fails, also in a page', () =>
      fails(
        {
          'src/app/feed/page.tsx':
            "export default function P() { async function del() { 'use server'; } return null; }",
        },
        'feed/page.tsx',
        "inline 'use server'",
      ));

    test('javascript files are scanned: .js and .mjs actions and routes', () =>
      fails(
        {
          'src/server/a.js': "'use server';\nexport async function act() {}",
          'src/server/b.mjs': "'use server';\nexport async function act() {}",
          'src/app/api/z/route.mjs': 'export function GET() {}',
        },
        'a.js',
        'b.mjs',
        'route.mjs',
      ));

    test('a page.ts under the admin group is checked', () =>
      fails(
        { 'src/app/[locale]/(admin)/dashboard/page.ts': 'export default function P() { return null; }' },
        'page.ts',
      ));

    test('a tsx action file is checked too', () =>
      fails(
        { 'src/components/form.tsx': "'use server';\nexport async function send() { return <p />; }" },
        'form.tsx',
      ));
  });

  test('every violation of a tree is reported in one run', () => {
    fails(
      {
        [PAGE]: 'export default () => null;',
        [ROUTE]: 'export function GET() { return new Response(); }',
        [ACTIONS]: "'use server';\nexport async function save() {}",
      },
      PAGE,
      ROUTE,
      ACTIONS,
      '3 violation(s)',
    );
  });

  test('the repository itself passes', () => {
    const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    assert.equal(main(repo), 0);
  });

  test('the command line exits 1 on a violation and 0 on a clean tree', () => {
    const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'check-admin-guard.ts');
    const spawn = (files: Record<string, string>) => {
      const dir = path.join(root, `cli-${counter++}`);
      for (const [file, contents] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        writeFileSync(path.join(dir, file), contents);
      }
      return spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' });
    };
    const bad = spawn({ [PAGE]: 'export default () => null;' });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /dashboard\/page\.tsx: the default export does not call guardPage\(\)/);
    const good = spawn({ 'src/app/page.tsx': 'export default () => null;' });
    assert.equal(good.status, 0);
    assert.match(good.stdout, /admin guard: 0 page\/layout files/);
  });
});
