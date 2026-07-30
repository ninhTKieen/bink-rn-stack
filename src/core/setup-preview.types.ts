import type { ProjectDetection } from '@/core/detect-project.types.js';
import type { StackModuleName } from '@/modules/stack-module.types.js';

export type PreviewDependencyStatus = 'install' | 'existing';
export type PreviewFileStatus = 'create' | 'conflict';

export interface PreviewDependency {
  name: string;
  status: PreviewDependencyStatus;
  requestedBy: StackModuleName[];
}

export interface PreviewFile {
  path: string;
  status: PreviewFileStatus;
  requestedBy: StackModuleName[];
}

export interface SetupPreview {
  project: ProjectDetection;
  selectedModules: StackModuleName[];
  dependencies: PreviewDependency[];
  files: PreviewFile[];
  installCommand?: string;
  integrationSteps: string[];
  nativeSteps: string[];
  warnings: string[];
}

export interface PreviewEntrySources {
  name: string;
  requestedBy: StackModuleName[];
}

export interface PreviewPackageJson {
  dependencies?: unknown;
  devDependencies?: unknown;
  peerDependencies?: unknown;
}
