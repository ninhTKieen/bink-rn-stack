import type { Command } from 'commander';

import type { LifecycleCommandOptions } from '@/cli/commands/lifecycle.types.js';
import { formatLifecyclePreview } from '@/cli/output/format-lifecycle-preview.js';
import { promptToApplySetup } from '@/cli/prompts/confirm-setup.js';
import { selectAppIntegration } from '@/cli/prompts/select-app-integration.js';
import { parseModuleOption, promptForModuleSubset } from '@/cli/prompts/select-modules.js';
import { selectNavigationLibrary } from '@/cli/prompts/select-navigation.js';
import { CLI_VERSION } from '@/configs/constants.js';
import { detectExistingNavigation } from '@/core/detect-navigation.js';
import { detectProject, ProjectDetectionError } from '@/core/detect-project.js';
import {
  buildLifecyclePlan,
  executeLifecyclePlan,
  LifecycleConflictError,
  LifecycleIntegrationCleanupError,
  LifecycleSelectionError,
  requireGenerationManifest,
  resolveLifecycleModules,
} from '@/core/lifecycle.js';
import type { LifecycleAction } from '@/core/lifecycle.types.js';
import { STACK_MODULE_NAMES } from '@/modules/stack-module.js';
import type { NavigationStrategy } from '@/modules/navigation.types.js';
import type { StackModuleName } from '@/modules/stack-module.types.js';

function assertSupportedProject(
  result: Awaited<ReturnType<typeof detectProject>>,
): asserts result is Awaited<ReturnType<typeof detectProject>> & {
  kind: 'expo' | 'react-native';
} {
  if (result.kind === 'unknown') {
    throw new ProjectDetectionError(
      'UNSUPPORTED_PROJECT',
      `Could not identify ${result.root} as an Expo or bare React Native project.`,
    );
  }
}

async function requestedModules(
  action: 'add' | 'remove',
  trackedModules: readonly StackModuleName[],
  option: string | undefined,
): Promise<StackModuleName[]> {
  const tracked = new Set(trackedModules);
  const available = STACK_MODULE_NAMES.filter((moduleName) =>
    action === 'add' ? !tracked.has(moduleName) : tracked.has(moduleName),
  );
  if (available.length === 0) {
    throw new LifecycleSelectionError(
      action === 'add' ? 'Every supported module is already tracked.' : 'No modules are tracked.',
    );
  }

  const selected =
    option === undefined
      ? await promptForModuleSubset(
          action === 'add' ? 'Select modules to add' : 'Select modules to remove',
          available,
        )
      : option.trim().toLowerCase() === 'all'
        ? available
        : parseModuleOption(option);
  const unavailable = selected.filter((moduleName) => !available.includes(moduleName));
  if (unavailable.length > 0) {
    throw new LifecycleSelectionError(
      `${action === 'add' ? 'Already tracked' : 'Not tracked'}: ${unavailable.join(', ')}.`,
    );
  }
  return selected;
}

