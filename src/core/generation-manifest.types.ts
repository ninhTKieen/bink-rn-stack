import type { StackModuleName } from '@/modules/stack-module.types.js';

export interface GenerationManifest {
  version: string;
  modules: StackModuleName[];
  files: Record<string, string>;
}
