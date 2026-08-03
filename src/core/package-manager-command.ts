import type { PackageManagerCommand } from '@/core/package-manager-command.types.js';
import type { PackageManagerName } from '@/core/detect-package-manager.types.js';

export function createPackageInstallCommand(
  packageManager: PackageManagerName,
  dependencies: readonly string[],
): PackageManagerCommand | undefined {
  if (dependencies.length === 0) {
    return undefined;
  }

  const commands = {
    npm: { command: 'npm', args: ['install'] },
    yarn: { command: 'yarn', args: ['add'] },
    pnpm: { command: 'pnpm', args: ['add'] },
    bun: { command: 'bun', args: ['add'] },
  } as const;
  const selectedCommand = commands[packageManager];
  const args = [...selectedCommand.args, ...dependencies];

  return {
    packageManager,
    command: selectedCommand.command,
    args,
    display: [selectedCommand.command, ...args].join(' '),
  };
}