async function runLifecycleCommand(
  action: LifecycleAction,
  targetPath: string,
  options: LifecycleCommandOptions,
): Promise<void> {
  const project = await detectProject(targetPath);
  assertSupportedProject(project);
  const manifest = await requireGenerationManifest(project.root);
  const selected =
    action === 'update'
      ? [...manifest.modules]
      : await requestedModules(action, manifest.modules, options.modules);
  if (selected.length === 0) {
    throw new LifecycleSelectionError('No modules are tracked. Use add or init first.');
  }
  const modulesAfter = resolveLifecycleModules(action, manifest.modules, selected);
  const navigationIsBeingAdded = action === 'add' && selected.includes('navigation');
  const navigationRemains = modulesAfter.includes('navigation');
  const existingNavigation = navigationRemains
    ? await detectExistingNavigation(project)
    : { libraries: [], evidence: {} };
  let navigation: NavigationStrategy | undefined;

  if (navigationIsBeingAdded) {
    navigation = await selectNavigationLibrary(
      project.kind,
      ['navigation'],
      existingNavigation,
      options.navigation,
    );
  } else if (navigationRemains) {
    if (options.navigation !== undefined) {
      throw new LifecycleSelectionError(
        'Use init with --force to switch an already tracked navigation library.',
      );
    }
    navigation = manifest.navigation;
  } else if (options.navigation !== undefined) {
    throw new LifecycleSelectionError('--navigation can only be used when adding navigation.');
  }

  const appIntegration =
    action === 'remove'
      ? 'manual'
      : await selectAppIntegration(
          action === 'add' ? selected : modulesAfter,
          options.integrate ?? (Object.keys(manifest.integrations).length > 0 ? true : undefined),
        );
  const plan = await buildLifecyclePlan(action, project, modulesAfter, {
    ...(navigation === undefined ? {} : { navigation }),
    existingNavigation,
    appIntegration,
    keepDependencies: options.keepDependencies === true,
  });

  process.stdout.write(`${formatLifecyclePreview(plan)}\n`);
  if (options.dryRun === true) {
    process.stdout.write('\nDry run complete. No changes were made.\n');
    return;
  }

  const conflicts = plan.files
    .filter(({ action: fileAction }) => fileAction === 'conflict')
    .map(({ path }) => path);
  if (conflicts.length > 0 && options.force !== true) {
    throw new LifecycleConflictError(conflicts);
  }
  if (plan.requiresIntegrationCleanup && options.force !== true) {
    throw new LifecycleIntegrationCleanupError();
  }

  const shouldApply = options.yes === true ? true : await promptToApplySetup();
  if (!shouldApply) {
    process.stdout.write(
      `\n${action[0]?.toUpperCase()}${action.slice(1)} cancelled. No changes were made.\n`,
    );
    return;
  }

  process.stdout.write(`\nApplying ${action}...\n`);
  const result = await executeLifecyclePlan(plan, CLI_VERSION, {
    force: options.force === true,
  });
  process.stdout.write(
    `\n${action[0]?.toUpperCase()}${action.slice(1)} complete.\n` +
      `Dependencies installed: ${result.installedDependencies.length}\n` +
      `Dependencies removed: ${result.removedDependencies.length}\n` +
      `Files created: ${result.createdFiles.length}\n` +
      `Files updated: ${result.updatedFiles.length}\n` +
      `Files removed: ${result.removedFiles.length}\n` +
      `Files unchanged: ${result.unchangedFiles.length}\n` +
      `Modules tracked: ${result.manifest.modules.length}\n`,
  );
}

function addCommonOptions(command: Command, includeModules: boolean): Command {
  command
    .argument('[path]', 'path to the initialized React Native app', '.')
    .option('--dry-run', 'show the preview without making changes')
    .option('-y, --yes', 'apply without asking for confirmation')
    .option('--force', 'replace drifted tracked files after reviewing the preview');
  if (includeModules) {
    command.option('-m, --modules <modules>', 'select all or a comma-separated list of modules');
  }
  return command;
}

export function registerLifecycleCommands(program: Command): void {
  addCommonOptions(program.command('add').description('Add modules to an initialized stack'), true)
    .option('--integrate', 'automatically update supported application and config files')
    .option('--no-integrate', 'preserve application files and print manual steps')
    .option('--navigation <library>', 'choose keep, react-navigation, or expo-router')
    .action(async (targetPath: string, options: LifecycleCommandOptions) => {
      await runLifecycleCommand('add', targetPath, options);
    });

  addCommonOptions(
    program.command('update').description('Regenerate all tracked modules with this CLI version'),
    false,
  )
    .option('--integrate', 'update supported application and config integrations')
    .option('--no-integrate', 'preserve application files and print manual steps')
    .action(async (targetPath: string, options: LifecycleCommandOptions) => {
      await runLifecycleCommand('update', targetPath, options);
    });

  addCommonOptions(program.command('remove').description('Remove tracked modules safely'), true)
    .option('--keep-dependencies', 'keep dependencies installed by the CLI')
    .action(async (targetPath: string, options: LifecycleCommandOptions) => {
      await runLifecycleCommand('remove', targetPath, options);
    });
}
