import { generate } from '@babel/generator';
import { parse, type ParserPlugin } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import path from 'node:path';

import type {
  SourceIntegrationOptions,
  SourceIntegrationResult,
} from '@/integrations/integration.types.js';

type ComponentFunction =
  t.ArrowFunctionExpression | t.ClassMethod | t.FunctionDeclaration | t.FunctionExpression;

type BabelTraverse = typeof traverseModule.default;

const traverseCandidate = traverseModule as unknown as BabelTraverse | { default: BabelTraverse };
const traverse =
  typeof traverseCandidate === 'function' ? traverseCandidate : traverseCandidate.default;

function parserPlugins(filePath: string): ParserPlugin[] {
  const extension = path.extname(filePath);
  const plugins: ParserPlugin[] = ['jsx', 'decorators-legacy'];

  if (extension === '.ts' || extension === '.tsx') {
    plugins.push('typescript');
  } else {
    plugins.push('flow', 'flowComments');
  }

  return plugins;
}

function findVariableComponent(program: t.Program, name: string): ComponentFunction | undefined {
  for (const statement of program.body) {
    if (t.isFunctionDeclaration(statement) && statement.id?.name === name) {
      return statement;
    }

    if (t.isClassDeclaration(statement) && statement.id?.name === name) {
      return statement.body.body.find(
        (member): member is t.ClassMethod =>
          t.isClassMethod(member) && t.isIdentifier(member.key, { name: 'render' }),
      );
    }

    if (!t.isVariableDeclaration(statement)) {
      continue;
    }

    for (const declaration of statement.declarations) {
      if (
        t.isIdentifier(declaration.id, { name }) &&
        (t.isArrowFunctionExpression(declaration.init) || t.isFunctionExpression(declaration.init))
      ) {
        return declaration.init;
      }
    }
  }

  return undefined;
}

function findDefaultComponent(program: t.Program): ComponentFunction | undefined {
  const exportDefault = program.body.find(t.isExportDefaultDeclaration);

  if (exportDefault === undefined) {
    return undefined;
  }

  const declaration = exportDefault.declaration;
  if (t.isFunctionDeclaration(declaration)) {
    return declaration;
  }

  if (t.isClassDeclaration(declaration)) {
    return declaration.body.body.find(
      (member): member is t.ClassMethod =>
        t.isClassMethod(member) && t.isIdentifier(member.key, { name: 'render' }),
    );
  }

  if (t.isArrowFunctionExpression(declaration) || t.isFunctionExpression(declaration)) {
    return declaration;
  }

  return t.isIdentifier(declaration) ? findVariableComponent(program, declaration.name) : undefined;
}

function jsxName(name: string): t.JSXIdentifier {
  return t.jsxIdentifier(name);
}

function componentElement(name: string): t.JSXElement {
  return t.jsxElement(t.jsxOpeningElement(jsxName(name), [], true), null, [], true);
}

function isWrappedWith(expression: t.Expression, componentName: string): boolean {
  return (
    t.isJSXElement(expression) &&
    t.isJSXIdentifier(expression.openingElement.name, { name: componentName })
  );
}

function wrapExpression(expression: t.Expression, componentName: string): t.JSXElement {
  const child =
    t.isJSXElement(expression) || t.isJSXFragment(expression)
      ? expression
      : t.jsxExpressionContainer(expression);

  return t.jsxElement(
    t.jsxOpeningElement(jsxName(componentName), [], false),
    t.jsxClosingElement(jsxName(componentName)),
    [child],
    false,
  );
}

function updateRootExpression(
  expression: t.Expression,
  options: SourceIntegrationOptions,
): { expression: t.Expression; changed: boolean } {
  if (options.replaceRootWith !== undefined) {
    return isWrappedWith(expression, options.replaceRootWith)
      ? { expression, changed: false }
      : { expression: componentElement(options.replaceRootWith), changed: true };
  }

  if (options.wrapRootWith !== undefined && !isWrappedWith(expression, options.wrapRootWith)) {
    return { expression: wrapExpression(expression, options.wrapRootWith), changed: true };
  }

  return { expression, changed: false };
}

