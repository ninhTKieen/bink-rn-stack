import assert from 'node:assert/strict';
import { test } from 'node:test';

import { renderI18nFoundation } from '@/generators/i18n/i18n-generator.js';
import { UNISTYLES_GENERATED_FILES } from '@/generators/unistyles/unistyles-generator.constants.js';
import {
  createUnistylesFileRecipes,
  renderUnistylesFoundation,
} from '@/generators/unistyles/unistyles-generator.js';
import { STACK_MODULES } from '@/modules/stack-module.js';

void test('renders typed themes, breakpoints, and persisted theme state', async () => {
  const files = await renderUnistylesFoundation({ storageId: 'sample-app-preferences' });
  const contentsByPath = new Map(files.map(({ path, content }) => [path, content]));

  assert.deepEqual(
    files.map(({ path }) => path),
    UNISTYLES_GENERATED_FILES,
  );
  assert.match(contentsByPath.get('src/theme/themes.ts') ?? '', /satisfies AppTheme/);
  assert.match(contentsByPath.get('src/theme/breakpoints.ts') ?? '', /xs: 0/);
  assert.match(
    contentsByPath.get('src/theme/unistyles.d.ts') ?? '',
    /interface UnistylesThemes extends AppThemes/,
  );
  assert.match(contentsByPath.get('src/theme/unistyles.ts') ?? '', /StyleSheet\.configure/);
  assert.match(contentsByPath.get('src/theme/unistyles.ts') ?? '', /adaptiveThemes: true/);
  assert.match(contentsByPath.get('src/theme/unistyles.ts') ?? '', /initialTheme: themePreference/);
  assert.match(
    contentsByPath.get('src/stores/themeStore.ts') ?? '',
    /UnistylesRuntime\.setAdaptiveThemes\(true\)/,
  );
  assert.match(
    contentsByPath.get('src/stores/themeStore.ts') ?? '',
    /UnistylesRuntime\.setTheme\(preference as never\)/,
  );
  assert.match(contentsByPath.get('src/stores/themeStore.ts') ?? '', /export interface ThemeState/);
  assert.ok(!contentsByPath.has('src/stores/themeStore.types.ts'));
  assert.match(
    contentsByPath.get('src/stores/mmkvStorage.ts') ?? '',
    /id: 'sample-app-preferences'/,
  );
  assert.ok(files.every(({ content }) => !content.includes('{{')));
});

void test('shares the same MMKV foundation with the i18n generator', async () => {
  const storageId = 'shared-preferences';
  const [unistylesFiles, i18nFiles] = await Promise.all([
    renderUnistylesFoundation({ storageId }),
    renderI18nFoundation({ projectKind: 'expo', storageId }),
  ]);
  const unistylesStorage = unistylesFiles.find(({ path }) => path === 'src/stores/mmkvStorage.ts');
  const i18nStorage = i18nFiles.find(({ path }) => path === 'src/stores/mmkvStorage.ts');

  assert.ok(unistylesStorage !== undefined);
  assert.ok(i18nStorage !== undefined);
  assert.equal(unistylesStorage.content, i18nStorage.content);
});

void test('uses only required Unistyles dependencies', () => {
  const definition = STACK_MODULES.find(({ name }) => name === 'unistyles');

  assert.deepEqual(definition?.dependencies, [
    'react-native-unistyles',
    'react-native-nitro-modules',
    '@react-native/normalize-colors',
    'zustand',
    'react-native-mmkv',
  ]);
});

void test('supports a custom relative source root', () => {
  const recipes = createUnistylesFileRecipes({ sourceRoot: 'app' });

  assert.ok(recipes.every(({ destination }) => destination.startsWith('app/')));
});

void test('rejects source roots outside the target project', () => {
  assert.throws(
    () => createUnistylesFileRecipes({ sourceRoot: '/outside' }),
    /Source root must be a relative project path/,
  );
});
