import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';

import { formatSetupPreview } from '@/cli/output/format-setup-preview.js';
import { detectProject } from '@/core/detect-project.js';
import { buildSetupPreview } from '@/core/setup-preview.js';
import { renderAxiosFoundation } from '@/generators/axios/axios-generator.js';

const temporaryDirectories: string[] = [];

async function createApp(packageJson: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bink-preview-'));
  temporaryDirectories.push(root);
  await writeFile(path.join(root, 'package.json'), JSON.stringify(packageJson, null, 2));
  return root;
}

void afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

void test('previews missing dependencies, installed dependencies, and file conflicts', async () => {
  const root = await createApp({
    name: 'preview-app',
    packageManager: 'yarn@4.9.2',
    dependencies: {
      axios: '^1.0.0',
      expo: '^55.0.0',
      'react-native': '0.83.0',
    },
  });
  await mkdir(path.join(root, 'src/api'), { recursive: true });
  await writeFile(path.join(root, 'src/api/client.ts'), 'export {};\n');
  const project = await detectProject(root);

  const preview = await buildSetupPreview(project, ['axios', 'i18n']);

  assert.deepEqual(
    preview.dependencies.map(({ name, status }) => [name, status]),
    [
      ['axios', 'existing'],
      ['i18next', 'install'],
      ['react-i18next', 'install'],
      ['zustand', 'install'],
      ['react-native-mmkv', 'install'],
      ['react-native-nitro-modules', 'install'],
      ['expo-localization', 'install'],
    ],
  );
  assert.equal(
    preview.installCommand,
    'yarn add i18next react-i18next zustand react-native-mmkv react-native-nitro-modules expo-localization',
  );
  assert.equal(
    preview.files.find(({ path: filePath }) => filePath === 'src/api/client.ts')?.status,
    'conflict',
  );
  assert.deepEqual(preview.nativeSteps, [
    'Create a new Expo development build after native dependencies are installed.',
  ]);
  assert.ok(preview.warnings.some((warning) => warning.includes('will not be overwritten')));

  const output = formatSetupPreview(preview);
  assert.match(output, /Setup preview/);
  assert.match(output, /= axios \(already installed\)/);
  assert.match(output, /├── client\.ts \(already exists with different content\)/);
});

void test('uses the bare React Native localization dependency and npm command', async () => {
  const root = await createApp({
    name: 'native-preview',
    dependencies: {
      'react-native': '0.83.0',
    },
  });
  await writeFile(path.join(root, 'package-lock.json'), '{}');
  const project = await detectProject(root);

  const preview = await buildSetupPreview(project, ['i18n']);

  assert.ok(preview.dependencies.some(({ name }) => name === 'react-native-localize'));
  assert.ok(!preview.dependencies.some(({ name }) => name === 'expo-localization'));
  assert.match(preview.installCommand ?? '', /^npm install /);
  assert.deepEqual(preview.nativeSteps, [
    'Run CocoaPods on iOS and rebuild the native application.',
  ]);
});

void test('recognizes generated files whose contents are already up to date', async () => {
  const root = await createApp({
    name: 'unchanged-preview',
    dependencies: {
      'react-native': '0.83.0',
    },
  });
  await writeFile(path.join(root, 'package-lock.json'), '{}');
  await mkdir(path.join(root, 'src/api'), { recursive: true });
  const renderedFiles = await renderAxiosFoundation();
  const generatedConfig = renderedFiles.find(
    ({ path: filePath }) => filePath === 'src/api/config.ts',
  );
  assert.ok(generatedConfig !== undefined);
  await writeFile(path.join(root, generatedConfig.path), generatedConfig.content);
  const project = await detectProject(root);

  const preview = await buildSetupPreview(project, ['axios']);
  const configPreview = preview.files.find(
    ({ path: filePath }) => filePath === 'src/api/config.ts',
  );

  assert.equal(configPreview?.status, 'unchanged');
  assert.ok(!preview.warnings.some((warning) => warning.includes('will not be overwritten')));
  assert.match(formatSetupPreview(preview), /config\.ts \(unchanged\)/);
});

