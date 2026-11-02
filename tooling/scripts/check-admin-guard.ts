// Every entry point to the admin side checks the session itself (ADR 0003 rule 7); the proxy is never trusted. This
// check fails when one forgets the shared guard from src/server/auth/guard.ts:
//
//   node tooling/scripts/check-admin-guard.ts
//
// - src/app/[locale]/(admin)/**/page.* and layout.*: the default export must call guardPage().
// - src/app/**/route.*: every exported HTTP method must call guardHandler().
// - any file under src/ whose top level starts with the 'use server' directive: every export must await
//   guardAction() at the top level of the action, or at the top level of the callback it passes to runAction() (from
//   server/admin/form.ts) or to a wrapper in the same file that calls that callback.
// - a 'use server' directive inside a function fails everywhere: inline Server Actions are not allowed.
//
// Files with the extensions ts, tsx, js, jsx, mjs and cjs are scanned. The file is parsed with the TypeScript compiler
// API. A guard "is called" when the name comes from an import that resolves to src/server/auth/guard.ts (relative
// path, or the @/ alias for src/). For pages and handlers the call may sit anywhere inside the exported function. It
// does not follow calls into other functions or files, and it does not check that the call is reached on every path;
// review covers that. An export that is not a function declared in the same file (a re-export, `export *`, a
// destructured export, a class) can not be verified and fails too.
//
// Public entry points are listed below, each with the reason. An entry that is not listed has to call the guard.
//
// Exit codes: 0 ok, 1 a violation, 2 src/ is missing. Reads src/ below the working directory.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

type Kind = 'page' | 'handler' | 'action';

// The sign-in page is how a visitor gets a session, so it can not require one. The two password recovery pages are for
// a visitor who has lost the password, so they can not require one either.
const PUBLIC_PAGES: ReadonlySet<string> = new Set([
  'src/app/[locale]/(admin)/dashboard/sign-in/page.tsx',
  'src/app/[locale]/(admin)/dashboard/forgot-password/page.tsx',
  'src/app/[locale]/(admin)/dashboard/reset-password/page.tsx',
]);
// The Better Auth endpoints do their own session handling and rate limiting.
const PUBLIC_HANDLERS: ReadonlySet<string> = new Set([
  'src/app/api/auth/[...all]/route.ts',
  // Visitors without an account post the page they opened. It takes only a same-origin request with a known public
  // path, is rate limited and stores an anonymized address.
  'src/app/api/visits/route.ts',
]);
// The contact form is for visitors without an account. It protects itself with a honeypot, validation and a rate limit.
const PUBLIC_ACTIONS: ReadonlySet<string> = new Set([
  'src/server/contact/actions.ts',
  // How a visitor gets a session, so it can not require one. The auth layer does the rate limiting.
  'src/server/auth/sign-in-action.ts',
]);

const GUARD_NAME: Record<Kind, string> = { page: 'guardPage', handler: 'guardHandler', action: 'guardAction' };
const GUARD_MODULE = 'src/server/auth/guard.ts';
const FORM_MODULE = 'src/server/admin/form.ts';
const HTTP_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const EXT = '(?:[cm]?[jt]s|[jt]sx)';
const ADMIN_PAGE = new RegExp(`^src/app/\\[locale\\]/\\(admin\\)/(.+/)?(page|layout)\\.${EXT}$`);
const API_ROUTE = new RegExp(`^src/app/(.+/)?route\\.${EXT}$`);
const SOURCE_FILE = new RegExp(`\\.${EXT}$`);

type Export = { name: string; fn: ts.Node | undefined };

function parse(file: string, text: string): ts.SourceFile {
  const kind = /[jt]sx$/.test(file) ? ts.ScriptKind.TSX : /[cm]?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
}

function isFunction(node: ts.Node | undefined): node is ts.ArrowFunction | ts.FunctionExpression {
  return node !== undefined && (ts.isArrowFunction(node) || ts.isFunctionExpression(node));
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);
}

function hasUseServerDirective(sf: ts.SourceFile): boolean {
  for (const statement of sf.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) return false;
    if (statement.expression.text === 'use server') return true;
  }
  return false;
}

// The import specifier as a path from the project root, for relative paths and the @/ alias.
function resolveImport(file: string, specifier: string): string | undefined {
  if (specifier.startsWith('@/')) return `src/${specifier.slice(2)}`;
  if (!specifier.startsWith('.')) return undefined;
  return path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
}

