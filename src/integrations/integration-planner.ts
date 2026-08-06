import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { createBabelConfig, integrateBabelConfig } from '@/integrations/babel-transformer.js';
import type {
  IntegrationChange,
  IntegrationPlan,
  IntegrationPlannerOptions,
  SourceIntegrationOptions,
} from '@/integrations/integration.types.js';
import { expoPluginName, isJsonRecord, renderJson } from '@/integrations/json-transformer.js';
import {
  integrateApplicationSource,
  relativeModuleImport,
} from '@/integrations/source-transformer.js';
import type { StackModuleName } from '@/modules/stack-module.types.js';

const APP_ENTRY_CANDIDATES = [
  'App.tsx',
  'App.jsx',
  'App.ts',
  'App.js',
  'src/App.tsx',
  'src/App.jsx',
  'src/App.ts',
  'src/App.js',
] as const;
const EXPO_ROUTER_LAYOUT_CANDIDATES = [
  'src/app/_layout.tsx',
  'src/app/_layout.jsx',
  'src/app/_layout.ts',
  'src/app/_layout.js',
  'app/_layout.tsx',
  'app/_layout.jsx',
  'app/_layout.ts',
  'app/_layout.js',
] as const;
const BABEL_CONFIG_CANDIDATES = [
  'babel.config.js',
  'babel.config.cjs',
  'babel.config.mjs',
  'babel.config.ts',
] as const;

const ROOT_NAVIGATION_STEP = 'Render RootNavigator from the application entry point.';
const QUERY_PROVIDER_STEP = 'Wrap the application root with AppProviders.';
const I18N_IMPORT_STEP = 'Import src/i18n/config.ts before the application renders.';
const UNISTYLES_IMPORT_STEP = 'Import src/theme/unistyles.ts before any StyleSheet.create call.';
const UNISTYLES_BABEL_STEP =
  "Add ['react-native-unistyles/plugin', { root: 'src' }] to babel.config.js.";
const EXPO_ROUTER_MAIN_STEP = "Set package.json main to 'expo-router/entry'.";
const EXPO_ROUTER_CONFIG_STEP =
  'Add a deep-linking scheme and enable experiments.typedRoutes in the Expo app config.';
const EXPO_ROUTER_BABEL_STEP =
  "Ensure babel.config.js uses the 'babel-preset-expo' preset when the file exists.";

async function existingPath(
  root: string,
  candidates: readonly string[],
): Promise<string | undefined> {
  for (const candidate of candidates) {
    try {
      await access(path.join(root, candidate));
      return candidate;
    } catch {
      continue;
    }
  }

  return undefined;
}

function addChange(changes: IntegrationChange[], change: IntegrationChange): void {
  const existing = changes.find(({ path: filePath }) => filePath === change.path);

  if (existing === undefined) {
    changes.push(change);
    return;
  }

  existing.content = change.content;
  existing.descriptions = [...new Set([...existing.descriptions, ...change.descriptions])];
  existing.requestedBy = [...new Set([...existing.requestedBy, ...change.requestedBy])];
}

function addHandled(handled: Set<string>, ...steps: string[]): void {
  steps.forEach((step) => handled.add(step));
}

function applicationDescriptions(
  selectedModules: ReadonlySet<StackModuleName>,
  replaceRoot: boolean,
): string[] {
  return [
    ...(replaceRoot ? ['Render RootNavigator'] : []),
    ...(selectedModules.has('tanstack-query') && !replaceRoot
      ? ['Wrap the root with AppProviders']
      : []),
    ...(selectedModules.has('i18n') && !replaceRoot ? ['Import the i18n configuration'] : []),
    ...(selectedModules.has('unistyles') && !replaceRoot
      ? ['Import the Unistyles configuration']
      : []),
  ];
}

function applicationRequestedBy(
  selectedModules: ReadonlySet<StackModuleName>,
  replaceRoot: boolean,
): StackModuleName[] {
  return [
    ...(replaceRoot ? (['navigation'] as const) : []),
    ...(!replaceRoot && selectedModules.has('tanstack-query') ? (['tanstack-query'] as const) : []),
    ...(!replaceRoot && selectedModules.has('i18n') ? (['i18n'] as const) : []),
    ...(!replaceRoot && selectedModules.has('unistyles') ? (['unistyles'] as const) : []),
  ];
}