void test('defaults bare React Native navigation to the latest React Navigation packages', async () => {
  const root = await createApp({
    name: 'native-navigation-preview',
    dependencies: {
      'react-native': '0.83.0',
    },
  });
  await writeFile(path.join(root, 'yarn.lock'), '');

  const preview = await buildSetupPreview(await detectProject(root), ['navigation']);

  assert.equal(preview.navigation, 'react-navigation');
  assert.deepEqual(
    preview.dependencies.map(({ name }) => name),
    [
      '@react-navigation/native',
      '@react-navigation/native-stack',
      'react-native-screens',
      'react-native-safe-area-context',
    ],
  );
  assert.ok(
    preview.files.some(({ path: filePath }) => filePath === 'src/navigation/RootNavigator.tsx'),
  );
  assert.match(preview.installCommand ?? '', /^yarn add @react-navigation\/native /u);
});

void test('previews Expo Router dependencies, routes, and integration', async () => {
  const root = await createApp({
    name: 'expo-router-preview',
    packageManager: 'pnpm@10.0.0',
    dependencies: {
      expo: '^57.0.0',
      'react-native': '0.86.0',
    },
  });

  const preview = await buildSetupPreview(await detectProject(root), ['navigation'], {
    navigation: 'expo-router',
  });

  assert.equal(preview.navigation, 'expo-router');
  assert.deepEqual(
    preview.dependencies.map(({ name }) => name),
    [
      'expo-router',
      'react-native-safe-area-context',
      'react-native-screens',
      'expo-linking',
      'expo-constants',
      'expo-status-bar',
    ],
  );
  assert.deepEqual(
    preview.files.map(({ path: filePath }) => filePath),
    ['src/app/_layout.tsx', 'src/app/index.tsx'],
  );
  assert.match(preview.installCommand ?? '', /^pnpm add expo-router /u);
  assert.ok(preview.integrationSteps.some((step) => step.includes('expo-router/entry')));
});

void test('preserves existing navigation without installing or generating it again', async () => {
  const root = await createApp({
    name: 'existing-router-preview',
    main: 'expo-router/entry',
    packageManager: 'yarn@1.22.22',
    dependencies: {
      expo: '^57.0.0',
      'expo-router': '^57.0.0',
      'react-native': '0.86.0',
    },
  });

  const preview = await buildSetupPreview(
    await detectProject(root),
    ['navigation', 'tanstack-query'],
    { navigation: 'keep' },
  );

  assert.equal(preview.navigation, 'keep');
  assert.equal(preview.navigationReplacement, false);
  assert.deepEqual(preview.existingNavigation?.libraries, ['expo-router']);
  assert.deepEqual(
    preview.dependencies.map(({ name }) => name),
    ['@tanstack/react-query'],
  );
  assert.ok(!preview.files.some(({ path: filePath }) => filePath.startsWith('src/app/')));
  assert.ok(
    preview.integrationSteps.includes(
      'Keep the existing navigation dependencies and source files.',
    ),
  );
  assert.ok(preview.integrationSteps.includes('Wrap the application root with AppProviders.'));
});

void test('marks regeneration or switching as an explicit replacement', async () => {
  const root = await createApp({
    name: 'router-replacement-preview',
    main: 'expo-router/entry',
    packageManager: 'yarn@1.22.22',
    dependencies: {
      expo: '^57.0.0',
      'expo-router': '^57.0.0',
      'react-native': '0.86.0',
    },
  });

  const preview = await buildSetupPreview(await detectProject(root), ['navigation'], {
    navigation: 'react-navigation',
  });

  assert.equal(preview.navigationReplacement, true);
  assert.ok(
    preview.warnings.some((warning) =>
      warning.includes('only be regenerated or switched with --force'),
    ),
  );
  assert.ok(preview.files.some(({ path: filePath }) => filePath.startsWith('src/navigation/')));
});
