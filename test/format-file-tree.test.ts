import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatFileTree } from '@/cli/output/format-file-tree.js';

void test('formats generated files as a sorted directory tree', () => {
  const output = formatFileTree([
    { path: 'src/providers/QueryProvider.tsx', status: 'create', requestedBy: ['tanstack-query'] },
    { path: 'src/api/index.ts', status: 'create', requestedBy: ['axios'] },
    { path: 'src/api/client.ts', status: 'conflict', requestedBy: ['axios'] },
    { path: 'src/providers/AppProviders.tsx', status: 'create', requestedBy: ['tanstack-query'] },
  ]);

  assert.deepEqual(output, [
    'src/',
    '├── api/',
    '│   ├── client.ts (already exists with different content)',
    '│   └── index.ts',
    '└── providers/',
    '    ├── AppProviders.tsx',
    '    └── QueryProvider.tsx',
  ]);
});
