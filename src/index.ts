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
