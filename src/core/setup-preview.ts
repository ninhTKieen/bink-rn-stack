import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createPackageInstallCommand } from '@/core/package-manager-command.js';
import type {
  PreviewDependency,
  PreviewEntrySources,
  PreviewFile,
  PreviewPackageJson,
  SetupPlan,
  SetupPreview,
} from '@/core/setup-preview.types.js';
import { renderSelectedFoundations } from '@/generators/foundation-renderer.js';
import { STACK_MODULES } from '@/modules/stack-module.js';
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

export async function buildSetupPlan(
  project: ProjectDetection,
  selectedModules: readonly StackModuleName[],
): Promise<SetupPlan> {
  const definitions = selectedDefinitions(selectedModules);
  const installedDependencies = await readInstalledDependencies(project.packageJsonPath);
  const dependencySources = new Map<string, PreviewEntrySources>();

  for (const definition of definitions) {
    for (const dependency of dependenciesForProject(definition, project.kind)) {
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

  const requiresNativeRebuild = definitions.some(
    ({ requiresNativeRebuild }) => requiresNativeRebuild === true,
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
  const preview: SetupPreview = {
    project,
    selectedModules: foundation.selectedModules,
    dependencies,
    files,
    ...(installCommand === undefined ? {} : { installCommand: installCommand.display }),
    integrationSteps: uniqueValues(definitions.flatMap(({ integrationSteps }) => integrationSteps)),
    nativeSteps,
    warnings,
  };

  return { preview, foundation };
}

export async function buildSetupPreview(
  project: ProjectDetection,
  selectedModules: readonly StackModuleName[],
): Promise<SetupPreview> {
  return (await buildSetupPlan(project, selectedModules)).preview;
}
