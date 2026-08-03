import type { ProjectKind } from '@/core/detect-project.types.js';

export type NavigationLibrary = 'react-navigation' | 'expo-router';
export type NavigationStrategy = NavigationLibrary | 'keep';

export interface NavigationFoundationDefinition {
  library: NavigationLibrary;
  label: string;
  dependencies: readonly string[];
  integrationSteps: readonly string[];
  requiresNativeRebuild: boolean;
}

export interface NavigationSelectionContext {
  projectKind: Extract<ProjectKind, 'expo' | 'react-native'>;
  requestedLibrary?: string;
}