// The names this file gave to one function of a module (import aliases included).
function importedNames(sf: ts.SourceFile, file: string, module: string, guard: string): Set<string> {
  const names = new Set<string>();
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (resolveImport(file, statement.moduleSpecifier.text) !== module) continue;
    const bindings = statement.importClause?.namedBindings;
    if (statement.importClause?.isTypeOnly || !bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if (!element.isTypeOnly && (element.propertyName ?? element.name).text === guard) names.add(element.name.text);
    }
  }
  return names;
}

function callsAny(node: ts.Node, names: ReadonlySet<string>): boolean {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text)) return true;
  return ts.forEachChild(node, (child) => (callsAny(child, names) ? true : undefined)) === true;
}

function isCallTo(node: ts.Node, names: ReadonlySet<string>): node is ts.CallExpression {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text);
}

// True when this expression is `await guard()`, or a runAction(callback) whose callback awaits the guard at its top level.
function awaitsGuard(expression: ts.Expression, guards: ReadonlySet<string>, runs: ReadonlySet<string>): boolean {
  let node: ts.Expression = expression;
  while (ts.isParenthesizedExpression(node)) node = node.expression;
  if (ts.isAwaitExpression(node)) {
    let inner: ts.Expression = node.expression;
    while (ts.isParenthesizedExpression(inner)) inner = inner.expression;
    return isCallTo(inner, guards) || awaitsGuard(inner, guards, runs);
  }
  if (isCallTo(node, runs)) {
    const callback = node.arguments[0];
    return isFunction(callback) && topLevelAwaitsGuard(callback, guards, runs);
  }
  return false;
}

function topLevelAwaitsGuard(fn: ts.Node, guards: ReadonlySet<string>, runs: ReadonlySet<string>): boolean {
  const body = (fn as ts.FunctionLikeDeclaration).body;
  if (!body) return false;
  return ts.isBlock(body) ? statementsAwaitGuard(body.statements, guards, runs) : awaitsGuard(body, guards, runs);
}

// A try block counts as top level: its first statements run before anything can throw past the guard.
function statementsAwaitGuard(
  statements: readonly ts.Statement[],
  guards: ReadonlySet<string>,
  runs: ReadonlySet<string>,
): boolean {
  return statements.some((statement) => {
    if (ts.isExpressionStatement(statement)) return awaitsGuard(statement.expression, guards, runs);
    if (ts.isReturnStatement(statement))
      return !!statement.expression && awaitsGuard(statement.expression, guards, runs);
    if (ts.isTryStatement(statement)) return statementsAwaitGuard(statement.tryBlock.statements, guards, runs);
    if (!ts.isVariableStatement(statement)) return false;
    return statement.declarationList.declarations.some(
      (declaration) => !!declaration.initializer && awaitsGuard(declaration.initializer, guards, runs),
    );
  });
}

function inlineServerDirectives(sf: ts.SourceFile): number {
  let count = 0;
  const visit = (node: ts.Node) => {
    const body = (node as ts.FunctionLikeDeclaration).body;
    if (body && ts.isBlock(body)) {
      for (const statement of body.statements) {
        if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
        if (statement.expression.text === 'use server') count++;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return count;
}

function localFunctions(sf: ts.SourceFile): Map<string, ts.Node> {
  const functions = new Map<string, ts.Node>();
  for (const statement of sf.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) functions.set(statement.name.text, statement);
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && isFunction(declaration.initializer)) {
        functions.set(declaration.name.text, declaration.initializer);
      }
    }
  }
  return functions;
}

// Functions declared in this file that call their first parameter, like `checked(work)` wrapping `await work()`.
function localRunners(sf: ts.SourceFile): Set<string> {
  const runners = new Set<string>();
  for (const [name, fn] of localFunctions(sf)) {
    const { parameters, body } = fn as ts.FunctionLikeDeclaration;
    const first = parameters[0]?.name;
    if (first && ts.isIdentifier(first) && body && callsAny(body, new Set([first.text]))) runners.add(name);
  }
  return runners;
}

