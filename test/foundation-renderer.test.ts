import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  FoundationFileConflictError,
  mergeFoundationFileContributions,
  renderSelectedFoundations,
} from '@/generators/foundation-renderer.js';

void test('renders and composes every selected foundation without duplicate paths', async () => {
  const foundation = await renderSelectedFoundations({
    projectKind: 'expo',
    selectedModules: ['i18n', 'tanstack-query', 'axios', 'zustand', 'unistyles'],
    storageId: 'integrated-preferences',
    apiBaseUrl: 'https://api.integration.test',
  });
  const paths = foundation.files.map(({ path }) => path);

  assert.deepEqual(foundation.selectedModules, [
    'axios',
    'unistyles',
    'zustand',
    'tanstack-query',
    'i18n',
  ]);
  assert.equal(paths.length, new Set(paths).size);

  const storage = foundation.files.find(({ path }) => path === 'src/stores/mmkvStorage.ts');
  assert.deepEqual(storage?.requestedBy, ['unistyles', 'zustand', 'i18n']);
  assert.match(storage?.content ?? '', /id: 'integrated-preferences'/);

  const appProviders = foundation.files.find(
    ({ path }) => path === 'src/providers/AppProviders.tsx',
  );
  assert.deepEqual(appProviders?.requestedBy, ['tanstack-query']);
  assert.match(appProviders?.content ?? '', /<QueryProvider>\{children\}<\/QueryProvider>/);

  const providersIndex = foundation.files.find(({ path }) => path === 'src/providers/index.ts');
  assert.match(providersIndex?.content ?? '', /export \{ AppProviders \}/);
  assert.match(providersIndex?.content ?? '', /export \{ QueryProvider \}/);

  const storesIndex = foundation.files.find(({ path }) => path === 'src/stores/index.ts');
  assert.deepEqual(storesIndex?.requestedBy, ['unistyles', 'zustand', 'i18n']);
  assert.match(storesIndex?.content ?? '', /useLanguageStore/);
  assert.match(storesIndex?.content ?? '', /useThemeStore/);
  assert.match(storesIndex?.content ?? '', /mmkvStorage/);
});

void test('keeps standalone Zustand scoped to the shared storage foundation', async () => {
  const foundation = await renderSelectedFoundations({
    projectKind: 'react-native',
    selectedModules: ['zustand'],
  });

  assert.deepEqual(
    foundation.files.map(({ path }) => path),
    ['src/stores/mmkvStorage.ts', 'src/stores/index.ts'],
  );
  assert.doesNotMatch(foundation.files[1]?.content ?? '', /themeStore|languageStore/);
});

void test('forwards a custom source root to module and composition files', async () => {
  const foundation = await renderSelectedFoundations({
    projectKind: 'expo',
    selectedModules: ['tanstack-query', 'i18n'],
    sourceRoot: 'app',
  });

  assert.ok(foundation.files.every(({ path }) => path.startsWith('app/')));
});

void test('deduplicates identical contributions and records every requesting module', () => {
  const files = mergeFoundationFileContributions([
    { path: 'src/shared.ts', content: 'same\n', requestedBy: 'i18n' },
    { path: 'src/shared.ts', content: 'same\n', requestedBy: 'unistyles' },
    { path: 'src/shared.ts', content: 'same\n', requestedBy: 'i18n' },
  ]);

  assert.deepEqual(files, [
    {
      path: 'src/shared.ts',
      content: 'same\n',
      requestedBy: ['i18n', 'unistyles'],
    },
  ]);
});

void test('rejects duplicate paths with different generated contents', () => {
  assert.throws(
    () =>
      mergeFoundationFileContributions([
        { path: 'src/shared.ts', content: 'first\n', requestedBy: 'i18n' },
        { path: 'src/shared.ts', content: 'second\n', requestedBy: 'unistyles' },
      ]),
    (error: unknown) =>
      error instanceof FoundationFileConflictError && error.path === 'src/shared.ts',
  );
});
