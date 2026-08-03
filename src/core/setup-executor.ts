import { installDependencies } from '@/core/dependency-installer.js';
import { FoundationWriteConflictError, writeFoundationFiles } from '@/core/foundation-writer.js';
import { writeGenerationManifest } from '@/core/generation-manifest.js';
import type { SetupExecutionOptions, SetupExecutionResult } from '@/core/setup-executor.types.js';
import type { SetupPlan } from '@/core/setup-preview.types.js';

export async function executeSetupPlan(
  plan: SetupPlan,
  version: string,
  options: SetupExecutionOptions = {},
): Promise<SetupExecutionResult> {
  const force = options.force === true;
  const conflicts = plan.preview.files
    .filter(({ status }) => status === 'conflict')
    .map(({ path }) => path);

  if (conflicts.length > 0 && !force) {
    throw new FoundationWriteConflictError(conflicts);
  }

  const dependencies = plan.preview.dependencies
    .filter(({ status }) => status === 'install')
    .map(({ name }) => name);
  const installResult = await installDependencies(plan.preview.project, dependencies, {
    ...(options.commandRunner === undefined ? {} : { runner: options.commandRunner }),
  });
  const files = await writeFoundationFiles(plan.preview.project.root, plan.foundation.files, {
    force,
  });
  const manifest = await writeGenerationManifest(
    plan.preview.project.root,
    plan.foundation,
    version,
  );

  return {
    ...(installResult.command === undefined
      ? {}
      : { installCommand: installResult.command.display }),
    installedDependencies: installResult.installed,
    files,
    manifest,
  };
}
