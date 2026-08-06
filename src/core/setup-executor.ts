import { installDependencies } from '@/core/dependency-installer.js';
import { FoundationWriteConflictError, writeFoundationFiles } from '@/core/foundation-writer.js';
import { writeGenerationManifest } from '@/core/generation-manifest.js';
import type { SetupExecutionOptions, SetupExecutionResult } from '@/core/setup-executor.types.js';
import type { SetupPlan } from '@/core/setup-preview.types.js';
import { rebaseIntegrationChangesAfterInstall } from '@/integrations/integration-rebaser.js';
import {
  verifyIntegrationChanges,
  writeIntegrationChanges,
} from '@/integrations/integration-writer.js';

export class NavigationReplacementError extends Error {
  constructor() {
    super('Existing navigation cannot be regenerated or switched without --force.');
    this.name = 'NavigationReplacementError';
  }
}

export async function executeSetupPlan(
  plan: SetupPlan,
  version: string,
  options: SetupExecutionOptions = {},
): Promise<SetupExecutionResult> {
  const force = options.force === true;

  if (plan.preview.navigationReplacement && !force) {
    throw new NavigationReplacementError();
  }

  const conflicts = plan.preview.files
    .filter(({ status }) => status === 'conflict')
    .map(({ path }) => path);

  if (conflicts.length > 0 && !force) {
    throw new FoundationWriteConflictError(conflicts);
  }

  await verifyIntegrationChanges(plan.preview.project.root, plan.integrations);

  const dependencies = plan.preview.dependencies
    .filter(({ status }) => status === 'install')
    .map(({ name }) => name);
  const installResult = await installDependencies(plan.preview.project, dependencies, {
    ...(options.commandRunner === undefined ? {} : { runner: options.commandRunner }),
  });
  const integrationChanges = await rebaseIntegrationChangesAfterInstall(
    plan.preview.project.root,
    plan.integrations,
  );
  await verifyIntegrationChanges(plan.preview.project.root, integrationChanges);
  const files = await writeFoundationFiles(plan.preview.project.root, plan.foundation.files, {
    force,
  });
  const integrations = await writeIntegrationChanges(plan.preview.project.root, integrationChanges);
  const manifest = await writeGenerationManifest(
    plan.preview.project.root,
    plan.foundation,
    integrationChanges,
    version,
  );

  return {
    ...(installResult.command === undefined
      ? {}
      : { installCommand: installResult.command.display }),
    installedDependencies: installResult.installed,
    files,
    integrations,
    manifest,
  };
}
