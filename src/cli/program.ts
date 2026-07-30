import { Command } from 'commander';

import { registerInitCommand } from '@/cli/commands/init.js';
import { CLI_VERSION } from '@/configs/constants.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('bink-rn-stack')
    .description('Set up an opinionated stack for React Native and Expo applications')
    .version(CLI_VERSION)
    .showHelpAfterError();

  registerInitCommand(program);

  return program;
}

export async function runCli(argv = process.argv): Promise<void> {
  await createProgram().parseAsync(argv);
}
