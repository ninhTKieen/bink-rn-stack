import { confirm } from '@inquirer/prompts';

export class SetupConfirmationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SetupConfirmationError';
  }
}

export async function promptToApplySetup(): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new SetupConfirmationError(
      'Confirmation requires an interactive terminal. Re-run with --yes to apply.',
    );
  }

  return confirm({
    message: 'Apply this setup?',
    default: true,
  });
}
