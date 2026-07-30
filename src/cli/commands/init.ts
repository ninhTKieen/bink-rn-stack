import type { Command } from 'commander';

import type { InitOptions } from '@/cli/commands/init.types.js';
import { formatSetupPreview } from '@/cli/output/format-setup-preview.js';
import { parseModuleOption, promptForModules } from '@/cli/prompts/select-modules.js';
import { detectProject, ProjectDetectionError } from '@/core/detect-project.js';
import { buildSetupPreview } from '@/core/setup-preview.js';

function projectLabel(kind: 'expo' | 'react-native'): string {
  return kind === 'expo' ? 'Expo' : 'bare React Native';
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Inspect a React Native app before setting up the stack')
    .argument('[path]', 'path to the React Native app', '.')
    .option('--dry-run', 'show the setup preview without making changes')
    .option('--json', 'print the detection result as JSON')
    .option(
      '-m, --modules <modules>',
      'select all or a comma-separated list: axios, unistyles, zustand, tanstack-query, i18n',
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
      const preview = await buildSetupPreview(result, selectedModules);

      process.stdout.write(`${formatSetupPreview(preview)}\n`);
      process.stdout.write(
        options.dryRun === true
          ? '\nDry run complete. No changes were made.\n'
          : '\nPreview complete. Dependency installation will be added next; no changes were made.\n',
      );
    });
}
