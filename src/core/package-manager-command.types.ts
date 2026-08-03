import type { PackageManagerName } from '@/core/detect-package-manager.types.js';

export interface PackageManagerCommand {
  packageManager: PackageManagerName;
  command: string;
  args: string[];
  display: string;
}
