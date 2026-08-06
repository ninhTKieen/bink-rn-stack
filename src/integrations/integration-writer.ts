import { link, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type {
  IntegrationChange,
  IntegrationWriteResult,
} from '@/integrations/integration.types.js';

export class IntegrationWriteConflictError extends Error {
  readonly paths: string[];

  constructor(paths: readonly string[]) {
    super(`Application files changed after the setup preview: ${paths.join(', ')}`);
    this.name = 'IntegrationWriteConflictError';
    this.paths = [...paths];
  }
}

function resolveIntegrationPath(projectRoot: string, filePath: string): string {
  const root = path.resolve(projectRoot);
  const absolutePath = path.resolve(root, filePath);
  const relativePath = path.relative(root, absolutePath);

  if (relativePath.length === 0 || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Integration path must stay inside the target project: ${filePath}`);
  }

  return absolutePath;
}

async function currentContent(absolutePath: string): Promise<string | null> {
  try {
    return await readFile(absolutePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function verifyIntegrationChanges(
  projectRoot: string,
  changes: readonly IntegrationChange[],
): Promise<void> {
  const conflicts: string[] = [];

  for (const change of changes) {
    const absolutePath = resolveIntegrationPath(projectRoot, change.path);
    if ((await currentContent(absolutePath)) !== change.before) {
      conflicts.push(change.path);
    }
  }

  if (conflicts.length > 0) {
    throw new IntegrationWriteConflictError(conflicts);
  }
}

async function writeAtomically(
  absolutePath: string,
  content: string,
  overwrite: boolean,
): Promise<void> {
  await mkdir(path.dirname(absolutePath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(absolutePath),
    `.${path.basename(absolutePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  await writeFile(temporaryPath, content, { flag: 'wx' });

  try {
    if (overwrite) {
      await rename(temporaryPath, absolutePath);
    } else {
      await link(temporaryPath, absolutePath);
      await unlink(temporaryPath);
    }
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export async function writeIntegrationChanges(
  projectRoot: string,
  changes: readonly IntegrationChange[],
): Promise<IntegrationWriteResult> {
  await verifyIntegrationChanges(projectRoot, changes);
  const result: IntegrationWriteResult = { created: [], modified: [], unchanged: [] };

  for (const change of changes) {
    if (change.before === change.content) {
      result.unchanged.push(change.path);
      continue;
    }

    const absolutePath = resolveIntegrationPath(projectRoot, change.path);
    await writeAtomically(absolutePath, change.content, change.before !== null);
    result[change.before === null ? 'created' : 'modified'].push(change.path);
  }

  return result;
}
