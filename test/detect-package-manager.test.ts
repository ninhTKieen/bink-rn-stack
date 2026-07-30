import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';

import { detectPackageManager } from '@/core/detect-package-manager.js';

const temporaryDirectories: string[] = [];

async function createDirectory(files: string[] = []): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bink-package-manager-'));
  temporaryDirectories.push(root);

  await Promise.all(files.map((filename) => writeFile(path.join(root, filename), '')));

  return root;
}

void afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const lockfileCases = [
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
  ['yarn.lock', 'yarn'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
] as const;

for (const [lockfile, expectedName] of lockfileCases) {
  void test(`detects ${expectedName} from ${lockfile}`, async () => {
    const root = await createDirectory([lockfile]);

    const result = await detectPackageManager(root);

    assert.equal(result.name, expectedName);
    assert.equal(result.source, 'lockfile');
    assert.deepEqual(result.evidence, [`lockfile:${lockfile}`]);
    assert.deepEqual(result.conflictingManagers, []);
  });
}

void test('gives the packageManager field precedence and reports conflicting lockfiles', async () => {
  const root = await createDirectory(['yarn.lock']);

  const result = await detectPackageManager(root, 'pnpm@10.12.0');

  assert.equal(result.name, 'pnpm');
  assert.equal(result.version, '10.12.0');
  assert.equal(result.source, 'packageManager');
  assert.deepEqual(result.evidence, ['packageManager:pnpm@10.12.0', 'lockfile:yarn.lock']);
  assert.deepEqual(result.conflictingManagers, ['yarn']);
});

void test('does not guess when lockfiles from multiple package managers exist', async () => {
  const root = await createDirectory(['package-lock.json', 'yarn.lock']);

  const result = await detectPackageManager(root);

  assert.equal(result.name, 'unknown');
  assert.equal(result.source, 'ambiguous');
  assert.deepEqual(result.conflictingManagers, ['npm', 'yarn']);
});

void test('returns unknown when no package manager signal exists', async () => {
  const root = await createDirectory();

  const result = await detectPackageManager(root);

  assert.deepEqual(result, {
    name: 'unknown',
    source: 'none',
    evidence: [],
    conflictingManagers: [],
  });
});
