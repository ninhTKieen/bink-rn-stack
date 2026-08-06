import type { ExistingNavigationDetection } from '@/core/detect-navigation.types.js';
import type { ProjectDetection } from '@/core/detect-project.types.js';
import type { NavigationStrategy } from '@/modules/navigation.types.js';
import type { StackModuleName } from '@/modules/stack-module.types.js';
import type {
  AppIntegrationMode,
  IntegrationChange,
  PreviewIntegrationChange,
} from '@/integrations/integration.types.js';

export type PreviewDependencyStatus = 'install' | 'existing';
export type PreviewFileStatus = 'create' | 'unchanged' | 'conflict';

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
  navigation?: NavigationStrategy;
  existingNavigation?: ExistingNavigationDetection;
  navigationReplacement: boolean;
  appIntegration: AppIntegrationMode;
  dependencies: PreviewDependency[];
  files: PreviewFile[];
  integrations: PreviewIntegrationChange[];
  installCommand?: string;
  integrationSteps: string[];
  nativeSteps: string[];
  warnings: string[];
}

export interface SetupPlan {
  preview: SetupPreview;
  foundation: RenderedFoundation;
  integrations: IntegrationChange[];
}

export interface SetupPlanOptions {
  navigation?: NavigationStrategy;
  existingNavigation?: ExistingNavigationDetection;
  appIntegration?: AppIntegrationMode;
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
import type { RenderedFoundation } from '@/generators/foundation-renderer.types.js';
