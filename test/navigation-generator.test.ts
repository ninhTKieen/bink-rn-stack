import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createNavigationFileRecipes,
  renderNavigationFoundation,
} from '@/generators/navigation/navigation-generator.js';

void test('renders a typed React Navigation native stack', async () => {
  const files = await renderNavigationFoundation({
    library: 'react-navigation',
    selectedModules: ['navigation'],
  });
  const contentsByPath = new Map(files.map(({ path, content }) => [path, content]));

  assert.deepEqual(
    files.map(({ path }) => path),
    [
      'src/navigation/RootNavigator.tsx',
      'src/navigation/types.ts',
      'src/navigation/index.ts',
      'src/screens/HomeScreen.tsx',
    ],
  );
  assert.match(
    contentsByPath.get('src/navigation/RootNavigator.tsx') ?? '',
    /createNativeStackNavigator<RootStackParamList>/u,
  );
  assert.match(
    contentsByPath.get('src/navigation/RootNavigator.tsx') ?? '',
    /<NavigationContainer>/u,
  );
  assert.ok(files.every(({ content }) => !content.includes('{{')));
});

void test('renders an Expo Router root that composes selected foundations', async () => {
  const files = await renderNavigationFoundation({
    library: 'expo-router',
    selectedModules: ['navigation', 'unistyles', 'tanstack-query', 'i18n'],
  });
  const layout = files.find(({ path }) => path === 'src/app/_layout.tsx')?.content ?? '';

  assert.deepEqual(
    files.map(({ path }) => path),
    ['src/app/_layout.tsx', 'src/app/index.tsx'],
  );
  assert.match(layout, /import '\.\.\/theme\/unistyles';/u);
  assert.match(layout, /import '\.\.\/i18n\/config';/u);
  assert.match(layout, /import \{ AppProviders \} from '\.\.\/providers';/u);
  assert.match(layout, /<AppProviders>\{navigator\}<\/AppProviders>/u);
  assert.match(layout, /import \{ Stack \} from 'expo-router';/u);
});

void test('supports a custom source root', () => {
  const recipes = createNavigationFileRecipes({
    library: 'expo-router',
    selectedModules: ['navigation'],
    sourceRoot: 'app-src',
  });

  assert.ok(recipes.every(({ destination }) => destination.startsWith('app-src/')));
});
