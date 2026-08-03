import type { Command } from 'commander';

import type { InitOptions } from '@/cli/commands/init.types.js';
import { formatSetupPreview } from '@/cli/output/format-setup-preview.js';
import { promptToApplySetup } from '@/cli/prompts/confirm-setup.js';
import { selectNavigationLibrary } from '@/cli/prompts/select-navigation.js';
import { parseModuleOption, promptForModules } from '@/cli/prompts/select-modules.js';
import { CLI_VERSION } from '@/configs/constants.js';
import { detectExistingNavigation } from '@/core/detect-navigation.js';
import { detectProject, ProjectDetectionError } from '@/core/detect-project.js';
import { FoundationWriteConflictError } from '@/core/foundation-writer.js';
import { executeSetupPlan, NavigationReplacementError } from '@/core/setup-executor.js';
import { buildSetupPlan } from '@/core/setup-preview.js';

function projectLabel(kind: 'expo' | 'react-native'): string {
  return kind === 'expo' ? 'Expo' : 'bare React Native';
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Inspect a React Native app before setting up the stack')
    .argument('[path]', 'path to the React Native app', '.')
    .option('--dry-run', 'show the setup preview without making changes')
    .option('-y, --yes', 'apply without asking for confirmation')
    .option('--force', 'overwrite generated files that differ from the preview')
    .option('--json', 'print the detection result as JSON')
    .option(
      '--navigation <library>',
      'choose keep, react-navigation, or expo-router when navigation is selected',
    )
    .option(
      '-m, --modules <modules>',
      'select all or a comma-separated list: navigation, axios, unistyles, zustand, tanstack-query, i18n',
    )
    .action(async (targetPath: string, options: InitOptions) => {
      const result = await detectProject(targetPath);

      if (options.json === true) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        if (result.kind === 'unknown') {
          process.exitCode = 1;
        }
        return;
      }

      if (result.kind === 'unknown') {
        throw new ProjectDetectionError(
          'UNSUPPORTED_PROJECT',
          `Could not identify ${result.root} as an Expo or bare React Native project. Add expo or react-native to the app dependencies, or run the command from the app root.`,
        );
      }

      process.stdout.write(`Detected ${projectLabel(result.kind)} project: ${result.name}\n`);
      const selectedModules =
        options.modules === undefined
          ? await promptForModules()
          : parseModuleOption(options.modules);
      const existingNavigation = selectedModules.includes('navigation')
        ? await detectExistingNavigation(result)
        : { libraries: [], evidence: {} };
      const navigation = await selectNavigationLibrary(
        result.kind,
        selectedModules,
        existingNavigation,
        options.navigation,
      );
      const plan = await buildSetupPlan(result, selectedModules, {
        ...(navigation === undefined ? {} : { navigation }),
        existingNavigation,
      });

      process.stdout.write(`${formatSetupPreview(plan.preview)}\n`);

      if (options.dryRun === true) {
        process.stdout.write('\nDry run complete. No changes were made.\n');
        return;
      }

      if (plan.preview.navigationReplacement && options.force !== true) {
        throw new NavigationReplacementError();
      }

      const conflicts = plan.preview.files
        .filter(({ status }) => status === 'conflict')
        .map(({ path }) => path);

      if (conflicts.length > 0 && options.force !== true) {
        throw new FoundationWriteConflictError(conflicts);
      }

      const shouldApply = options.yes === true ? true : await promptToApplySetup();

      if (!shouldApply) {
        process.stdout.write('\nSetup cancelled. No changes were made.\n');
        return;
      }

      process.stdout.write('\nApplying setup...\n');
      const execution = await executeSetupPlan(plan, CLI_VERSION, {
        force: options.force === true,
      });

      process.stdout.write('\nSetup complete.\n');
      process.stdout.write(
        `Dependencies installed: ${execution.installedDependencies.length}\n` +
          `Files created: ${execution.files.created.length}\n` +
          `Files unchanged: ${execution.files.unchanged.length}\n` +
          `Files overwritten: ${execution.files.overwritten.length}\n` +
          'Manifest: .bink-rn-stack.json\n',
      );
    });
}
