import { randomUUID } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  readlink,
  rename,
  rmdir,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import type {
  SetupFileSnapshot,
  SetupRollbackFailure,
  SetupRollbackResult,
  SetupTransaction,
} from '@/core/setup-transaction.types.js';

export const PACKAGE_MANAGER_TRANSACTION_FILES = [
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lock',
  'bun.lockb',
  '.pnp.cjs',
  '.pnp.data.json',
  '.pnp.loader.mjs',
  '.yarn/install-state.gz',
] as const;

export class UnsafeSetupTransactionPathError extends Error {
  readonly path: string;

  constructor(filePath: string) {
    super(`Transaction path must stay inside the target project: ${filePath}`);
    this.name = 'UnsafeSetupTransactionPathError';
    this.path = filePath;
  }
}

function resolveTransactionPath(projectRoot: string, filePath: string): string {
  const root = path.resolve(projectRoot);
  const absolutePath = path.resolve(root, filePath);
  const relativePath = path.relative(root, absolutePath);

  if (relativePath.length === 0 || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new UnsafeSetupTransactionPathError(filePath);
  }

  return absolutePath;
}

async function snapshotPath(projectRoot: string, filePath: string): Promise<SetupFileSnapshot> {
  const absolutePath = resolveTransactionPath(projectRoot, filePath);

  try {
    const stats = await lstat(absolutePath);
    if (stats.isSymbolicLink()) {
      return {
        path: filePath,
        absolutePath,
        kind: 'symlink',
        target: await readlink(absolutePath),
      };
    }

    if (stats.isDirectory()) {
      return {
        path: filePath,
        absolutePath,
        kind: 'directory',
        mode: stats.mode & 0o777,
      };
    }

    return {
      path: filePath,
      absolutePath,
      kind: 'file',
      content: await readFile(absolutePath),
      mode: stats.mode & 0o777,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { path: filePath, absolutePath, kind: 'missing' };
    }

    throw error;
  }
}

export async function beginSetupTransaction(
  projectRoot: string,
  paths: readonly string[],
): Promise<SetupTransaction> {
  const normalizedRoot = path.resolve(projectRoot);
  const uniquePaths = [...new Set(paths.map((filePath) => filePath.replaceAll('\\', '/')))];
  const snapshots = await Promise.all(
    uniquePaths.map(async (filePath) => await snapshotPath(normalizedRoot, filePath)),
  );

  return { projectRoot: normalizedRoot, snapshots };
}

async function writeFileAtomically(
  snapshot: Extract<SetupFileSnapshot, { kind: 'file' }>,
): Promise<void> {
  await mkdir(path.dirname(snapshot.absolutePath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(snapshot.absolutePath),
    `.${path.basename(snapshot.absolutePath)}.${process.pid}.${randomUUID()}.rollback`,
  );

  await writeFile(temporaryPath, snapshot.content, { flag: 'wx', mode: snapshot.mode });
  try {
    await rename(temporaryPath, snapshot.absolutePath);
    await chmod(snapshot.absolutePath, snapshot.mode);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function removeIfPresent(absolutePath: string): Promise<boolean> {
  try {
    const stats = await lstat(absolutePath);
    if (stats.isDirectory()) {
      await rmdir(absolutePath);
    } else {
      await unlink(absolutePath);
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

async function restoreSnapshot(
  snapshot: SetupFileSnapshot,
): Promise<'restored' | 'removed' | 'untouched'> {
  if (snapshot.kind === 'missing') {
    return (await removeIfPresent(snapshot.absolutePath)) ? 'removed' : 'untouched';
  }

  if (snapshot.kind === 'file') {
    await writeFileAtomically(snapshot);
    return 'restored';
  }

  if (snapshot.kind === 'symlink') {
    await removeIfPresent(snapshot.absolutePath);
    await mkdir(path.dirname(snapshot.absolutePath), { recursive: true });
    await symlink(snapshot.target, snapshot.absolutePath);
    return 'restored';
  }

  await mkdir(snapshot.absolutePath, { recursive: true, mode: snapshot.mode });
  await chmod(snapshot.absolutePath, snapshot.mode);
  return 'restored';
}

async function removeEmptyParents(projectRoot: string, filePath: string): Promise<void> {
  let directory = path.dirname(filePath);
  const root = path.resolve(projectRoot);

  while (directory !== root && directory.startsWith(`${root}${path.sep}`)) {
    try {
      await rmdir(directory);
      directory = path.dirname(directory);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        directory = path.dirname(directory);
        continue;
      }
      if (code === 'ENOTEMPTY' || code === 'EEXIST') {
        return;
      }
      throw error;
    }
  }
}

export async function rollbackSetupTransaction(
  transaction: SetupTransaction,
): Promise<SetupRollbackResult> {
  const restored: string[] = [];
  const removed: string[] = [];
  const untouched: string[] = [];
  const failures: SetupRollbackFailure[] = [];

  for (const snapshot of [...transaction.snapshots].reverse()) {
    try {
      const action = await restoreSnapshot(snapshot);
      if (action === 'restored') restored.push(snapshot.path);
      else if (action === 'removed') removed.push(snapshot.path);
      else untouched.push(snapshot.path);
    } catch (error) {
      failures.push({
        path: snapshot.path,
        message: error instanceof Error ? error.message : 'Unknown rollback failure',
      });
    }
  }

  for (const snapshot of transaction.snapshots) {
    if (snapshot.kind !== 'missing') {
      continue;
    }

    try {
      await removeEmptyParents(transaction.projectRoot, snapshot.absolutePath);
    } catch (error) {
      failures.push({
        path: snapshot.path,
        message: error instanceof Error ? error.message : 'Could not remove empty directories',
      });
    }
  }

  return {
    restored: restored.sort(),
    removed: removed.sort(),
    untouched: untouched.sort(),
    failures,
  };
}
