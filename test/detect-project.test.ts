import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';

import { detectProject, ProjectDetectionError } from '@/core/detect-project.js';

const temporaryDirectories: string[] = [];

async function createProject(
  packageJson: Record<string, unknown> | string,
  files: Record<string, string> = {},
): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bink-rn-stack-'));
  temporaryDirectories.push(root);

  const packageContents =
    typeof packageJson === 'string' ? packageJson : JSON.stringify(packageJson, null, 2);
  await writeFile(path.join(root, 'package.json'), packageContents);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
  }

  return root;
}

void afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

void test('detects Expo before React Native when both dependencies are present', async () => {
  const root = await createProject({
    name: 'expo-app',
    packageManager: 'yarn@4.9.2',
    dependencies: {
      expo: '^55.0.0',
      'react-native': '0.83.0',
    },
  });

  const result = await detectProject(root);

  assert.equal(result.kind, 'expo');
  assert.equal(result.name, 'expo-app');
  assert.deepEqual(result.evidence, ['dependency:expo@^55.0.0', 'dependency:react-native@0.83.0']);
  assert.deepEqual(result.packageManager, {
    name: 'yarn',
    version: '4.9.2',
    source: 'packageManager',
    evidence: ['packageManager:yarn@4.9.2'],
    conflictingManagers: [],
  });
});

void test('detects a bare React Native project', async () => {
  const root = await createProject({
    name: 'native-app',
    dependencies: {
      'react-native': '0.83.0',
      react: '^19.0.0',
    },
  });

  const result = await detectProject(root);

  assert.equal(result.kind, 'react-native');
  assert.equal(result.name, 'native-app');
  assert.deepEqual(result.evidence, ['dependency:react-native@0.83.0']);
});

void test('detects Expo from app.json when the dependency signal is unavailable', async () => {
  const root = await createProject(
    { name: 'expo-config-app' },
    { 'app.json': JSON.stringify({ expo: { name: 'Expo config app' } }) },
  );

  const result = await detectProject(root);

  assert.equal(result.kind, 'expo');
  assert.deepEqual(result.evidence, ['config:app.json#expo']);
});

void test('returns unknown for a regular JavaScript package', async () => {
  const root = await createProject({
    name: 'web-app',
    dependencies: { react: '^19.0.0' },
  });

  const result = await detectProject(root);

  assert.equal(result.kind, 'unknown');
  assert.deepEqual(result.evidence, []);
});

void test('reports malformed package.json files', async () => {
  const root = await createProject('{ invalid json');

  await assert.rejects(
    detectProject(root),
    (error: unknown) =>
      error instanceof ProjectDetectionError && error.code === 'INVALID_PACKAGE_JSON',
  );
});
