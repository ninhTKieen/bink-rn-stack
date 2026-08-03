import assert from 'node:assert/strict';
import { test } from 'node:test';

import { I18N_GENERATED_FILES } from '@/generators/i18n/i18n-generator.constants.js';
import { createI18nFileRecipes, renderI18nFoundation } from '@/generators/i18n/i18n-generator.js';

void test('renders the Expo i18n foundation with typed resources and MMKV persistence', async () => {
  const files = await renderI18nFoundation({
    projectKind: 'expo',
    storageId: 'sample-app-preferences',
  });
  const contentsByPath = new Map(files.map(({ path, content }) => [path, content]));

  assert.deepEqual(
    files.map(({ path }) => path),
    I18N_GENERATED_FILES,
  );
  assert.match(contentsByPath.get('src/i18n/config.ts') ?? '', /from 'expo-localization'/);
  assert.doesNotMatch(
    contentsByPath.get('src/i18n/config.ts') ?? '',
    /from 'react-native-localize'/,
  );
  assert.match(contentsByPath.get('src/i18n/config.ts') ?? '', /initAsync: false/);
  assert.doesNotMatch(contentsByPath.get('src/i18n/config.ts') ?? '', /initImmediate/);
  assert.match(
    contentsByPath.get('src/i18n/types.ts') ?? '',
    /export type SupportedLanguage = 'en'/,
  );
  assert.match(
    contentsByPath.get('src/stores/mmkvStorage.ts') ?? '',
    /id: 'sample-app-preferences'/,
  );
  assert.match(
    contentsByPath.get('src/stores/languageStore.ts') ?? '',
    /void i18n\.changeLanguage\(language\)/,
  );
  assert.match(
    contentsByPath.get('src/stores/languageStore.ts') ?? '',
    /createJSONStorage\(\(\) => mmkvStorage\)/,
  );
  assert.deepEqual(JSON.parse(contentsByPath.get('src/i18n/locales/en.json') ?? ''), {
    common: {
      loading: 'Loading...',
      error: 'Something went wrong',
    },
    language: {
      english: 'English',
    },
  });
  assert.ok(files.every(({ content }) => !content.includes('{{')));
});

void test('renders react-native-localize for bare React Native projects', async () => {
  const files = await renderI18nFoundation({ projectKind: 'react-native' });
  const config = files.find(({ path }) => path === 'src/i18n/config.ts')?.content ?? '';

  assert.match(config, /from 'react-native-localize'/);
  assert.doesNotMatch(config, /from 'expo-localization'/);
});

void test('supports a custom relative source root', () => {
  const recipes = createI18nFileRecipes({
    projectKind: 'expo',
    sourceRoot: 'app',
  });

  assert.ok(recipes.every(({ destination }) => destination.startsWith('app/')));
});

void test('rejects source roots outside the target project', () => {
  assert.throws(
    () => createI18nFileRecipes({ projectKind: 'expo', sourceRoot: '../outside' }),
    /Source root must be a relative project path/,
  );
});
