import type { PackageManagerCommand } from '@/core/package-manager-command.types.js';

export type CommandRunner = (
  command: string,
  args: readonly string[],
  cwd: string,
) => Promise<void>;

export interface DependencyInstallOptions {
  runner?: CommandRunner;
}

export interface DependencyInstallResult {
  command?: PackageManagerCommand;
  installed: string[];
}