async function planApplicationEntry(
  options: IntegrationPlannerOptions,
  changes: IntegrationChange[],
  handled: Set<string>,
  warnings: string[],
): Promise<void> {
  const selectedModules = new Set(options.selectedModules);
  const generatedNavigation = options.navigation !== undefined && options.navigation !== 'keep';

  if (generatedNavigation && options.navigation === 'expo-router') {
    if (selectedModules.has('tanstack-query')) addHandled(handled, QUERY_PROVIDER_STEP);
    if (selectedModules.has('i18n')) addHandled(handled, I18N_IMPORT_STEP);
    if (selectedModules.has('unistyles')) addHandled(handled, UNISTYLES_IMPORT_STEP);
    return;
  }

  const existingExpoRouter =
    options.navigation === 'keep' &&
    options.project.kind === 'expo' &&
    (options.existingNavigation?.primary === 'expo-router' ||
      (options.existingNavigation?.primary === undefined &&
        options.existingNavigation?.libraries.length === 1 &&
        options.existingNavigation.libraries[0] === 'expo-router'));
  const replaceRoot = generatedNavigation && options.navigation === 'react-navigation';
  const needsFoundationIntegration =
    selectedModules.has('tanstack-query') ||
    selectedModules.has('i18n') ||
    selectedModules.has('unistyles');

  if (!replaceRoot && !needsFoundationIntegration) {
    return;
  }

  const candidates = existingExpoRouter ? EXPO_ROUTER_LAYOUT_CANDIDATES : APP_ENTRY_CANDIDATES;
  const entryPath = await existingPath(options.project.root, candidates);

  if (entryPath === undefined) {
    warnings.push(
      existingExpoRouter
        ? 'Could not find an Expo Router root layout to integrate automatically.'
        : 'Could not find App.tsx, App.jsx, App.ts, or App.js to integrate automatically.',
    );
    return;
  }

  const before = await readFile(path.join(options.project.root, entryPath), 'utf8');
  const sourceOptions: SourceIntegrationOptions = {
    sideEffectImports: [],
    namedImports: [],
    ...(replaceRoot ? { replaceRootWith: 'RootNavigator' } : {}),
    ...(!replaceRoot && selectedModules.has('tanstack-query')
      ? { wrapRootWith: 'AppProviders' }
      : {}),
  };

  if (replaceRoot) {
    sourceOptions.namedImports.push({
      source: relativeModuleImport(entryPath, 'src/navigation'),
      imported: 'RootNavigator',
    });
  } else {
    if (selectedModules.has('tanstack-query')) {
      sourceOptions.namedImports.push({
        source: relativeModuleImport(entryPath, 'src/providers'),
        imported: 'AppProviders',
      });
    }
    if (selectedModules.has('i18n')) {
      sourceOptions.sideEffectImports.push(relativeModuleImport(entryPath, 'src/i18n/config'));
    }
    if (selectedModules.has('unistyles')) {
      sourceOptions.sideEffectImports.push(relativeModuleImport(entryPath, 'src/theme/unistyles'));
    }
  }

  try {
    const result = integrateApplicationSource(entryPath, before, sourceOptions);
    if (!result.applied) {
      warnings.push(`Could not safely identify the default root component in ${entryPath}.`);
      return;
    }

    addChange(changes, {
      path: entryPath,
      before,
      content: result.content,
      descriptions: applicationDescriptions(selectedModules, replaceRoot),
      requestedBy: applicationRequestedBy(selectedModules, replaceRoot),
    });

    if (replaceRoot) addHandled(handled, ROOT_NAVIGATION_STEP);
    if (!replaceRoot && selectedModules.has('tanstack-query')) {
      addHandled(handled, QUERY_PROVIDER_STEP);
    }
    if (!replaceRoot && selectedModules.has('i18n')) addHandled(handled, I18N_IMPORT_STEP);
    if (!replaceRoot && selectedModules.has('unistyles')) {
      addHandled(handled, UNISTYLES_IMPORT_STEP);
    }
  } catch (error) {
    warnings.push(
      `Could not parse ${entryPath} for automatic integration: ${(error as Error).message}`,
    );
  }
}

async function planExpoRouterPackage(
  options: IntegrationPlannerOptions,
  changes: IntegrationChange[],
  handled: Set<string>,
): Promise<void> {
  if (options.navigation !== 'expo-router') {
    return;
  }

  const before = await readFile(options.project.packageJsonPath, 'utf8');
  const parsed: unknown = JSON.parse(before);
  if (!isJsonRecord(parsed)) {
    return;
  }

  const changed = parsed.main !== 'expo-router/entry';
  parsed.main = 'expo-router/entry';
  addChange(changes, {
    path: path.relative(options.project.root, options.project.packageJsonPath),
    before,
    content: changed ? renderJson(before, parsed) : before,
    descriptions: ['Set the Expo Router entry point'],
    requestedBy: ['navigation'],
  });
  addHandled(handled, EXPO_ROUTER_MAIN_STEP);
}

function projectScheme(name: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
  return normalized.length === 0 ? 'app' : normalized;
}

