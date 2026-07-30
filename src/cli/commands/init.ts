import type { Command } from 'commander';

import { detectProject, ProjectDetectionError } from '@/core/detect-project.js';

interface InitOptions {
  json?: boolean;
}

function projectLabel(kind: 'expo' | 'react-native'): string {
  return kind === 'expo' ? 'Expo' : 'bare React Native';
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Inspect a React Native app before setting up the stack')
    .argument('[path]', 'path to the React Native app', '.')
    .option('--json', 'print the detection result as JSON')
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

      process.stdout.write(`Detected ${projectLabel(result.kind)} project\n`);
      process.stdout.write(`Name: ${result.name}\n`);
      process.stdout.write(`Root: ${result.root}\n`);
      process.stdout.write(`Evidence: ${result.evidence.join(', ')}\n`);
      process.stdout.write(
        '\nProject detection passed. Dependency installation will be added next.\n',
      );
    });
}
