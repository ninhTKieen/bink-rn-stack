#!/usr/bin/env node

import { runCli } from '@/cli/program.js';
import { SetupConfirmationError } from '@/cli/prompts/confirm-setup.js';
import { NavigationSelectionError } from '@/cli/prompts/select-navigation.js';
import { ModuleSelectionError } from '@/cli/prompts/select-modules.js';
import {
  DependencyInstallationError,
  DependencyRemovalError,
} from '@/core/dependency-installer.js';
import { ProjectDetectionError } from '@/core/detect-project.js';
import {
  FoundationWriteConflictError,
  UnsafeFoundationPathError,
} from '@/core/foundation-writer.js';
import { NavigationReplacementError, SetupTransactionError } from '@/core/setup-executor.js';
import {
  LifecycleConflictError,
  LifecycleIntegrationCleanupError,
  LifecycleManifestError,
  LifecycleSelectionError,
} from '@/core/lifecycle.js';
import { IntegrationWriteConflictError } from '@/integrations/integration-writer.js';

runCli().catch((error: unknown) => {
  if (
    error instanceof ProjectDetectionError ||
    error instanceof ModuleSelectionError ||
    error instanceof SetupConfirmationError ||
    error instanceof NavigationSelectionError ||
    error instanceof DependencyInstallationError ||
    error instanceof DependencyRemovalError ||
    error instanceof NavigationReplacementError ||
    error instanceof SetupTransactionError ||
    error instanceof FoundationWriteConflictError ||
    error instanceof IntegrationWriteConflictError ||
    error instanceof UnsafeFoundationPathError ||
    error instanceof LifecycleConflictError ||
    error instanceof LifecycleIntegrationCleanupError ||
    error instanceof LifecycleManifestError ||
    error instanceof LifecycleSelectionError
  ) {
    process.stderr.write(`Error: ${error.message}\n`);
    if (error instanceof FoundationWriteConflictError) {
      process.stderr.write('Re-run with --force to overwrite these generated files.\n');
    }
    if (error instanceof IntegrationWriteConflictError) {
      process.stderr.write('Run the preview again before applying setup.\n');
    }
    if (error instanceof NavigationReplacementError) {
      process.stderr.write('Re-run with --force only after reviewing the navigation migration.\n');
    }
    if (error instanceof SetupTransactionError) {
      if (error.rollback.failures.length === 0) {
        process.stderr.write(
          'Generated files, application files, package.json, and lockfiles were restored.\n',
        );
      } else {
        process.stderr.write('Rollback could not restore every path:\n');
        error.rollback.failures.forEach((failure) =>
          process.stderr.write(`- ${failure.path}: ${failure.message}\n`),
        );
      }
    }
    if (error instanceof LifecycleConflictError) {
      process.stderr.write('Review the preview and re-run with --force to replace these paths.\n');
    }
  } else if (error instanceof Error && error.name === 'ExitPromptError') {
    process.stderr.write('\nSetup cancelled.\n');
  } else if (error instanceof Error) {
    process.stderr.write(`Unexpected error: ${error.message}\n`);
  } else {
    process.stderr.write('Unexpected error while running bink-rn-stack.\n');
  }

  process.exitCode = 1;
});
