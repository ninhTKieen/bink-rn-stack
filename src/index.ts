export { detectPackageManager } from '@/core/detect-package-manager.js';
export type {
  PackageManagerDetection,
  PackageManagerDetectionSource,
  PackageManagerName,
} from '@/core/detect-package-manager.types.js';
export { detectProject, ProjectDetectionError } from '@/core/detect-project.js';
export type {
  ProjectDetection,
  ProjectDetectionErrorCode,
  ProjectKind,
} from '@/core/detect-project.types.js';
export { STACK_MODULE_NAMES, STACK_MODULES } from '@/modules/stack-module.js';
export type {
  ModuleSelectionMode,
  StackModuleDefinition,
  StackModuleName,
} from '@/modules/stack-module.types.js';
