import type { ProjectKind } from '@/core/detect-project.types.js';
import type { RenderedGeneratorFile } from '@/generators/generator.types.js';
import type { StackModuleName } from '@/modules/stack-module.types.js';

export interface FoundationRenderOptions {
  projectKind: Extract<ProjectKind, 'expo' | 'react-native'>;
  selectedModules: readonly StackModuleName[];
  sourceRoot?: string;
  storageId?: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
}

export interface FoundationFileContribution extends RenderedGeneratorFile {
  requestedBy: StackModuleName;
}

export interface RenderedFoundationFile extends RenderedGeneratorFile {
  requestedBy: StackModuleName[];
}

export interface RenderedFoundation {
  selectedModules: StackModuleName[];
  files: RenderedFoundationFile[];
}
