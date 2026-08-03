import type { StackModuleName } from '@/modules/stack-module.types.js';
import type { NavigationLibrary } from '@/modules/navigation.types.js';

export interface GenerationManifest {
  version: string;
  modules: StackModuleName[];
  navigation?: NavigationLibrary;
  files: Record<string, string>;
}
