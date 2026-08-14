import type { CommandRunner } from '@/core/dependency-installer.types.js';
import type { GenerationManifest } from '@/core/generation-manifest.types.js';
import type { ProjectDetection } from '@/core/detect-project.types.js';
import type { SetupPlan, SetupPlanOptions } from '@/core/setup-preview.types.js';
import type { StackModuleName } from '@/modules/stack-module.types.js';

export type LifecycleAction = 'add' | 'update' | 'remove';
export type LifecycleFileAction =
  'create' | 'update' | 'remove' | 'unchanged' | 'missing' | 'conflict';

export interface LifecycleFileChange {
  path: string;
  action: LifecycleFileAction;
  desired: boolean;
  currentHash: string | null;
  trackedHash?: string;
}

export interface LifecycleDependencyPlan {
  install: string[];
  remove: string[];
  preserved: string[];
  installCommand?: string;
  removeCommand?: string;
}

export interface LifecyclePlan {
  action: LifecycleAction;
  project: ProjectDetection;
  manifest: GenerationManifest;
  modulesBefore: StackModuleName[];
  modulesAfter: StackModuleName[];
  setup: SetupPlan;
  files: LifecycleFileChange[];
  dependencies: LifecycleDependencyPlan;
  requiresIntegrationCleanup: boolean;
  warnings: string[];
}

export interface BuildLifecyclePlanOptions extends SetupPlanOptions {
  keepDependencies?: boolean;
}

export interface LifecycleExecutionOptions {
  force?: boolean;
  commandRunner?: CommandRunner;
}

export interface LifecycleExecutionResult {
  installedDependencies: string[];
  removedDependencies: string[];
  createdFiles: string[];
  updatedFiles: string[];
  removedFiles: string[];
  unchangedFiles: string[];
  manifest: GenerationManifest;
}
