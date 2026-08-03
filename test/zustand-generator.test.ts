import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ZUSTAND_GENERATED_FILES } from '@/generators/zustand/zustand-generator.constants.js';
import {
  createZustandFileRecipes,
  renderZustandFoundation,
} from '@/generators/zustand/zustand-generator.js';

void test('renders the standalone Zustand MMKV persistence foundation', async () => {
  const files = await renderZustandFoundation({ storageId: 'zustand-preferences' });

  assert.deepEqual(
    files.map(({ path }) => path),
    ZUSTAND_GENERATED_FILES,
  );
  assert.match(files[0]?.content ?? '', /createMMKV/);
  assert.match(files[0]?.content ?? '', /id: 'zustand-preferences'/);
  assert.match(files[0]?.content ?? '', /StateStorage/);
});

void test('supports a custom relative source root', () => {
  const recipes = createZustandFileRecipes({ sourceRoot: 'app' });

  assert.equal(recipes[0]?.destination, 'app/stores/mmkvStorage.ts');
});

void test('rejects source roots outside the target project', () => {
  assert.throws(
    () => createZustandFileRecipes({ sourceRoot: '../outside' }),
    /Source root must be a relative project path/,
  );
});
