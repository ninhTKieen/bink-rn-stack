import type { CommandRunner } from '@/core/dependency-installer.types.js';
import type { FoundationWriteResult } from '@/core/foundation-writer.types.js';
import type { GenerationManifest } from '@/core/generation-manifest.types.js';

export interface SetupExecutionOptions {
  force?: boolean;
  commandRunner?: CommandRunner;
}

export interface SetupExecutionResult {
  installCommand?: string;
  installedDependencies: string[];
  files: FoundationWriteResult;
  manifest: GenerationManifest;
}
