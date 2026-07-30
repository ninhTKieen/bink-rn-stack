import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { PackageManagerName } from '@/core/detect-package-manager.types.js';
import type {
  PreviewDependency,
  PreviewEntrySources,
  PreviewFile,
  PreviewPackageJson,
  SetupPreview,
} from '@/core/setup-preview.types.js';
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

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
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

function buildInstallCommand(
  packageManager: PackageManagerName,
  dependencies: readonly string[],
): string {
  const commands = {
    npm: 'npm install',
    yarn: 'yarn add',
    pnpm: 'pnpm add',
    bun: 'bun add',
  } as const;

  return `${commands[packageManager]} ${dependencies.join(' ')}`;
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export async function buildSetupPreview(
  project: ProjectDetection,
  selectedModules: readonly StackModuleName[],
): Promise<SetupPreview> {
  const definitions = selectedDefinitions(selectedModules);
  const installedDependencies = await readInstalledDependencies(project.packageJsonPath);
  const dependencySources = new Map<string, PreviewEntrySources>();
  const fileSources = new Map<string, PreviewEntrySources>();

  for (const definition of definitions) {
    for (const dependency of dependenciesForProject(definition, project.kind)) {
      addEntrySource(dependencySources, dependency, definition.name);
    }

    for (const file of definition.files) {
      addEntrySource(fileSources, file, definition.name);
    }
  }

  const dependencies: PreviewDependency[] = [...dependencySources.values()].map(
    ({ name, requestedBy }) => ({
      name,
      status: installedDependencies.has(name) ? 'existing' : 'install',
      requestedBy,
    }),
  );
  const files: PreviewFile[] = await Promise.all(
    [...fileSources.values()].map(async ({ name, requestedBy }) => ({
      path: name,
      status: (await exists(path.join(project.root, name))) ? 'conflict' : 'create',
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
    warnings.push('Existing files are conflicts and will not be overwritten without confirmation.');
  }

  const requiresNativeRebuild = definitions.some(
    ({ requiresNativeRebuild }) => requiresNativeRebuild === true,
  );
  const nativeSteps = requiresNativeRebuild
    ? project.kind === 'expo'
      ? ['Create a new Expo development build after native dependencies are installed.']
      : ['Run CocoaPods on iOS and rebuild the native application.']
    : [];

  return {
    project,
    selectedModules: [...selectedModules],
    dependencies,
    files,
    ...(project.packageManager.name === 'unknown' || missingDependencies.length === 0
      ? {}
      : {
          installCommand: buildInstallCommand(project.packageManager.name, missingDependencies),
        }),
    integrationSteps: uniqueValues(definitions.flatMap(({ integrationSteps }) => integrationSteps)),
    nativeSteps,
    warnings,
  };
}
