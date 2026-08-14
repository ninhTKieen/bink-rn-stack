import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';

import { detectProject } from '@/core/detect-project.js';
import { FoundationWriteConflictError } from '@/core/foundation-writer.js';
import type { GenerationManifest } from '@/core/generation-manifest.types.js';
import {
  executeSetupPlan,
  NavigationReplacementError,
  SetupTransactionError,
} from '@/core/setup-executor.js';
import type { SetupExecutionPhase } from '@/core/setup-executor.types.js';
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

void test('restores package.json and removes a newly created lockfile when installation fails', async () => {
  const root = await createExpoApp({});
  const packageJsonPath = path.join(root, 'package.json');
  const originalPackageJson = await readFile(packageJsonPath, 'utf8');
  const plan = await buildSetupPlan(await detectProject(root), ['axios']);

  await assert.rejects(
    executeSetupPlan(plan, '1.2.3', {
      commandRunner: async () => {
        await writeFile(packageJsonPath, '{"mutated":true}\n');
        await writeFile(path.join(root, 'yarn.lock'), 'mutated lockfile\n');
        throw new Error('package manager failed after mutation');
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof SetupTransactionError);
      assert.equal(error.rollback.failures.length, 0);
      assert.match(error.message, /Project files were rolled back/u);
      return true;
    },
  );

  assert.equal(await readFile(packageJsonPath, 'utf8'), originalPackageJson);
  await assert.rejects(access(path.join(root, 'yarn.lock')));
  await assert.rejects(access(path.join(root, 'src/api/client.ts')));
});

void test('rolls back files after every completed setup phase', async (context) => {
  const phases: SetupExecutionPhase[] = [
    'dependencies-installed',
    'foundations-written',
    'integrations-written',
    'manifest-written',
  ];

  for (const phase of phases) {
    await context.test(phase, async () => {
      const root = await createExpoApp({ '@tanstack/react-query': '^5.0.0' });
      const appPath = path.join(root, 'App.tsx');
      const originalApp = 'export default function App() { return <LegacyApp />; }\n';
      const originalManifest = '{"original":true}\n';
      await writeFile(appPath, originalApp);
      await writeFile(path.join(root, '.bink-rn-stack.json'), originalManifest);
      const plan = await buildSetupPlan(await detectProject(root), ['tanstack-query'], {
        appIntegration: 'automatic',
      });

      await assert.rejects(
        executeSetupPlan(plan, '1.2.3', {
          onPhase: (completedPhase) => {
            if (completedPhase === phase) {
              throw new Error(`failure after ${phase}`);
            }
          },
        }),
        (error: unknown) => {
          assert.ok(error instanceof SetupTransactionError);
          assert.equal(error.rollback.failures.length, 0);
          assert.match(error.message, new RegExp(`failure after ${phase}`));
          return true;
        },
      );

      assert.equal(await readFile(appPath, 'utf8'), originalApp);
      assert.equal(
        await readFile(path.join(root, '.bink-rn-stack.json'), 'utf8'),
        originalManifest,
      );
      for (const file of plan.foundation.files) {
        await assert.rejects(access(path.join(root, file.path)));
      }
    });
  }
});

void test('restores generated files overwritten with force when a later phase fails', async () => {
  const root = await createExpoApp({ axios: '^1.0.0' });
  const clientPath = path.join(root, 'src/api/client.ts');
  const originalClient = 'user-owned client\n';
  await mkdir(path.dirname(clientPath), { recursive: true });
  await writeFile(clientPath, originalClient);
  const plan = await buildSetupPlan(await detectProject(root), ['axios']);

  await assert.rejects(
    executeSetupPlan(plan, '1.2.3', {
      force: true,
      onPhase: (phase) => {
        if (phase === 'foundations-written') {
          throw new Error('failure after overwrite');
        }
      },
    }),
    SetupTransactionError,
  );

  assert.equal(await readFile(clientPath, 'utf8'), originalClient);
  for (const file of plan.foundation.files) {
    if (file.path !== 'src/api/client.ts') {
      await assert.rejects(access(path.join(root, file.path)));
    }
  }
});

void test('records the selected navigation library in the manifest', async () => {
  const root = await createExpoApp({
    'expo-constants': '^1.0.0',
    'expo-linking': '^1.0.0',
    'expo-router': '^1.0.0',
    'expo-status-bar': '^1.0.0',
    'react-native-safe-area-context': '^1.0.0',
    'react-native-screens': '^1.0.0',
  });
  const plan = await buildSetupPlan(await detectProject(root), ['navigation'], {
    navigation: 'expo-router',
  });

  await executeSetupPlan(plan, '1.2.3', { force: true });

  const manifest = JSON.parse(
    await readFile(path.join(root, '.bink-rn-stack.json'), 'utf8'),
  ) as GenerationManifest;
  assert.equal(manifest.navigation, 'expo-router');
  await access(path.join(root, 'src/app/_layout.tsx'));
});

void test('blocks navigation replacement before dependency installation without force', async () => {
  const root = await createExpoApp({ 'expo-router': '^57.0.0' });
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  packageJson.main = 'expo-router/entry';
  await writeFile(path.join(root, 'package.json'), JSON.stringify(packageJson));
  const plan = await buildSetupPlan(await detectProject(root), ['navigation'], {
    navigation: 'react-navigation',
  });
  let installCalls = 0;

  await assert.rejects(
    executeSetupPlan(plan, '1.2.3', {
      commandRunner: () => {
        installCalls += 1;
        return Promise.resolve();
      },
    }),
    NavigationReplacementError,
  );

  assert.equal(installCalls, 0);
  await assert.rejects(access(path.join(root, 'src/navigation/RootNavigator.tsx')));
});
