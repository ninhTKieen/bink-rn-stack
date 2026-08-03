import { link, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type {
  FoundationWriteOptions,
  FoundationWriteResult,
  PlannedFoundationWrite,
} from '@/core/foundation-writer.types.js';
import type { RenderedFoundationFile } from '@/generators/foundation-renderer.types.js';

export class FoundationWriteConflictError extends Error {
  readonly paths: string[];

  constructor(paths: readonly string[]) {
    super(`Generated files conflict with existing files: ${paths.join(', ')}`);
    this.name = 'FoundationWriteConflictError';
    this.paths = [...paths];
  }
}

export class UnsafeFoundationPathError extends Error {
  readonly path: string;

  constructor(filePath: string) {
    super(`Generated file path must stay inside the project: ${filePath}`);
    this.name = 'UnsafeFoundationPathError';
    this.path = filePath;
  }
}

function resolveFoundationPath(projectRoot: string, filePath: string): string {
  const root = path.resolve(projectRoot);
  const absolutePath = path.resolve(root, filePath);
  const relativePath = path.relative(root, absolutePath);

  if (relativePath.length === 0 || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new UnsafeFoundationPathError(filePath);
  }

  return absolutePath;
}

async function inspectFile(
  projectRoot: string,
  file: RenderedFoundationFile,
  force: boolean,
): Promise<PlannedFoundationWrite> {
  const absolutePath = resolveFoundationPath(projectRoot, file.path);

  try {
    const existingContent = await readFile(absolutePath, 'utf8');

    return {
      ...file,
      absolutePath,
      action: existingContent === file.content ? 'unchanged' : force ? 'overwrite' : 'conflict',
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...file, absolutePath, action: 'create' };
    }

    return { ...file, absolutePath, action: force ? 'overwrite' : 'conflict' };
  }
}

async function writeFileAtomically(
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

export async function writeFoundationFiles(
  projectRoot: string,
  files: readonly RenderedFoundationFile[],
  options: FoundationWriteOptions = {},
): Promise<FoundationWriteResult> {
  const force = options.force === true;
  const writes = await Promise.all(files.map((file) => inspectFile(projectRoot, file, force)));
  const conflicts = writes
    .filter(({ action }) => action === 'conflict')
    .map(({ path: filePath }) => filePath);

  if (conflicts.length > 0) {
    throw new FoundationWriteConflictError(conflicts);
  }

  const result: FoundationWriteResult = {
    created: [],
    unchanged: [],
    overwritten: [],
  };

  for (const write of writes) {
    if (write.action === 'unchanged') {
      result.unchanged.push(write.path);
      continue;
    }

    if (write.action === 'conflict') {
      throw new FoundationWriteConflictError([write.path]);
    }

    await writeFileAtomically(write.absolutePath, write.content, write.action === 'overwrite');
    result[write.action === 'overwrite' ? 'overwritten' : 'created'].push(write.path);
  }

  return result;
}
