import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';

import { detectProject } from '@/core/detect-project.js';
import { FoundationWriteConflictError } from '@/core/foundation-writer.js';
import type { GenerationManifest } from '@/core/generation-manifest.types.js';
import { executeSetupPlan } from '@/core/setup-executor.js';
import { buildSetupPlan } from '@/core/setup-preview.js';

const temporaryDirectories: string[] = [];

async function createExpoApp(dependencies: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bink-executor-'));
  temporaryDirectories.push(root);
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'executor-app',
      packageManager: 'yarn@1.22.22',
      dependencies: { expo: '^55.0.0', 'react-native': '0.83.0', ...dependencies },
    }),
  );
  return root;
}

void afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

void test('writes generated files and the generation manifest', async () => {
  const root = await createExpoApp({ axios: '^1.0.0' });
  const plan = await buildSetupPlan(await detectProject(root), ['axios']);

  const result = await executeSetupPlan(plan, '1.2.3');

  assert.equal(result.installedDependencies.length, 0);
  assert.ok(result.files.created.includes('src/api/client.ts'));
  await access(path.join(root, 'src/api/client.ts'));
  const manifest = JSON.parse(
    await readFile(path.join(root, '.bink-rn-stack.json'), 'utf8'),
  ) as GenerationManifest;
  assert.equal(manifest.version, '1.2.3');
  assert.deepEqual(manifest.modules, ['axios']);
  assert.match(manifest.files['src/api/client.ts'] ?? '', /^[a-f0-9]{64}$/u);
});

void test('blocks file conflicts before running dependency installation', async () => {
  const root = await createExpoApp({});
  await mkdir(path.join(root, 'src/api'), { recursive: true });
  await writeFile(path.join(root, 'src/api/client.ts'), 'user content\n');
  const plan = await buildSetupPlan(await detectProject(root), ['axios']);
  let installCalls = 0;

  await assert.rejects(
    executeSetupPlan(plan, '1.2.3', {
      commandRunner: () => {
        installCalls += 1;
        return Promise.resolve();
      },
    }),
    FoundationWriteConflictError,
  );

  assert.equal(installCalls, 0);
  await assert.rejects(access(path.join(root, '.bink-rn-stack.json')));
});

void test('installs dependencies before generating source files', async () => {
  const root = await createExpoApp({});
  const plan = await buildSetupPlan(await detectProject(root), ['axios']);
  let filesExistedDuringInstall = true;

  const result = await executeSetupPlan(plan, '1.2.3', {
    commandRunner: async () => {
      try {
        await access(path.join(root, 'src/api/client.ts'));
      } catch {
        filesExistedDuringInstall = false;
      }
    },
  });

  assert.equal(filesExistedDuringInstall, false);
  assert.deepEqual(result.installedDependencies, ['axios']);
  await access(path.join(root, 'src/api/client.ts'));
});

void test('does not generate files when dependency installation fails', async () => {
  const root = await createExpoApp({});
  const plan = await buildSetupPlan(await detectProject(root), ['axios']);

  await assert.rejects(
    executeSetupPlan(plan, '1.2.3', {
      commandRunner: () => Promise.reject(new Error('simulated install failure')),
    }),
    /simulated install failure/u,
  );

  await assert.rejects(access(path.join(root, 'src/api/client.ts')));
  await assert.rejects(access(path.join(root, '.bink-rn-stack.json')));
});
