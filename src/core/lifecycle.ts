import { createHash } from 'node:crypto';
import { readFile, rmdir, unlink } from 'node:fs/promises';
import path from 'node:path';

import { installDependencies, removeDependencies } from '@/core/dependency-installer.js';
import type { ProjectDetection } from '@/core/detect-project.types.js';
import {
  GENERATION_MANIFEST_FILENAME,
  readGenerationManifest,
  writeGenerationManifest,
} from '@/core/generation-manifest.js';
import type {
  BuildLifecyclePlanOptions,
  LifecycleAction,
  LifecycleExecutionOptions,
  LifecycleExecutionResult,
  LifecycleFileChange,
  LifecyclePlan,
} from '@/core/lifecycle.types.js';
import { createPackageRemoveCommand } from '@/core/package-manager-command.js';
import { buildSetupPlan } from '@/core/setup-preview.js';
import {
  beginSetupTransaction,
  PACKAGE_MANAGER_TRANSACTION_FILES,
  rollbackSetupTransaction,
} from '@/core/setup-transaction.js';
import { SetupTransactionError } from '@/core/setup-executor.js';
import { writeFoundationFiles } from '@/core/foundation-writer.js';
import { rebaseIntegrationChangesAfterInstall } from '@/integrations/integration-rebaser.js';
import {
  verifyIntegrationChanges,
  writeIntegrationChanges,
} from '@/integrations/integration-writer.js';
import { getNavigationDefinition } from '@/modules/navigation.js';
import { STACK_MODULE_NAMES, STACK_MODULES } from '@/modules/stack-module.js';
import type { StackModuleDefinition, StackModuleName } from '@/modules/stack-module.types.js';

export class LifecycleManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LifecycleManifestError';
  }
}

export class LifecycleSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LifecycleSelectionError';
  }
}

export class LifecycleConflictError extends Error {
  readonly paths: string[];

  constructor(paths: readonly string[]) {
    super(`Tracked files have unreviewed changes: ${paths.join(', ')}`);
    this.name = 'LifecycleConflictError';
    this.paths = [...paths];
  }
}

