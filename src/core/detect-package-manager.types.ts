export type PackageManagerName = 'npm' | 'yarn' | 'pnpm' | 'bun';

export type PackageManagerDetectionSource = 'packageManager' | 'lockfile' | 'ambiguous' | 'none';

export interface PackageManagerDetection {
  name: PackageManagerName | 'unknown';
  version?: string;
  source: PackageManagerDetectionSource;
  evidence: string[];
  conflictingManagers: PackageManagerName[];
}

export interface PackageManagerLockfile {
  name: PackageManagerName;
  filename: string;
}

export interface DeclaredPackageManager {
  name: PackageManagerName;
  version?: string;
}
