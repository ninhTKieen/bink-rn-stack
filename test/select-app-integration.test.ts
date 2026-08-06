import assert from 'node:assert/strict';
import { test } from 'node:test';

import { selectAppIntegration } from '@/cli/prompts/select-app-integration.js';

void test('uses automatic integration when explicitly enabled', async () => {
  assert.equal(await selectAppIntegration(['tanstack-query'], true), 'automatic');
});

void test('uses manual integration when explicitly disabled', async () => {
  assert.equal(await selectAppIntegration(['tanstack-query'], false), 'manual');
});

void test('defaults to manual integration outside an interactive terminal', async () => {
  assert.equal(await selectAppIntegration(['tanstack-query']), 'manual');
});

void test('does not request integration for modules without app changes', async () => {
  assert.equal(await selectAppIntegration(['axios', 'react-hook-form']), 'manual');
});