async function planExpoRouterAppConfig(
  options: IntegrationPlannerOptions,
  changes: IntegrationChange[],
  handled: Set<string>,
  warnings: string[],
): Promise<void> {
  if (options.navigation !== 'expo-router') {
    return;
  }

  const appJsonPath = path.join(options.project.root, 'app.json');
  let before: string;
  try {
    before = await readFile(appJsonPath, 'utf8');
  } catch {
    warnings.push(
      'No app.json was found; configure the Expo Router plugin, scheme, and typed routes manually in the Expo app config.',
    );
    return;
  }

  try {
    const parsed: unknown = JSON.parse(before);
    if (!isJsonRecord(parsed)) {
      throw new TypeError('app.json must contain an object');
    }

    let changed = false;
    const expo = isJsonRecord(parsed.expo) ? parsed.expo : {};
    changed ||= !isJsonRecord(parsed.expo);
    parsed.expo = expo;
    if (expo.scheme === undefined) {
      expo.scheme = projectScheme(options.project.name);
      changed = true;
    }

    const experiments = isJsonRecord(expo.experiments) ? expo.experiments : {};
    if (experiments.typedRoutes !== true) {
      experiments.typedRoutes = true;
      changed = true;
    }
    expo.experiments = experiments;

    if (expo.plugins === undefined) {
      expo.plugins = ['expo-router'];
      changed = true;
    } else if (Array.isArray(expo.plugins)) {
      if (!expo.plugins.some((plugin) => expoPluginName(plugin) === 'expo-router')) {
        expo.plugins.push('expo-router');
        changed = true;
      }
    } else {
      throw new TypeError('expo.plugins is not an array');
    }

    addChange(changes, {
      path: 'app.json',
      before,
      content: changed ? renderJson(before, parsed) : before,
      descriptions: ['Configure the Expo Router plugin, scheme, and typed routes'],
      requestedBy: ['navigation'],
    });
    addHandled(handled, EXPO_ROUTER_CONFIG_STEP);
  } catch (error) {
    warnings.push(`Could not update app.json automatically: ${(error as Error).message}`);
  }
}

async function planBabelConfig(
  options: IntegrationPlannerOptions,
  changes: IntegrationChange[],
  handled: Set<string>,
  warnings: string[],
): Promise<void> {
  const selectedModules = new Set(options.selectedModules);
  const needsUnistyles = selectedModules.has('unistyles');
  const needsExpoPreset = options.navigation === 'expo-router';
  if (!needsUnistyles && !needsExpoPreset) {
    return;
  }

  const babelPath = await existingPath(options.project.root, BABEL_CONFIG_CANDIDATES);
  const babelOptions = {
    ...(needsExpoPreset ? { preset: 'babel-preset-expo' } : {}),
    ...(needsUnistyles ? { unistylesRoot: 'src' } : {}),
  };

  if (babelPath === undefined) {
    if (!needsUnistyles) {
      addHandled(handled, EXPO_ROUTER_BABEL_STEP);
      return;
    }

    if (options.project.kind === 'unknown') {
      warnings.push('Cannot create a Babel configuration for an unsupported project type.');
      return;
    }

    addChange(changes, {
      path: 'babel.config.js',
      before: null,
      content: createBabelConfig(options.project.kind, babelOptions),
      descriptions: ['Create Babel configuration with the Unistyles plugin'],
      requestedBy: needsExpoPreset ? ['navigation', 'unistyles'] : ['unistyles'],
    });
    addHandled(handled, UNISTYLES_BABEL_STEP);
    if (needsExpoPreset) addHandled(handled, EXPO_ROUTER_BABEL_STEP);
    return;
  }

  const before = await readFile(path.join(options.project.root, babelPath), 'utf8');
  try {
    const result = integrateBabelConfig(before, babelOptions);
    if (!result.applied) {
      warnings.push(`Could not safely update the configuration object in ${babelPath}.`);
      return;
    }

    addChange(changes, {
      path: babelPath,
      before,
      content: result.content,
      descriptions: [
        ...(needsUnistyles ? ['Add the Unistyles Babel plugin'] : []),
        ...(needsExpoPreset ? ['Ensure Babel uses babel-preset-expo'] : []),
      ],
      requestedBy: [
        ...(needsExpoPreset ? (['navigation'] as const) : []),
        ...(needsUnistyles ? (['unistyles'] as const) : []),
      ],
    });
    if (needsUnistyles) addHandled(handled, UNISTYLES_BABEL_STEP);
    if (needsExpoPreset) addHandled(handled, EXPO_ROUTER_BABEL_STEP);
  } catch (error) {
    warnings.push(
      `Could not parse ${babelPath} for automatic integration: ${(error as Error).message}`,
    );
  }
}

export async function planAppIntegrations(
  options: IntegrationPlannerOptions,
): Promise<IntegrationPlan> {
  const changes: IntegrationChange[] = [];
  const handled = new Set<string>();
  const warnings: string[] = [];

  await planApplicationEntry(options, changes, handled, warnings);
  await planExpoRouterPackage(options, changes, handled);
  await planExpoRouterAppConfig(options, changes, handled, warnings);
  await planBabelConfig(options, changes, handled, warnings);

  return {
    changes,
    remainingSteps: options.integrationSteps.filter((step) => !handled.has(step)),
    warnings,
  };
}
