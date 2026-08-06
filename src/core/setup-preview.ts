import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { detectExistingNavigation } from '@/core/detect-navigation.js';
import type { ExistingNavigationDetection } from '@/core/detect-navigation.types.js';
import { createPackageInstallCommand } from '@/core/package-manager-command.js';
import type {
  PreviewDependency,
  PreviewEntrySources,
  PreviewFile,
  PreviewPackageJson,
  SetupPlan,
  SetupPlanOptions,
  SetupPreview,
} from '@/core/setup-preview.types.js';
import { renderSelectedFoundations } from '@/generators/foundation-renderer.js';
import { planAppIntegrations } from '@/integrations/integration-planner.js';
import { STACK_MODULES } from '@/modules/stack-module.js';
import { getNavigationDefinition } from '@/modules/navigation.js';
import type { NavigationStrategy } from '@/modules/navigation.types.js';
import type { StackModuleDefinition, StackModuleName } from '@/modules/stack-module.types.js';
import type { ProjectDetection } from '@/core/detect-project.types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dependencyNames(value: unknown): string[] {
  return isRecord(value) ? Object.keys(value) : [];
}

async function readInstalledDependencies(packageJsonPath: string): Promise<Set<string>> {
  const parsed: unknown = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const packageJson: PreviewPackageJson = isRecord(parsed) ? parsed : {};

  return new Set([
    ...dependencyNames(packageJson.dependencies),
    ...dependencyNames(packageJson.devDependencies),
    ...dependencyNames(packageJson.peerDependencies),
  ]);
}

async function detectFileStatus(
  filePath: string,
  generatedContent: string,
): Promise<PreviewFile['status']> {
  try {
    const existingContent = await readFile(filePath, 'utf8');
    return existingContent === generatedContent ? 'unchanged' : 'conflict';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 'create';
    }

    return 'conflict';
  }
}

function selectedDefinitions(
  selectedModules: readonly StackModuleName[],
): readonly StackModuleDefinition[] {
  const names = new Set(selectedModules);
  return STACK_MODULES.filter(({ name }) => names.has(name));
}

function addEntrySource(
  entries: Map<string, PreviewEntrySources>,
  name: string,
  requestedBy: StackModuleName,
): void {
  const entry = entries.get(name);

  if (entry === undefined) {
    entries.set(name, { name, requestedBy: [requestedBy] });
    return;
  }

  if (!entry.requestedBy.includes(requestedBy)) {
    entry.requestedBy.push(requestedBy);
  }
}

