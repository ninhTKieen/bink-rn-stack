import { spawn } from 'node:child_process';

import type {
  DependencyInstallOptions,
  DependencyInstallResult,
} from '@/core/dependency-installer.types.js';
import type { ProjectDetection } from '@/core/detect-project.types.js';
import { createPackageInstallCommand } from '@/core/package-manager-command.js';

export class DependencyInstallationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DependencyInstallationError';
  }
}

const runCommand: NonNullable<DependencyInstallOptions['runner']> = (command, args, cwd) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      stdio: 'inherit',
    });

    child.once('error', (error) => {
      reject(new DependencyInstallationError(`Could not start ${command}: ${error.message}`));
    });
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const reason = signal === null ? `exit code ${code ?? 'unknown'}` : `signal ${signal}`;
      reject(new DependencyInstallationError(`${command} failed with ${reason}.`));
    });
  });

export async function installDependencies(
  project: ProjectDetection,
  dependencies: readonly string[],
  options: DependencyInstallOptions = {},
): Promise<DependencyInstallResult> {
  if (dependencies.length === 0) {
    return { installed: [] };
  }

  if (project.packageManager.name === 'unknown') {
    throw new DependencyInstallationError(
      'Could not install dependencies because the package manager is unknown.',
    );
  }

  const installCommand = createPackageInstallCommand(project.packageManager.name, dependencies);

  if (installCommand === undefined) {
    return { installed: [] };
  }

  await (options.runner ?? runCommand)(installCommand.command, installCommand.args, project.root);

  return {
    command: installCommand,
    installed: [...dependencies],
  };
}
