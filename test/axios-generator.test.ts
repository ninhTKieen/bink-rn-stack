import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AXIOS_GENERATED_FILES } from '@/generators/axios/axios-generator.constants.js';
import {
  createAxiosFileRecipes,
  renderAxiosFoundation,
} from '@/generators/axios/axios-generator.js';

void test('renders a configured Axios client with normalized errors and auth support', async () => {
  const files = await renderAxiosFoundation({
    apiBaseUrl: 'https://api.example.com/v1?client="mobile"',
    timeoutMs: 20_000,
  });
  const contentsByPath = new Map(files.map(({ path, content }) => [path, content]));

  assert.deepEqual(
    files.map(({ path }) => path),
    AXIOS_GENERATED_FILES,
  );
  assert.match(
    contentsByPath.get('src/api/config.ts') ?? '',
    /API_BASE_URL = "https:\/\/api\.example\.com\/v1\?client=\\"mobile\\""/,
  );
  assert.match(contentsByPath.get('src/api/config.ts') ?? '', /API_TIMEOUT_MS = 20000/);
  assert.match(contentsByPath.get('src/api/client.ts') ?? '', /axios\.create/);
  assert.match(
    contentsByPath.get('src/api/client.ts') ?? '',
    /setAuthorizationToken\(token: string \| null\)/,
  );
  assert.match(contentsByPath.get('src/api/errors.ts') ?? '', /axios\.isAxiosError/);
  assert.match(contentsByPath.get('src/api/errors.ts') ?? '', /class ApiError extends Error/);
  assert.ok(files.every(({ content }) => !content.includes('{{')));
});

void test('supports a custom relative source root', () => {
  const recipes = createAxiosFileRecipes({ sourceRoot: 'app' });

  assert.ok(recipes.every(({ destination }) => destination.startsWith('app/')));
});

void test('rejects invalid timeout values', () => {
  assert.throws(
    () => createAxiosFileRecipes({ timeoutMs: 0 }),
    /Axios timeout must be a positive integer/,
  );
  assert.throws(
    () => createAxiosFileRecipes({ timeoutMs: 10.5 }),
    /Axios timeout must be a positive integer/,
  );
});

void test('rejects source roots outside the target project', () => {
  assert.throws(
    () => createAxiosFileRecipes({ sourceRoot: '../outside' }),
    /Source root must be a relative project path/,
  );
});
