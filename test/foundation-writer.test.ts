import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';

import {
  FoundationWriteConflictError,
  UnsafeFoundationPathError,
  writeFoundationFiles,
} from '@/core/foundation-writer.js';
import type { RenderedFoundationFile } from '@/generators/foundation-renderer.types.js';

const temporaryDirectories: string[] = [];

async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bink-writer-'));
  temporaryDirectories.push(root);
  return root;
}

function generatedFile(filePath: string, content: string): RenderedFoundationFile {
  return { path: filePath, content, requestedBy: ['axios'] };
}

void afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

void test('creates nested files and recognizes an unchanged second run', async () => {
  const root = await createRoot();
  const files = [generatedFile('src/api/client.ts', 'export const client = {};\n')];

  const first = await writeFoundationFiles(root, files);
  const second = await writeFoundationFiles(root, files);

  assert.deepEqual(first, {
    created: ['src/api/client.ts'],
    unchanged: [],
    overwritten: [],
  });
  assert.deepEqual(second, {
    created: [],
    unchanged: ['src/api/client.ts'],
    overwritten: [],
  });
  assert.equal(await readFile(path.join(root, 'src/api/client.ts'), 'utf8'), files[0]?.content);
});

void test('preflights every conflict before creating any file', async () => {
  const root = await createRoot();
  await writeFile(path.join(root, 'existing.ts'), 'user content\n');
  const files = [
    generatedFile('existing.ts', 'generated content\n'),
    generatedFile('new.ts', 'new content\n'),
  ];

  await assert.rejects(
    writeFoundationFiles(root, files),
    (error: unknown) =>
      error instanceof FoundationWriteConflictError && error.paths[0] === 'existing.ts',
  );
  await assert.rejects(access(path.join(root, 'new.ts')));
  assert.equal(await readFile(path.join(root, 'existing.ts'), 'utf8'), 'user content\n');
});

void test('overwrites differing generated files only when forced', async () => {
  const root = await createRoot();
  await writeFile(path.join(root, 'existing.ts'), 'user content\n');

  const result = await writeFoundationFiles(
    root,
    [generatedFile('existing.ts', 'generated content\n')],
    { force: true },
  );

  assert.deepEqual(result.overwritten, ['existing.ts']);
  assert.equal(await readFile(path.join(root, 'existing.ts'), 'utf8'), 'generated content\n');
});

void test('rejects generated paths outside the project root', async () => {
  const root = await createRoot();

  await assert.rejects(
    writeFoundationFiles(root, [generatedFile('../outside.ts', 'unsafe\n')]),
    UnsafeFoundationPathError,
  );
});