function exportsOf(sf: ts.SourceFile): Export[] {
  const locals = localFunctions(sf);
  const exports: Export[] = [];
  for (const statement of sf.statements) {
    if (ts.isExportAssignment(statement)) {
      const fn = ts.isIdentifier(statement.expression)
        ? locals.get(statement.expression.text)
        : isFunction(statement.expression)
          ? statement.expression
          : undefined;
      exports.push({ name: 'default', fn });
    } else if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) continue;
      const clause = statement.exportClause;
      if (!clause || ts.isNamespaceExport(clause)) {
        exports.push({ name: clause ? clause.name.text : '*', fn: undefined });
        continue;
      }
      for (const element of clause.elements) {
        if (element.isTypeOnly) continue;
        const fn = statement.moduleSpecifier ? undefined : locals.get((element.propertyName ?? element.name).text);
        exports.push({ name: element.name.text, fn });
      }
    } else if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue;
      if (ts.isFunctionDeclaration(statement)) {
        exports.push({
          name: hasModifier(statement, ts.SyntaxKind.DefaultKeyword) ? 'default' : (statement.name?.text ?? ''),
          fn: statement,
        });
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          const name = ts.isIdentifier(declaration.name) ? declaration.name.text : '(destructured)';
          exports.push({ name, fn: isFunction(declaration.initializer) ? declaration.initializer : undefined });
        }
      } else {
        const named = statement as { name?: { text?: string } };
        exports.push({ name: named.name?.text ?? 'default', fn: undefined });
      }
    }
  }
  return exports;
}

function checkSource(kind: Kind, file: string, text: string): string[] {
  const sf = parse(file, text);
  const guard = GUARD_NAME[kind];
  const names = importedNames(sf, file, GUARD_MODULE, guard);
  const runs = new Set([...importedNames(sf, file, FORM_MODULE, 'runAction'), ...localRunners(sf)]);
  const wanted = (entry: Export) =>
    kind === 'action' ||
    (kind === 'page'
      ? entry.name === 'default'
      : HTTP_METHODS.has(entry.name) || entry.name === '*' || entry.name === '(destructured)');
  const targets = exportsOf(sf).filter(wanted);

  if (kind === 'page' && targets.length === 0) return [`${file}: no default export, so ${guard}() is never called`];
  return targets.flatMap((target) => {
    const label = target.name === 'default' ? 'the default export' : `the export ${target.name}`;
    if (!target.fn) {
      return [`${file}: ${label} is not a function declared in this file, so the check can not see it call ${guard}()`];
    }
    if (kind === 'action') {
      return topLevelAwaitsGuard(target.fn, names, runs)
        ? []
        : [`${file}: ${label} does not await ${guard}() from server/auth/guard.ts at the top level of the action`];
    }
    return callsAny(target.fn, names)
      ? []
      : [`${file}: ${label} does not call ${guard}() imported from server/auth/guard.ts`];
  });
}

function sourceFiles(dir: string, base: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory())
      return entry.name === 'node_modules' ? [] : sourceFiles(path.join(dir, entry.name), `${base}/${entry.name}`);
    return SOURCE_FILE.test(entry.name) && !entry.name.endsWith('.d.ts') ? [`${base}/${entry.name}`] : [];
  });
}

export function main(cwd: string = process.cwd()): number {
  if (!existsSync(path.join(cwd, 'src'))) {
    process.stderr.write('check-admin-guard: src/ is missing\n');
    return 2;
  }
  const problems: string[] = [];
  const checked: Record<Kind, number> = { page: 0, handler: 0, action: 0 };

  for (const file of sourceFiles(path.join(cwd, 'src'), 'src')) {
    const text = readFileSync(path.join(cwd, file), 'utf8');
    const kinds: Kind[] = [];
    if (ADMIN_PAGE.test(file) && !PUBLIC_PAGES.has(file)) kinds.push('page');
    if (API_ROUTE.test(file) && !PUBLIC_HANDLERS.has(file)) kinds.push('handler');
    if (text.includes('use server')) {
      const sf = parse(file, text);
      if (hasUseServerDirective(sf) && !PUBLIC_ACTIONS.has(file)) kinds.push('action');
      if (inlineServerDirectives(sf) > 0) {
        problems.push(`${file}: an inline 'use server' function is not allowed; put Server Actions in an actions file`);
      }
    }
    for (const kind of kinds) {
      checked[kind]++;
      problems.push(...checkSource(kind, file, text));
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) process.stderr.write(`${problem}\n`);
    process.stderr.write(`admin guard: ${problems.length} violation(s); see ADR 0003 rule 7\n`);
    return 1;
  }
  process.stdout.write(
    `admin guard: ${checked.page} page/layout files, ${checked.handler} route handlers and ${checked.action} Server Action files call the guard\n`,
  );
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
