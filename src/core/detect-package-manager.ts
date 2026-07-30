import { access } from 'node:fs/promises';
import path from 'node:path';

import type {
  DeclaredPackageManager,
  PackageManagerDetection,
  PackageManagerLockfile,
  PackageManagerName,
} from '@/core/detect-package-manager.types.js';

const PACKAGE_MANAGER_LOCKFILES: readonly PackageManagerLockfile[] = [
  { name: 'npm', filename: 'package-lock.json' },
  { name: 'npm', filename: 'npm-shrinkwrap.json' },
  { name: 'yarn', filename: 'yarn.lock' },
  { name: 'pnpm', filename: 'pnpm-lock.yaml' },
  { name: 'bun', filename: 'bun.lock' },
  { name: 'bun', filename: 'bun.lockb' },
];

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseDeclaredPackageManager(value: unknown): DeclaredPackageManager | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const match = /^(npm|yarn|pnpm|bun)(?:@(.+))?$/.exec(value.trim());
  if (match === null) {
    return undefined;
  }

  const name = match[1] as PackageManagerName;
  const version = match[2];

  return version === undefined ? { name } : { name, version };
}

export async function detectPackageManager(
  root: string,
  packageManagerField?: unknown,
): Promise<PackageManagerDetection> {
  const detectedLockfiles: PackageManagerLockfile[] = [];

  for (const lockfile of PACKAGE_MANAGER_LOCKFILES) {
    if (await exists(path.join(root, lockfile.filename))) {
      detectedLockfiles.push(lockfile);
    }
  }

  const lockfileManagers = [...new Set(detectedLockfiles.map(({ name }) => name))];
  const lockfileEvidence = detectedLockfiles.map(({ filename }) => `lockfile:${filename}`);
  const declaredPackageManager = parseDeclaredPackageManager(packageManagerField);

  if (declaredPackageManager !== undefined) {
    const declaredEvidence = `packageManager:${declaredPackageManager.name}${
      declaredPackageManager.version === undefined ? '' : `@${declaredPackageManager.version}`
    }`;

    return {
      name: declaredPackageManager.name,
      ...(declaredPackageManager.version === undefined
        ? {}
        : { version: declaredPackageManager.version }),
      source: 'packageManager',
      evidence: [declaredEvidence, ...lockfileEvidence],
      conflictingManagers: lockfileManagers.filter(
        (manager) => manager !== declaredPackageManager.name,
      ),
    };
  }

  if (lockfileManagers.length === 1) {
    const name = lockfileManagers[0];

    if (name !== undefined) {
      return {
        name,
        source: 'lockfile',
        evidence: lockfileEvidence,
        conflictingManagers: [],
      };
    }
  }

  if (lockfileManagers.length > 1) {
    return {
      name: 'unknown',
      source: 'ambiguous',
      evidence: lockfileEvidence,
      conflictingManagers: lockfileManagers,
    };
  }

  return {
    name: 'unknown',
    source: 'none',
    evidence: [],
    conflictingManagers: [],
  };
}
