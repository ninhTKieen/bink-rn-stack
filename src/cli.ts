#!/usr/bin/env node

import { runCli } from '@/cli/program.js';
import { SetupConfirmationError } from '@/cli/prompts/confirm-setup.js';
import { ModuleSelectionError } from '@/cli/prompts/select-modules.js';
import { DependencyInstallationError } from '@/core/dependency-installer.js';
import { ProjectDetectionError } from '@/core/detect-project.js';
import {
  FoundationWriteConflictError,
  UnsafeFoundationPathError,
} from '@/core/foundation-writer.js';

runCli().catch((error: unknown) => {
  if (
    error instanceof ProjectDetectionError ||
    error instanceof ModuleSelectionError ||
    error instanceof SetupConfirmationError ||
    error instanceof DependencyInstallationError ||
    error instanceof FoundationWriteConflictError ||
    error instanceof UnsafeFoundationPathError
  ) {
    process.stderr.write(`Error: ${error.message}\n`);
    if (error instanceof FoundationWriteConflictError) {
      process.stderr.write('Re-run with --force to overwrite these generated files.\n');
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
