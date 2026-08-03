import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';

import { detectExistingNavigation } from '@/core/detect-navigation.js';
import { detectProject } from '@/core/detect-project.js';

const temporaryDirectories: string[] = [];

async function createApp(packageJson: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bink-navigation-detection-'));
  temporaryDirectories.push(root);
  await writeFile(path.join(root, 'package.json'), JSON.stringify(packageJson));
  return root;
}

void afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

void test('detects Expo Router from dependencies, entry configuration, and routes', async () => {
  const root = await createApp({
    name: 'router-app',
    main: 'expo-router/entry',
    dependencies: {
      expo: '^57.0.0',
      'expo-router': '^57.0.0',
      'react-native': '0.86.0',
    },
  });
  await mkdir(path.join(root, 'src/app'), { recursive: true });
  await writeFile(
    path.join(root, 'src/app/_layout.tsx'),
    "import { Stack } from 'expo-router';\nexport default Stack;\n",
  );

  const result = await detectExistingNavigation(await detectProject(root));

  assert.deepEqual(result.libraries, ['expo-router']);
  assert.equal(result.primary, 'expo-router');
  assert.ok(result.evidence['expo-router']?.includes('dependency:expo-router'));
  assert.ok(
    result.evidence['expo-router']?.some((entry) => entry === 'source:src/app/_layout.tsx'),
  );
});

void test('detects React Navigation from its dependency and source imports', async () => {
  const root = await createApp({
    name: 'navigation-app',
    dependencies: {
      '@react-navigation/native': '^7.0.0',
      'react-native': '0.83.0',
    },
  });
  await mkdir(path.join(root, 'src/navigation'), { recursive: true });
  await writeFile(
    path.join(root, 'src/navigation/RootNavigator.tsx'),
    "import { NavigationContainer } from '@react-navigation/native';\n",
  );

  const result = await detectExistingNavigation(await detectProject(root));

  assert.deepEqual(result.libraries, ['react-navigation']);
  assert.equal(result.primary, 'react-navigation');
  assert.ok(result.evidence['react-navigation']?.includes('dependency:@react-navigation/native'));
});

void test('reports no navigation when no dependency or source signal exists', async () => {
  const root = await createApp({
    name: 'plain-app',
    dependencies: { 'react-native': '0.83.0' },
  });

  assert.deepEqual(await detectExistingNavigation(await detectProject(root)), {
    libraries: [],
    evidence: {},
  });
});
