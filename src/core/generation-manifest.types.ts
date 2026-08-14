import type { StackModuleName } from '@/modules/stack-module.types.js';
import type { NavigationLibrary } from '@/modules/navigation.types.js';

export interface GenerationManifest {
  version: string;
  modules: StackModuleName[];
  navigation?: NavigationLibrary;
  managedDependencies?: string[];
  files: Record<string, string>;
  integrations: Record<string, string>;
}

export interface GenerationManifestWriteOptions {
  installedDependencies?: readonly string[];
  managedDependencies?: readonly string[];
  preserveIntegrations?: boolean;
  replace?: boolean;
}
