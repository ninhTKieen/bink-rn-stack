import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';

import {
  beginSetupTransaction,
  rollbackSetupTransaction,
  UnsafeSetupTransactionPathError,
} from '@/core/setup-transaction.js';

const temporaryDirectories: string[] = [];

void afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

void test('restores existing files and removes files created after the snapshot', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bink-transaction-'));
  temporaryDirectories.push(root);
  await writeFile(path.join(root, 'package.json'), 'original package\n');
  const transaction = await beginSetupTransaction(root, ['package.json', 'src/generated/file.ts']);

  await writeFile(path.join(root, 'package.json'), 'changed package\n');
  await mkdir(path.join(root, 'src/generated'), { recursive: true });
  await writeFile(path.join(root, 'src/generated/file.ts'), 'generated\n');

  const result = await rollbackSetupTransaction(transaction);

  assert.equal(await readFile(path.join(root, 'package.json'), 'utf8'), 'original package\n');
  await assert.rejects(access(path.join(root, 'src/generated/file.ts')));
  await assert.rejects(access(path.join(root, 'src')));
  assert.deepEqual(result.restored, ['package.json']);
  assert.deepEqual(result.removed, ['src/generated/file.ts']);
  assert.deepEqual(result.failures, []);
});

void test('rejects transaction paths outside the project', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bink-transaction-unsafe-'));
  temporaryDirectories.push(root);

  await assert.rejects(
    beginSetupTransaction(root, ['../outside.ts']),
    UnsafeSetupTransactionPathError,
  );
});
