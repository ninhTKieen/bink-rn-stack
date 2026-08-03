import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TANSTACK_QUERY_GENERATED_FILES } from '@/generators/tanstack-query/tanstack-query-generator.constants.js';
import {
  createTanstackQueryFileRecipes,
  renderTanstackQueryFoundation,
} from '@/generators/tanstack-query/tanstack-query-generator.js';

void test('renders a React Native-aware TanStack Query client and provider', async () => {
  const files = await renderTanstackQueryFoundation();
  const contentsByPath = new Map(files.map(({ path, content }) => [path, content]));

  assert.deepEqual(
    files.map(({ path }) => path),
    TANSTACK_QUERY_GENERATED_FILES,
  );
  assert.match(contentsByPath.get('src/query/queryClient.ts') ?? '', /new QueryClient/);
  assert.match(contentsByPath.get('src/query/queryClient.ts') ?? '', /gcTime: 5 \* MINUTE/);
  assert.match(contentsByPath.get('src/query/queryClient.ts') ?? '', /retry: 2/);
  assert.match(
    contentsByPath.get('src/providers/QueryProvider.tsx') ?? '',
    /AppState\.addEventListener\('change', onAppStateChange\)/,
  );
  assert.match(
    contentsByPath.get('src/providers/QueryProvider.tsx') ?? '',
    /focusManager\.setFocused\(status === 'active'\)/,
  );
  assert.match(
    contentsByPath.get('src/providers/QueryProvider.tsx') ?? '',
    /<QueryClientProvider client=\{queryClient\}>/,
  );
  assert.doesNotMatch(contentsByPath.get('src/providers/QueryProvider.tsx') ?? '', /NetInfo/);
});

void test('supports a custom relative source root', () => {
  const recipes = createTanstackQueryFileRecipes({ sourceRoot: 'app' });

  assert.ok(recipes.every(({ destination }) => destination.startsWith('app/')));
});

void test('rejects source roots outside the target project', () => {
  assert.throws(
    () => createTanstackQueryFileRecipes({ sourceRoot: '/outside' }),
    /Source root must be a relative project path/,
  );
});
