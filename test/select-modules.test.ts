import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ModuleSelectionError, parseModuleOption } from '@/cli/prompts/select-modules.js';

void test('selects every module with the all option', () => {
  assert.deepEqual(parseModuleOption('all'), [
    'navigation',
    'axios',
    'unistyles',
    'zustand',
    'react-hook-form',
    'tanstack-query',
    'i18n',
  ]);
});

void test('parses, deduplicates, and canonically orders selected modules', () => {
  assert.deepEqual(parseModuleOption('i18n, axios, i18n, zustand'), ['axios', 'zustand', 'i18n']);
});

void test('rejects unknown modules', () => {
  assert.throws(
    () => parseModuleOption('axios,redux'),
    (error: unknown) =>
      error instanceof ModuleSelectionError && error.message.includes('Unknown module: redux'),
  );
});

void test('rejects combining all with individual modules', () => {
  assert.throws(
    () => parseModuleOption('all,axios'),
    (error: unknown) =>
      error instanceof ModuleSelectionError &&
      error.message === 'The all option cannot be combined with individual modules.',
  );
});
