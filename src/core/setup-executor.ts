import path from 'node:path';

import { installDependencies } from '@/core/dependency-installer.js';
import { FoundationWriteConflictError, writeFoundationFiles } from '@/core/foundation-writer.js';
import {
  GENERATION_MANIFEST_FILENAME,
  writeGenerationManifest,
} from '@/core/generation-manifest.js';
import type { SetupExecutionOptions, SetupExecutionResult } from '@/core/setup-executor.types.js';
import type { SetupPlan } from '@/core/setup-preview.types.js';
import {
  beginSetupTransaction,
  PACKAGE_MANAGER_TRANSACTION_FILES,
  rollbackSetupTransaction,
} from '@/core/setup-transaction.js';
import type { SetupRollbackResult } from '@/core/setup-transaction.types.js';
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

export class SetupTransactionError extends Error {
  readonly originalError: unknown;
  readonly rollback: SetupRollbackResult;

  constructor(originalError: unknown, rollback: SetupRollbackResult) {
    const originalMessage =
      originalError instanceof Error ? originalError.message : 'Unknown setup failure';
    const rollbackMessage =
      rollback.failures.length === 0
        ? 'Project files were rolled back.'
        : `Rollback was incomplete for ${rollback.failures.length} path${rollback.failures.length === 1 ? '' : 's'}.`;

    super(`${originalMessage} ${rollbackMessage}`, { cause: originalError });
    this.name = 'SetupTransactionError';
    this.originalError = originalError;
    this.rollback = rollback;
  }
}

function transactionPaths(plan: SetupPlan): string[] {
  const projectRoot = path.resolve(plan.preview.project.root);
  const packageJsonPath = path
    .relative(projectRoot, plan.preview.project.packageJsonPath)
    .replaceAll('\\', '/');

  return [
    ...PACKAGE_MANAGER_TRANSACTION_FILES,
    packageJsonPath,
    GENERATION_MANIFEST_FILENAME,
    ...plan.foundation.files.map(({ path: filePath }) => filePath),
    ...plan.integrations.map(({ path: filePath }) => filePath),
  ];
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

  const transaction = await beginSetupTransaction(
    plan.preview.project.root,
    transactionPaths(plan),
  );

  try {
    const dependencies = plan.preview.dependencies
      .filter(({ status }) => status === 'install')
      .map(({ name }) => name);
    const installResult = await installDependencies(plan.preview.project, dependencies, {
      ...(options.commandRunner === undefined ? {} : { runner: options.commandRunner }),
    });
    await options.onPhase?.('dependencies-installed');
    const integrationChanges = await rebaseIntegrationChangesAfterInstall(
      plan.preview.project.root,
      plan.integrations,
    );
    await verifyIntegrationChanges(plan.preview.project.root, integrationChanges);
    const files = await writeFoundationFiles(plan.preview.project.root, plan.foundation.files, {
      force,
    });
    await options.onPhase?.('foundations-written');
    const integrations = await writeIntegrationChanges(
      plan.preview.project.root,
      integrationChanges,
    );
    await options.onPhase?.('integrations-written');
    const manifest = await writeGenerationManifest(
      plan.preview.project.root,
      plan.foundation,
      integrationChanges,
      version,
    );
    await options.onPhase?.('manifest-written');

    return {
      ...(installResult.command === undefined
        ? {}
        : { installCommand: installResult.command.display }),
      installedDependencies: installResult.installed,
      files,
      integrations,
      manifest,
    };
  } catch (error) {
    throw new SetupTransactionError(error, await rollbackSetupTransaction(transaction));
  }
}