export class LifecycleIntegrationCleanupError extends Error {
  constructor() {
    super(
      'Removing these modules may leave automatic application integrations behind. Review the preview and re-run with --force after planning the cleanup.',
    );
    this.name = 'LifecycleIntegrationCleanupError';
  }
}

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function currentFile(filePath: string): Promise<{ content: string; hash: string } | null> {
  try {
    const content = await readFile(filePath, 'utf8');
    return { content, hash: hash(content) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

function canonicalModules(modules: readonly StackModuleName[]): StackModuleName[] {
  const selected = new Set(modules);
  return STACK_MODULE_NAMES.filter((moduleName) => selected.has(moduleName));
}

export function resolveLifecycleModules(
  action: LifecycleAction,
  trackedModules: readonly StackModuleName[],
  requestedModules: readonly StackModuleName[],
): StackModuleName[] {
  const tracked = new Set(trackedModules);
  const requested = new Set(requestedModules);

  if (action === 'add') {
    const alreadyTracked = requestedModules.filter((moduleName) => tracked.has(moduleName));
    if (alreadyTracked.length > 0) {
      throw new LifecycleSelectionError(
        `Already tracked: ${alreadyTracked.join(', ')}. Use update to regenerate tracked modules.`,
      );
    }

    return canonicalModules([...trackedModules, ...requestedModules]);
  }

  if (action === 'remove') {
    const notTracked = requestedModules.filter((moduleName) => !tracked.has(moduleName));
    if (notTracked.length > 0) {
      throw new LifecycleSelectionError(`Not tracked: ${notTracked.join(', ')}.`);
    }

    return canonicalModules(trackedModules.filter((moduleName) => !requested.has(moduleName)));
  }

  return canonicalModules(trackedModules);
}

export async function requireGenerationManifest(projectRoot: string) {
  const manifest = await readGenerationManifest(projectRoot);
  if (manifest === undefined) {
    throw new LifecycleManifestError(
      `No valid ${GENERATION_MANIFEST_FILENAME} was found. Run init before using lifecycle commands.`,
    );
  }

  return manifest;
}

async function planFileChanges(
  projectRoot: string,
  trackedFiles: Readonly<Record<string, string>>,
  setup: LifecyclePlan['setup'],
): Promise<LifecycleFileChange[]> {
  const desiredFiles = new Map(setup.foundation.files.map((file) => [file.path, file.content]));
  const paths = [...new Set([...Object.keys(trackedFiles), ...desiredFiles.keys()])].sort();

  return await Promise.all(
    paths.map(async (filePath) => {
      const current = await currentFile(path.join(projectRoot, filePath));
      const trackedHash = trackedFiles[filePath];
      const desiredContent = desiredFiles.get(filePath);
      const base = {
        path: filePath,
        desired: desiredContent !== undefined,
        currentHash: current?.hash ?? null,
        ...(trackedHash === undefined ? {} : { trackedHash }),
      };

      if (desiredContent === undefined) {
        if (current === null) return { ...base, action: 'missing' as const };
        return {
          ...base,
          action: current.hash === trackedHash ? ('remove' as const) : ('conflict' as const),
        };
      }

      if (current === null) return { ...base, action: 'create' as const };
      if (current.content === desiredContent) return { ...base, action: 'unchanged' as const };
      if (trackedHash !== undefined && current.hash === trackedHash) {
        return { ...base, action: 'update' as const };
      }

      return { ...base, action: 'conflict' as const };
    }),
  );
}

function requiredDependencies(
  project: ProjectDetection,
  modules: readonly StackModuleName[],
  navigation: LifecyclePlan['manifest']['navigation'],
): Set<string> {
  const result = new Set<string>();

  for (const moduleName of modules) {
    if (moduleName === 'navigation') {
      if (navigation !== undefined) {
        getNavigationDefinition(navigation).dependencies.forEach((dependency) =>
          result.add(dependency),
        );
      }
      continue;
    }

    const definition: StackModuleDefinition | undefined = STACK_MODULES.find(
      ({ name }) => name === moduleName,
    );
    definition?.dependencies.forEach((dependency) => result.add(dependency));
    const platformDependencies =
      project.kind === 'expo' ? definition?.expoDependencies : definition?.reactNativeDependencies;
    platformDependencies?.forEach((dependency) => result.add(dependency));
  }

  return result;
}

export async function buildLifecyclePlan(
  action: LifecycleAction,
  project: ProjectDetection,
  modulesAfter: readonly StackModuleName[],
  options: BuildLifecyclePlanOptions = {},
): Promise<LifecyclePlan> {
  const manifest = await requireGenerationManifest(project.root);
  const normalizedModules = canonicalModules(modulesAfter);
  const navigation = normalizedModules.includes('navigation')
    ? (options.navigation ?? manifest.navigation)
    : undefined;

  if (normalizedModules.includes('navigation') && navigation === undefined) {
    throw new LifecycleManifestError(
      'Navigation is tracked, but its library is missing from the manifest.',
    );
  }

  const setup = await buildSetupPlan(project, normalizedModules, {
    ...(navigation === undefined ? {} : { navigation }),
    ...(options.existingNavigation === undefined
      ? {}
      : { existingNavigation: options.existingNavigation }),
    appIntegration: options.appIntegration ?? 'manual',
  });
  const files = await planFileChanges(project.root, manifest.files, setup);
  const install = setup.preview.dependencies
    .filter(({ status }) => status === 'install')
    .map(({ name }) => name);
  const requiredAfter = requiredDependencies(
    project,
    normalizedModules,
    setup.foundation.navigation,
  );
  const managedDependencies = manifest.managedDependencies ?? [];
  const remove =
    action === 'remove' && options.keepDependencies !== true
      ? managedDependencies.filter((dependency) => !requiredAfter.has(dependency))
      : [];
  const preserved = managedDependencies.filter((dependency) => !remove.includes(dependency));
  const removeCommand =
    project.packageManager.name === 'unknown'
      ? undefined
      : createPackageRemoveCommand(project.packageManager.name, remove);
  const warnings = setup.preview.warnings.filter(
    (warning) =>
      !warning.startsWith('Existing files are conflicts') &&
      !warning.startsWith('Existing navigation will only be regenerated'),
  );
  const removedModules = manifest.modules.filter(
    (moduleName) => !normalizedModules.includes(moduleName),
  );
  const requiresIntegrationCleanup =
    action === 'remove' &&
    Object.keys(manifest.integrations).length > 0 &&
    removedModules.some((moduleName) =>
      ['navigation', 'unistyles', 'tanstack-query', 'i18n'].includes(moduleName),
    );

  if (files.some(({ action: fileAction }) => fileAction === 'conflict')) {
    warnings.push('Tracked or destination files have drifted and require --force to replace.');
  }
  if (requiresIntegrationCleanup) {
    warnings.push(
      'Existing automatic app integrations are preserved. Remove obsolete imports, wrappers, and configuration before or after applying with --force.',
    );
  }
  if (action === 'remove' && manifest.managedDependencies === undefined) {
    warnings.push(
      'This manifest predates dependency ownership tracking, so dependencies will be preserved.',
    );
  }

  return {
    action,
    project,
    manifest,
    modulesBefore: [...manifest.modules],
    modulesAfter: normalizedModules,
    setup,
    files,
    dependencies: {
      install,
      remove,
      preserved,
      ...(setup.preview.installCommand === undefined
        ? {}
        : { installCommand: setup.preview.installCommand }),
      ...(removeCommand === undefined ? {} : { removeCommand: removeCommand.display }),
    },
    requiresIntegrationCleanup,
    warnings: [...new Set(warnings)],
  };
}

async function verifyFileSnapshot(projectRoot: string, changes: readonly LifecycleFileChange[]) {
  const conflicts: string[] = [];

  for (const change of changes) {
    const current = await currentFile(path.join(projectRoot, change.path));
    if ((current?.hash ?? null) !== change.currentHash) {
      conflicts.push(change.path);
    }
  }

  if (conflicts.length > 0) {
    throw new LifecycleConflictError(conflicts);
  }
}

function resolveOwnedPath(projectRoot: string, filePath: string): string {
  const root = path.resolve(projectRoot);
  const absolutePath = path.resolve(root, filePath);
  const relativePath = path.relative(root, absolutePath);
  if (relativePath.length === 0 || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new LifecycleConflictError([filePath]);
  }
  return absolutePath;
}

async function removeEmptyParents(projectRoot: string, filePath: string): Promise<void> {
  const root = path.resolve(projectRoot);
  let directory = path.dirname(filePath);

  while (directory !== root && directory.startsWith(`${root}${path.sep}`)) {
    try {
      await rmdir(directory);
      directory = path.dirname(directory);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        directory = path.dirname(directory);
        continue;
      }
      if (code === 'ENOTEMPTY' || code === 'EEXIST') return;
      throw error;
    }
  }
}

async function deletePlannedFiles(
  projectRoot: string,
  changes: readonly LifecycleFileChange[],
): Promise<string[]> {
  const removed: string[] = [];
  for (const change of changes) {
    if (change.action !== 'remove' && !(change.action === 'conflict' && change.desired === false)) {
      continue;
    }
    const absolutePath = resolveOwnedPath(projectRoot, change.path);
    try {
      await unlink(absolutePath);
      removed.push(change.path);
      await removeEmptyParents(projectRoot, absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return removed;
}

export async function executeLifecyclePlan(
  plan: LifecyclePlan,
  version: string,
  options: LifecycleExecutionOptions = {},
): Promise<LifecycleExecutionResult> {
  if (plan.requiresIntegrationCleanup && options.force !== true) {
    throw new LifecycleIntegrationCleanupError();
  }

  const conflicts = plan.files
    .filter(({ action }) => action === 'conflict')
    .map(({ path: filePath }) => filePath);
  if (conflicts.length > 0 && options.force !== true) {
    throw new LifecycleConflictError(conflicts);
  }

  await verifyFileSnapshot(plan.project.root, plan.files);
  await verifyIntegrationChanges(plan.project.root, plan.setup.integrations);
  const packageJsonPath = path
    .relative(path.resolve(plan.project.root), plan.project.packageJsonPath)
    .replaceAll('\\', '/');
  const transaction = await beginSetupTransaction(plan.project.root, [
    ...PACKAGE_MANAGER_TRANSACTION_FILES,
    packageJsonPath,
    GENERATION_MANIFEST_FILENAME,
    ...plan.files.map(({ path: filePath }) => filePath),
    ...plan.setup.integrations.map(({ path: filePath }) => filePath),
  ]);

  try {
    const installResult = await installDependencies(plan.project, plan.dependencies.install, {
      ...(options.commandRunner === undefined ? {} : { runner: options.commandRunner }),
    });
    await verifyFileSnapshot(plan.project.root, plan.files);
    const integrations = await rebaseIntegrationChangesAfterInstall(
      plan.project.root,
      plan.setup.integrations,
    );
    await verifyIntegrationChanges(plan.project.root, integrations);
    const fileResult = await writeFoundationFiles(plan.project.root, plan.setup.foundation.files, {
      force: true,
    });
    await writeIntegrationChanges(plan.project.root, integrations);
    const removedFiles = await deletePlannedFiles(plan.project.root, plan.files);
    const removalResult = await removeDependencies(plan.project, plan.dependencies.remove, {
      ...(options.commandRunner === undefined ? {} : { runner: options.commandRunner }),
    });
    const managedDependencies = [
      ...new Set([...plan.dependencies.preserved, ...installResult.installed]),
    ];
    const manifest = await writeGenerationManifest(
      plan.project.root,
      plan.setup.foundation,
      integrations,
      version,
      {
        replace: true,
        preserveIntegrations: true,
        managedDependencies,
      },
    );

    return {
      installedDependencies: installResult.installed,
      removedDependencies: removalResult.removed,
      createdFiles: fileResult.created,
      updatedFiles: fileResult.overwritten,
      removedFiles,
      unchangedFiles: fileResult.unchanged,
      manifest,
    };
  } catch (error) {
    throw new SetupTransactionError(error, await rollbackSetupTransaction(transaction));
  }
}