function transformComponentRoot(
  ast: t.File,
  component: ComponentFunction,
  options: SourceIntegrationOptions,
): { applied: boolean; changed: boolean } {
  let foundRenderableRoot = false;
  let changed = false;

  if (t.isArrowFunctionExpression(component) && !t.isBlockStatement(component.body)) {
    const update = updateRootExpression(component.body, options);
    component.body = update.expression;
    return { applied: true, changed: update.changed };
  }

  traverse(ast, {
    ReturnStatement(returnPath) {
      if (returnPath.getFunctionParent()?.node !== component) {
        return;
      }

      const argument = returnPath.node.argument;
      if (
        argument === null ||
        (!t.isJSXElement(argument) &&
          !t.isJSXFragment(argument) &&
          !t.isConditionalExpression(argument))
      ) {
        return;
      }

      foundRenderableRoot = true;
      const update = updateRootExpression(argument, options);
      returnPath.node.argument = update.expression;
      changed ||= update.changed;
    },
  });

  return { applied: foundRenderableRoot, changed };
}

function ensureSideEffectImport(program: t.Program, source: string): boolean {
  if (
    program.body.some(
      (statement) => t.isImportDeclaration(statement) && statement.source.value === source,
    )
  ) {
    return false;
  }

  program.body.unshift(t.importDeclaration([], t.stringLiteral(source)));
  return true;
}

function ensureNamedImport(program: t.Program, source: string, imported: string): boolean {
  const matchingImport = program.body.find(
    (statement): statement is t.ImportDeclaration =>
      t.isImportDeclaration(statement) && statement.source.value === source,
  );

  if (
    matchingImport?.specifiers.some(
      (specifier) =>
        t.isImportSpecifier(specifier) &&
        t.isIdentifier(specifier.imported, { name: imported }) &&
        t.isIdentifier(specifier.local, { name: imported }),
    ) === true
  ) {
    return false;
  }

  const specifier = t.importSpecifier(t.identifier(imported), t.identifier(imported));
  if (
    matchingImport !== undefined &&
    matchingImport.specifiers.every((existing) => !t.isImportNamespaceSpecifier(existing))
  ) {
    matchingImport.specifiers.push(specifier);
    return true;
  }

  program.body.unshift(t.importDeclaration([specifier], t.stringLiteral(source)));
  return true;
}

export function relativeModuleImport(fromFile: string, targetPath: string): string {
  const relative = path.posix.relative(path.posix.dirname(fromFile), targetPath);
  return relative.startsWith('.') ? relative : `./${relative}`;
}

export function integrateApplicationSource(
  filePath: string,
  source: string,
  options: SourceIntegrationOptions,
): SourceIntegrationResult {
  const ast = parse(source, {
    sourceType: 'unambiguous',
    plugins: parserPlugins(filePath),
  });
  const requiresRootTransform =
    options.replaceRootWith !== undefined || options.wrapRootWith !== undefined;
  const component = requiresRootTransform ? findDefaultComponent(ast.program) : undefined;
  let changed = false;

  if (requiresRootTransform && component === undefined) {
    return { content: source, applied: false };
  }

  if (component !== undefined) {
    const rootResult = transformComponentRoot(ast, component, options);
    if (!rootResult.applied) {
      return { content: source, applied: false };
    }
    changed ||= rootResult.changed;
  }

  for (const namedImport of [...options.namedImports].reverse()) {
    const importChanged = ensureNamedImport(ast.program, namedImport.source, namedImport.imported);
    changed = importChanged || changed;
  }

  for (const sideEffectImport of [...options.sideEffectImports].reverse()) {
    const importChanged = ensureSideEffectImport(ast.program, sideEffectImport);
    changed = importChanged || changed;
  }

  return {
    content: changed ? `${generate(ast, { comments: true }, source).code}\n` : source,
    applied: true,
  };
}
