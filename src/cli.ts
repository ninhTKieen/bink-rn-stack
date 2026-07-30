#!/usr/bin/env node

import { runCli } from '@/cli/program.js';
import { ModuleSelectionError } from '@/cli/prompts/select-modules.js';
import { ProjectDetectionError } from '@/core/detect-project.js';

runCli().catch((error: unknown) => {
  if (error instanceof ProjectDetectionError || error instanceof ModuleSelectionError) {
    process.stderr.write(`Error: ${error.message}\n`);
  } else if (error instanceof Error && error.name === 'ExitPromptError') {
    process.stderr.write('\nSetup cancelled.\n');
  } else if (error instanceof Error) {
    process.stderr.write(`Unexpected error: ${error.message}\n`);
  } else {
    process.stderr.write('Unexpected error while running bink-rn-stack.\n');
  }

  process.exitCode = 1;
});
