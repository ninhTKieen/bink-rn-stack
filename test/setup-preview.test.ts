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
