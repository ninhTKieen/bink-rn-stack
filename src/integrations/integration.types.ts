import type { ProjectDetection } from '@/core/detect-project.types.js';
import type { ExistingNavigationDetection } from '@/core/detect-navigation.types.js';
import type { NavigationStrategy } from '@/modules/navigation.types.js';
import type { StackModuleName } from '@/modules/stack-module.types.js';

export type AppIntegrationMode = 'automatic' | 'manual';

export interface IntegrationChange {
  path: string;
  before: string | null;
  content: string;
  descriptions: string[];
  requestedBy: StackModuleName[];
}

export type IntegrationChangeStatus = 'create' | 'modify' | 'unchanged';

export interface PreviewIntegrationChange {
  path: string;
  status: IntegrationChangeStatus;
  descriptions: string[];
  requestedBy: StackModuleName[];
}

export interface IntegrationPlan {
  changes: IntegrationChange[];
  remainingSteps: string[];
  warnings: string[];
}

export interface IntegrationPlannerOptions {
  project: ProjectDetection;
  selectedModules: readonly StackModuleName[];
  navigation?: NavigationStrategy;
  existingNavigation?: ExistingNavigationDetection;
  integrationSteps: readonly string[];
}

export interface IntegrationWriteResult {
  created: string[];
  modified: string[];
  unchanged: string[];
}

export interface SourceIntegrationOptions {
  sideEffectImports: string[];
  namedImports: Array<{
    source: string;
    imported: string;
  }>;
  replaceRootWith?: string;
  wrapRootWith?: string;
}

export interface SourceIntegrationResult {
  content: string;
  applied: boolean;
}

export interface BabelIntegrationOptions {
  preset?: string;
  unistylesRoot?: string;
}
