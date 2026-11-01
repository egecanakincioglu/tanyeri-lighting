// Every entry point to the admin side checks the session itself (ADR 0003 rule 7); the proxy is never trusted. This
// check fails when one forgets the shared guard from src/server/auth/guard.ts:
//
//   node tooling/scripts/check-admin-guard.ts
//
// - src/app/[locale]/(admin)/**/page.tsx and layout.tsx: the default export must call guardPage().
// - src/app/api/**/route.ts: every exported HTTP method must call guardHandler().
// - any file under src/ whose top level starts with the 'use server' directive: every export must call guardAction().
//
// How it looks: the file is parsed with the TypeScript compiler API. A guard "is called" when the exported function,
// or something nested inside it, contains a call to the name imported from a module ending in auth/guard.ts.
// It does not follow calls into other functions or files, and it does not check that the result is used or that the
// call is reached on every path; review covers that. An export that is not a function declared in the same file
// (a re-export, `export *`, a class) can not be verified and fails too.
//
// Public entry points are listed below, each with the reason. An entry that is not listed has to call the guard.
//
// Exit codes: 0 ok, 1 a violation, 2 src/ is missing. Reads src/ below the working directory.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

type Kind = 'page' | 'handler' | 'action';

// The sign-in page is how a visitor gets a session, so it can not require one.
const PUBLIC_PAGES: ReadonlySet<string> = new Set(['src/app/[locale]/(admin)/dashboard/sign-in/page.tsx']);
// The Better Auth endpoints do their own session handling and rate limiting.
const PUBLIC_HANDLERS: ReadonlySet<string> = new Set(['src/app/api/auth/[...all]/route.ts']);
// The contact form is for visitors without an account. It protects itself with a honeypot, validation and a rate limit.
const PUBLIC_ACTIONS: ReadonlySet<string> = new Set(['src/server/contact/actions.ts']);

const GUARD_NAME: Record<Kind, string> = { page: 'guardPage', handler: 'guardHandler', action: 'guardAction' };
const GUARD_MODULE = /(^|\/)auth\/guard\.ts$/;
const HTTP_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const ADMIN_PAGE = /^src\/app\/\[locale\]\/\(admin\)\/(.+\/)?(page|layout)\.tsx$/;
const API_ROUTE = /^src\/app\/api\/(.+\/)?route\.ts$/;

type Export = { name: string; fn: ts.Node | undefined };

function parse(file: string, text: string): ts.SourceFile {
  const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
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

// The names this file gave to one function of the guard module (import aliases included).
function guardNames(sf: ts.SourceFile, guard: string): Set<string> {
  const names = new Set<string>();
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!GUARD_MODULE.test(statement.moduleSpecifier.text)) continue;
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
  const names = guardNames(sf, guard);
  const wanted = (entry: Export) =>
    kind === 'action' ||
    (kind === 'page' ? entry.name === 'default' : HTTP_METHODS.has(entry.name) || entry.name === '*');
  const targets = exportsOf(sf).filter(wanted);

  if (kind === 'page' && targets.length === 0) return [`${file}: no default export, so ${guard}() is never called`];
  return targets.flatMap((target) => {
    const label = target.name === 'default' ? 'the default export' : `the export ${target.name}`;
    if (!target.fn) {
      return [`${file}: ${label} is not a function declared in this file, so the check can not see it call ${guard}()`];
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
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [`${base}/${entry.name}`] : [];
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
    if (text.includes('use server') && hasUseServerDirective(parse(file, text)) && !PUBLIC_ACTIONS.has(file)) {
      kinds.push('action');
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
