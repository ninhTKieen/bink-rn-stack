import type { RenderedGeneratorFile } from '@/generators/generator.types.js';
import type { StackModuleName } from '@/modules/stack-module.types.js';

export interface CompositionGeneratorOptions {
  selectedModules: readonly StackModuleName[];
  sourceRoot?: string;
}

export interface RenderedCompositionFile extends RenderedGeneratorFile {
  requestedBy: StackModuleName[];
}
