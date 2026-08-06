import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';

import { formatDoctorReport } from '@/cli/output/format-doctor-report.js';
import { CLI_VERSION } from '@/configs/constants.js';
import { doctorProject } from '@/core/doctor.js';
import { detectProject } from '@/core/detect-project.js';
import type { GenerationManifest } from '@/core/generation-manifest.types.js';

const temporaryDirectories: string[] = [];

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function createApp(dependencies: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bink-doctor-'));
  temporaryDirectories.push(root);
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify(
      {
        name: 'doctor-app',
        packageManager: 'yarn@1.22.22',
        dependencies: { 'react-native': '0.86.0', ...dependencies },
      },
      null,
      2,
    ),
  );
  return root;
}

async function writeTrackedFile(root: string, filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(path.join(root, filePath)), { recursive: true });
  await writeFile(path.join(root, filePath), content);
}

async function writeManifest(root: string, manifest: GenerationManifest): Promise<void> {
  await writeFile(path.join(root, '.bink-rn-stack.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

void afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

void test('reports a healthy initialized project', async () => {
  const root = await createApp({ axios: '^1.0.0' });
  const generated = 'export const api = {};\n';
  await writeTrackedFile(root, 'src/api/client.ts', generated);
  await writeManifest(root, {
    version: CLI_VERSION,
    modules: ['axios'],
    files: { 'src/api/client.ts': hash(generated) },
    integrations: {},
  });

  const report = await doctorProject(await detectProject(root));

  assert.equal(report.healthy, true);
  assert.deepEqual(report.summary, { passed: 7, warnings: 0, errors: 0 });
  assert.ok(report.checks.every(({ status }) => status === 'pass'));
  assert.match(formatDoctorReport(report), /Summary: 7 passed, 0 warnings, 0 errors/u);
});

void test('reports missing dependencies and generated files as errors', async () => {
  const root = await createApp({});
  await writeManifest(root, {
    version: CLI_VERSION,
    modules: ['axios', 'tanstack-query'],
    files: {
      'src/api/client.ts': hash('missing'),
      'src/query/queryClient.ts': hash('missing'),
    },
    integrations: {},
  });

  const report = await doctorProject(await detectProject(root));
  const dependencies = report.checks.find(({ id }) => id === 'dependencies');
  const files = report.checks.find(({ id }) => id === 'generated-files');

  assert.equal(report.healthy, false);
  assert.equal(dependencies?.status, 'error');
  assert.deepEqual(dependencies?.details, ['axios', '@tanstack/react-query']);
  assert.equal(files?.status, 'error');
  assert.deepEqual(files?.details, ['src/api/client.ts', 'src/query/queryClient.ts']);
});

void test('reports generated and integrated file drift as warnings', async () => {
  const root = await createApp({ axios: '^1.0.0' });
  await writeTrackedFile(root, 'src/api/client.ts', 'custom generated file\n');
  await writeTrackedFile(root, 'App.tsx', 'custom app root\n');
  await writeManifest(root, {
    version: '0.0.1',
    modules: ['axios'],
    files: { 'src/api/client.ts': hash('original generated file\n') },
    integrations: { 'App.tsx': hash('original app root\n') },
  });

  const report = await doctorProject(await detectProject(root));

  assert.equal(report.healthy, true);
  assert.equal(report.summary.errors, 0);
  assert.equal(report.summary.warnings, 3);
  assert.equal(report.checks.find(({ id }) => id === 'generated-files')?.status, 'warning');
  assert.equal(report.checks.find(({ id }) => id === 'integrated-files')?.status, 'warning');
});

void test('reports missing and invalid manifests', async () => {
  const missingRoot = await createApp({});
  const missing = await doctorProject(await detectProject(missingRoot));
  assert.equal(missing.checks.find(({ id }) => id === 'manifest')?.status, 'error');

  const invalidRoot = await createApp({});
  await writeFile(path.join(invalidRoot, '.bink-rn-stack.json'), '{invalid');
  const invalid = await doctorProject(await detectProject(invalidRoot));
  assert.equal(invalid.checks.find(({ id }) => id === 'manifest')?.status, 'error');
});

void test('rejects unsafe paths stored in the manifest', async () => {
  const root = await createApp({ axios: '^1.0.0' });
  await writeManifest(root, {
    version: CLI_VERSION,
    modules: ['axios'],
    files: { '../outside.ts': hash('unsafe') },
    integrations: {},
  });

  const report = await doctorProject(await detectProject(root));
  const files = report.checks.find(({ id }) => id === 'generated-files');

  assert.equal(files?.status, 'error');
  assert.deepEqual(files?.details, ['../outside.ts']);
});
