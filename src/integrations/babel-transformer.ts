import { generate } from '@babel/generator';
import { parse } from '@babel/parser';
import * as t from '@babel/types';

import type {
  BabelIntegrationOptions,
  SourceIntegrationResult,
} from '@/integrations/integration.types.js';

function returnedObject(
  expression: t.Expression | t.FunctionDeclaration,
): t.ObjectExpression | undefined {
  if (t.isObjectExpression(expression)) {
    return expression;
  }

  if (t.isArrowFunctionExpression(expression) && t.isObjectExpression(expression.body)) {
    return expression.body;
  }

  if (
    !t.isArrowFunctionExpression(expression) &&
    !t.isFunctionExpression(expression) &&
    !t.isFunctionDeclaration(expression)
  ) {
    return undefined;
  }

  if (!t.isBlockStatement(expression.body)) {
    return undefined;
  }

  for (const statement of expression.body.body) {
    if (t.isReturnStatement(statement) && t.isObjectExpression(statement.argument)) {
      return statement.argument;
    }
  }

  return undefined;
}

function isModuleExports(node: t.LVal | t.OptionalMemberExpression): boolean {
  return (
    t.isMemberExpression(node) &&
    !node.computed &&
    t.isIdentifier(node.object, { name: 'module' }) &&
    t.isIdentifier(node.property, { name: 'exports' })
  );
}

function findConfigObject(program: t.Program): t.ObjectExpression | undefined {
  for (const statement of program.body) {
    if (t.isExportDefaultDeclaration(statement)) {
      const declaration = statement.declaration;
      if (
        t.isObjectExpression(declaration) ||
        t.isArrowFunctionExpression(declaration) ||
        t.isFunctionExpression(declaration) ||
        t.isFunctionDeclaration(declaration)
      ) {
        return returnedObject(declaration);
      }
    }

    if (!t.isExpressionStatement(statement) || !t.isAssignmentExpression(statement.expression)) {
      continue;
    }

    const assignment = statement.expression;
    if (!isModuleExports(assignment.left)) {
      continue;
    }

    if (
      t.isObjectExpression(assignment.right) ||
      t.isArrowFunctionExpression(assignment.right) ||
      t.isFunctionExpression(assignment.right)
    ) {
      return returnedObject(assignment.right);
    }
  }

  return undefined;
}

function namedProperty(object: t.ObjectExpression, name: string): t.ObjectProperty | undefined {
  return object.properties.find(
    (property): property is t.ObjectProperty =>
      t.isObjectProperty(property) &&
      ((t.isIdentifier(property.key) && property.key.name === name) ||
        (t.isStringLiteral(property.key) && property.key.value === name)),
  );
}

function ensureStringArrayEntry(
  object: t.ObjectExpression,
  propertyName: string,
  value: string,
): boolean | undefined {
  const property = namedProperty(object, propertyName);

  if (property === undefined) {
    object.properties.push(
      t.objectProperty(t.identifier(propertyName), t.arrayExpression([t.stringLiteral(value)])),
    );
    return true;
  }

  if (!t.isArrayExpression(property.value)) {
    return undefined;
  }

  if (property.value.elements.some((element) => t.isStringLiteral(element, { value }))) {
    return false;
  }

  property.value.elements.push(t.stringLiteral(value));
  return true;
}

function isPluginEntry(element: t.Expression | t.SpreadElement | null, name: string): boolean {
  if (t.isStringLiteral(element, { value: name })) {
    return true;
  }

  return t.isArrayExpression(element) && t.isStringLiteral(element.elements[0], { value: name });
}

function ensureUnistylesPlugin(object: t.ObjectExpression, root: string): boolean | undefined {
  const property = namedProperty(object, 'plugins');
  const entry = t.arrayExpression([
    t.stringLiteral('react-native-unistyles/plugin'),
    t.objectExpression([t.objectProperty(t.identifier('root'), t.stringLiteral(root))]),
  ]);

  if (property === undefined) {
    object.properties.push(t.objectProperty(t.identifier('plugins'), t.arrayExpression([entry])));
    return true;
  }

  if (!t.isArrayExpression(property.value)) {
    return undefined;
  }

  if (
    property.value.elements.some((element) =>
      isPluginEntry(element, 'react-native-unistyles/plugin'),
    )
  ) {
    return false;
  }

  property.value.elements.push(entry);
  return true;
}

export function createBabelConfig(
  projectKind: 'expo' | 'react-native',
  options: BabelIntegrationOptions,
): string {
  const result = integrateBabelConfig(
    `module.exports = function (api) {\n  api.cache(true);\n  return {};\n};\n`,
    {
      ...options,
      preset:
        options.preset ??
        (projectKind === 'expo' ? 'babel-preset-expo' : 'module:@react-native/babel-preset'),
    },
  );

  if (!result.applied) {
    throw new Error('Could not create the Babel configuration.');
  }

  return result.content;
}

export function integrateBabelConfig(
  source: string,
  options: BabelIntegrationOptions,
): SourceIntegrationResult {
  const ast = parse(source, {
    sourceType: 'unambiguous',
    plugins: ['typescript'],
  });
  const config = findConfigObject(ast.program);

  if (config === undefined) {
    return { content: source, applied: false };
  }

  let changed = false;

  if (options.preset !== undefined) {
    const presetResult = ensureStringArrayEntry(config, 'presets', options.preset);
    if (presetResult === undefined) {
      return { content: source, applied: false };
    }
    changed ||= presetResult;
  }

  if (options.unistylesRoot !== undefined) {
    const pluginResult = ensureUnistylesPlugin(config, options.unistylesRoot);
    if (pluginResult === undefined) {
      return { content: source, applied: false };
    }
    changed ||= pluginResult;
  }

  return {
    content: changed ? `${generate(ast, { comments: true }, source).code}\n` : source,
    applied: true,
  };
}
