import type { PackageManagerDetection } from '@/core/detect-package-manager.types.js';

export type ProjectKind = 'expo' | 'react-native' | 'unknown';

export interface ProjectDetection {
  root: string;
  name: string;
  kind: ProjectKind;
  evidence: string[];
  packageJsonPath: string;
  packageManager: PackageManagerDetection;
}

export type ProjectDetectionErrorCode =
  | 'DIRECTORY_NOT_FOUND'
  | 'NOT_A_DIRECTORY'
  | 'PACKAGE_JSON_NOT_FOUND'
  | 'INVALID_PACKAGE_JSON'
  | 'UNSUPPORTED_PROJECT';

export interface ProjectPackageJson {
  name?: unknown;
  dependencies?: unknown;
  devDependencies?: unknown;
  peerDependencies?: unknown;
  packageManager?: unknown;
}

export type DependencyMap = Record<string, string>;
