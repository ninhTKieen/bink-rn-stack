export type StackModuleName =
  'navigation' | 'axios' | 'unistyles' | 'zustand' | 'react-hook-form' | 'tanstack-query' | 'i18n';

export interface StackModuleDefinition {
  name: StackModuleName;
  label: string;
  description: string;
  dependencies: readonly string[];
  expoDependencies?: readonly string[];
  reactNativeDependencies?: readonly string[];
  integrationSteps: readonly string[];
  requiresNativeRebuild?: boolean;
}

export type ModuleSelectionMode = 'all' | 'custom';