function dependenciesForProject(
  definition: StackModuleDefinition,
  projectKind: ProjectDetection['kind'],
): readonly string[] {
  if (projectKind === 'expo') {
    return [...definition.dependencies, ...(definition.expoDependencies ?? [])];
  }

  return [...definition.dependencies, ...(definition.reactNativeDependencies ?? [])];
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function resolvePlanNavigation(
  project: ProjectDetection,
  selectedModules: readonly StackModuleName[],
  requestedNavigation: NavigationStrategy | undefined,
  existingNavigation: ExistingNavigationDetection,
): NavigationStrategy | undefined {
  const navigationSelected = selectedModules.includes('navigation');

  if (!navigationSelected) {
    if (requestedNavigation !== undefined) {
      throw new Error('Navigation cannot be configured when the module is not selected.');
    }

    return undefined;
  }

  if (requestedNavigation === 'keep' && existingNavigation.libraries.length === 0) {
    throw new Error('Existing navigation is required when navigation is set to keep.');
  }

  if (project.kind === 'react-native') {
    if (requestedNavigation === 'expo-router') {
      throw new Error('Expo Router cannot be configured for bare React Native.');
    }

    return (
      requestedNavigation ?? (existingNavigation.libraries.length > 0 ? 'keep' : 'react-navigation')
    );
  }

  if (requestedNavigation === undefined) {
    if (existingNavigation.libraries.length > 0) {
      return 'keep';
    }

    throw new Error('Choose React Navigation or Expo Router for the Expo project.');
  }

  return requestedNavigation;
}

function integrationStepsForDefinition(
  definition: StackModuleDefinition,
  generatedNavigation: boolean,
  navigation: NavigationStrategy | undefined,
): readonly string[] {
  if (definition.name === 'navigation') {
    if (navigation === 'keep') {
      return [];
    }

    return navigation === undefined ? [] : getNavigationDefinition(navigation).integrationSteps;
  }

  if (!generatedNavigation) {
    return definition.integrationSteps;
  }

  if (definition.name === 'tanstack-query' || definition.name === 'i18n') {
    return [];
  }

  if (definition.name === 'unistyles') {
    return definition.integrationSteps.filter(
      (step) => !step.startsWith('Import src/theme/unistyles.ts'),
    );
  }

  return definition.integrationSteps;
}

export async function buildSetupPlan(
  project: ProjectDetection,
  selectedModules: readonly StackModuleName[],
  options: SetupPlanOptions = {},
): Promise<SetupPlan> {
  const definitions = selectedDefinitions(selectedModules);
  const existingNavigation = selectedModules.includes('navigation')
    ? (options.existingNavigation ?? (await detectExistingNavigation(project)))
    : { libraries: [], evidence: {} };
  const navigation = resolvePlanNavigation(
    project,
    selectedModules,
    options.navigation,
    existingNavigation,
  );
  const navigationDefinition =
    navigation === undefined || navigation === 'keep'
      ? undefined
      : getNavigationDefinition(navigation);
  const navigationReplacement =
    navigation !== undefined && navigation !== 'keep' && existingNavigation.libraries.length > 0;
  const renderedNavigation = navigation === 'keep' ? existingNavigation.primary : navigation;
  const installedDependencies = await readInstalledDependencies(project.packageJsonPath);
  const dependencySources = new Map<string, PreviewEntrySources>();

  for (const definition of definitions) {
    const definitionDependencies =
      definition.name === 'navigation' && navigationDefinition !== undefined
        ? navigationDefinition.dependencies
        : dependenciesForProject(definition, project.kind);

    for (const dependency of definitionDependencies) {
      addEntrySource(dependencySources, dependency, definition.name);
    }
  }

  const dependencies: PreviewDependency[] = [...dependencySources.values()].map(
    ({ name, requestedBy }) => ({
      name,
      status: installedDependencies.has(name) ? 'existing' : 'install',
      requestedBy,
    }),
  );
  if (project.kind === 'unknown') {
    throw new Error('Cannot build a setup preview for an unsupported project.');
  }

  const foundation = await renderSelectedFoundations({
    projectKind: project.kind,
    selectedModules,
    ...(renderedNavigation === undefined ? {} : { navigation: renderedNavigation }),
    ...(navigation === 'keep' ? { preserveNavigation: true } : {}),
  });
  const files: PreviewFile[] = await Promise.all(
    foundation.files.map(async ({ path: filePath, content, requestedBy }) => ({
      path: filePath,
      status: await detectFileStatus(path.join(project.root, filePath), content),
      requestedBy,
    })),
  );
  const missingDependencies = dependencies
    .filter(({ status }) => status === 'install')
    .map(({ name }) => name);
  const warnings: string[] = [];

  if (project.packageManager.name === 'unknown' && missingDependencies.length > 0) {
    warnings.push('A package manager must be selected before dependencies can be installed.');
  }

  if (project.packageManager.conflictingManagers.length > 0) {
    warnings.push(
      `Conflicting package manager signals were found for ${project.packageManager.conflictingManagers.join(', ')}.`,
    );
  }

  if (files.some(({ status }) => status === 'conflict')) {
    warnings.push('Existing files are conflicts and will not be overwritten without --force.');
  }

  if (navigationReplacement) {
    warnings.push(
      'Existing navigation will only be regenerated or switched with --force; manual cleanup may still be required.',
    );
  }

  const requiresNativeRebuild = definitions.some(
    ({ name, requiresNativeRebuild }) =>
      (name === 'navigation'
        ? navigationDefinition?.requiresNativeRebuild
        : requiresNativeRebuild) === true,
  );
  const nativeSteps = requiresNativeRebuild
    ? project.kind === 'expo'
      ? ['Create a new Expo development build after native dependencies are installed.']
      : ['Run CocoaPods on iOS and rebuild the native application.']
    : [];

  const installCommand =
    project.packageManager.name === 'unknown'
      ? undefined
      : createPackageInstallCommand(project.packageManager.name, missingDependencies);
  const requestedIntegrationSteps = uniqueValues(
    definitions.flatMap((definition) =>
      integrationStepsForDefinition(
        definition,
        navigation !== undefined && navigation !== 'keep',
        navigation,
      ),
    ),
  );
  const appIntegration = options.appIntegration ?? 'automatic';
  const integrations =
    appIntegration === 'automatic'
      ? await planAppIntegrations({
          project,
          selectedModules: foundation.selectedModules,
          ...(navigation === undefined ? {} : { navigation }),
          ...(selectedModules.includes('navigation') ? { existingNavigation } : {}),
          integrationSteps: requestedIntegrationSteps,
        })
      : {
          changes: [],
          remainingSteps: requestedIntegrationSteps,
          warnings: [],
        };
  warnings.push(...integrations.warnings);

  const preview: SetupPreview = {
    project,
    selectedModules: foundation.selectedModules,
    ...(navigation === undefined ? {} : { navigation }),
    ...(selectedModules.includes('navigation') ? { existingNavigation } : {}),
    navigationReplacement,
    appIntegration,
    dependencies,
    files,
    integrations: integrations.changes.map((change) => ({
      path: change.path,
      status:
        change.before === null
          ? 'create'
          : change.before === change.content
            ? 'unchanged'
            : 'modify',
      descriptions: change.descriptions,
      requestedBy: change.requestedBy,
    })),
    ...(installCommand === undefined ? {} : { installCommand: installCommand.display }),
    integrationSteps: integrations.remainingSteps,
    nativeSteps,
    warnings,
  };

  return { preview, foundation, integrations: integrations.changes };
}

export async function buildSetupPreview(
  project: ProjectDetection,
  selectedModules: readonly StackModuleName[],
  options: SetupPlanOptions = {},
): Promise<SetupPreview> {
  return (await buildSetupPlan(project, selectedModules, options)).preview;
}
