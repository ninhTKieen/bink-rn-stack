import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';

import type { CommandRunner } from '@/core/dependency-installer.types.js';
import { detectProject } from '@/core/detect-project.js';
import type { GenerationManifest } from '@/core/generation-manifest.types.js';
import {
  buildLifecyclePlan,
  executeLifecyclePlan,
  LifecycleConflictError,
  LifecycleIntegrationCleanupError,
  resolveLifecycleModules,
} from '@/core/lifecycle.js';
import { executeSetupPlan, SetupTransactionError } from '@/core/setup-executor.js';
import { buildSetupPlan } from '@/core/setup-preview.js';

const temporaryDirectories: string[] = [];

async function createExpoApp(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bink-lifecycle-'));
  temporaryDirectories.push(root);
  await writeFile(
    path.join(root, 'package.json'),
    `${JSON.stringify({
      name: 'lifecycle-app',
      packageManager: 'yarn@1.22.22',
      dependencies: { expo: '^55.0.0', 'react-native': '0.83.0' },
    })}\n`,
  );
  return root;
}

function packageRunner(root: string): CommandRunner {
  return async (_command, args) => {
    const packageJsonPath = path.join(root, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      dependencies: Record<string, string>;
    };
    const action = args[0];
    for (const dependency of args.slice(1)) {
      if (action === 'add') packageJson.dependencies[dependency] = '*';
      else if (action === 'remove') delete packageJson.dependencies[dependency];
    }
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson)}\n`);
  };
}

async function initialize(
  root: string,
  modules: Parameters<typeof buildSetupPlan>[1],
  appIntegration: 'automatic' | 'manual' = 'manual',
): Promise<void> {
  const project = await detectProject(root);
  const plan = await buildSetupPlan(project, modules, { appIntegration });
  await executeSetupPlan(plan, '1.0.0', { commandRunner: packageRunner(root) });
}

async function readManifest(root: string): Promise<GenerationManifest> {
  return JSON.parse(
    await readFile(path.join(root, '.bink-rn-stack.json'), 'utf8'),
  ) as GenerationManifest;
}

void afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

void test('adds a module while preserving and recomposing the tracked stack', async () => {
  const root = await createExpoApp();
  await initialize(root, ['axios']);
  const project = await detectProject(root);
  const modulesAfter = resolveLifecycleModules('add', ['axios'], ['tanstack-query']);
  const plan = await buildLifecyclePlan('add', project, modulesAfter, {
    appIntegration: 'manual',
  });

  const result = await executeLifecyclePlan(plan, '2.0.0', {
    commandRunner: packageRunner(root),
  });

  assert.deepEqual(result.installedDependencies, ['@tanstack/react-query']);
  await access(path.join(root, 'src/api/client.ts'));
  await access(path.join(root, 'src/providers/AppProviders.tsx'));
  const manifest = await readManifest(root);
  assert.deepEqual(manifest.modules, ['axios', 'tanstack-query']);
  assert.deepEqual(manifest.managedDependencies, ['@tanstack/react-query', 'axios']);
});

void test('updates clean tracked output and protects drift unless forced', async () => {
  const root = await createExpoApp();
  await initialize(root, ['axios']);
  const clientPath = path.join(root, 'src/api/client.ts');
  await writeFile(clientPath, 'user change\n');
  const project = await detectProject(root);
  const plan = await buildLifecyclePlan('update', project, ['axios'], {
    appIntegration: 'manual',
  });

  assert.ok(
    plan.files.some(
      ({ path: filePath, action }) => filePath === 'src/api/client.ts' && action === 'conflict',
    ),
  );
  await assert.rejects(executeLifecyclePlan(plan, '2.0.0'), LifecycleConflictError);

  await executeLifecyclePlan(plan, '2.0.0', { force: true });
  assert.notEqual(await readFile(clientPath, 'utf8'), 'user change\n');
  assert.equal((await readManifest(root)).version, '2.0.0');
});

void test('removes generated files and only dependencies owned by the CLI', async () => {
  const root = await createExpoApp();
  await initialize(root, ['axios', 'tanstack-query']);
  const project = await detectProject(root);
  const modulesAfter = resolveLifecycleModules('remove', ['axios', 'tanstack-query'], ['axios']);
  const plan = await buildLifecyclePlan('remove', project, modulesAfter, {
    appIntegration: 'manual',
  });

  assert.deepEqual(plan.dependencies.remove, ['axios']);
  const result = await executeLifecyclePlan(plan, '2.0.0', {
    commandRunner: packageRunner(root),
  });

  assert.deepEqual(result.removedDependencies, ['axios']);
  await assert.rejects(access(path.join(root, 'src/api/client.ts')));
  await access(path.join(root, 'src/query/queryClient.ts'));
  const manifest = await readManifest(root);
  assert.deepEqual(manifest.modules, ['tanstack-query']);
  assert.deepEqual(manifest.managedDependencies, ['@tanstack/react-query']);
});

void test('preserves dependencies when an older manifest has no ownership metadata', async () => {
  const root = await createExpoApp();
  await initialize(root, ['axios']);
  const manifest = await readManifest(root);
  delete manifest.managedDependencies;
  await writeFile(path.join(root, '.bink-rn-stack.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const plan = await buildLifecyclePlan('remove', await detectProject(root), [], {
    appIntegration: 'manual',
  });

  assert.deepEqual(plan.dependencies.remove, []);
  assert.match(plan.warnings.join('\n'), /predates dependency ownership/u);
  await executeLifecyclePlan(plan, '2.0.0', { commandRunner: packageRunner(root) });
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
  };
  assert.equal(packageJson.dependencies.axios, '*');
});

void test('requires explicit force when removal leaves automatic integrations behind', async () => {
  const root = await createExpoApp();
  await writeFile(
    path.join(root, 'App.tsx'),
    'export default function App() { return <LegacyApp />; }\n',
  );
  await initialize(root, ['tanstack-query'], 'automatic');
  const plan = await buildLifecyclePlan('remove', await detectProject(root), [], {
    appIntegration: 'manual',
  });

  assert.equal(plan.requiresIntegrationCleanup, true);
  await assert.rejects(executeLifecyclePlan(plan, '2.0.0'), LifecycleIntegrationCleanupError);
});

void test('rolls back removed files and package changes when dependency removal fails', async () => {
  const root = await createExpoApp();
  await initialize(root, ['axios', 'tanstack-query']);
  const packageBefore = await readFile(path.join(root, 'package.json'), 'utf8');
  const manifestBefore = await readFile(path.join(root, '.bink-rn-stack.json'), 'utf8');
  const clientBefore = await readFile(path.join(root, 'src/api/client.ts'), 'utf8');
  const plan = await buildLifecyclePlan('remove', await detectProject(root), ['tanstack-query'], {
    appIntegration: 'manual',
  });

  await assert.rejects(
    executeLifecyclePlan(plan, '2.0.0', {
      commandRunner: async (command, args, cwd) => {
        await packageRunner(root)(command, args, cwd);
        if (args[0] === 'remove') throw new Error('simulated removal failure');
      },
    }),
    SetupTransactionError,
  );

  assert.equal(await readFile(path.join(root, 'package.json'), 'utf8'), packageBefore);
  assert.equal(await readFile(path.join(root, '.bink-rn-stack.json'), 'utf8'), manifestBefore);
  assert.equal(await readFile(path.join(root, 'src/api/client.ts'), 'utf8'), clientBefore);
});
