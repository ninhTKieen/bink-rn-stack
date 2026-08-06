import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';

import { detectProject } from '@/core/detect-project.js';
import type { GenerationManifest } from '@/core/generation-manifest.types.js';
import { executeSetupPlan } from '@/core/setup-executor.js';
import { buildSetupPlan } from '@/core/setup-preview.js';
import { IntegrationWriteConflictError } from '@/integrations/integration-writer.js';

const temporaryDirectories: string[] = [];

async function createApp(
  kind: 'expo' | 'react-native',
  appSource = `export default function App() { return <LegacyApp />; }\n`,
): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bink-integration-'));
  temporaryDirectories.push(root);
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify(
      {
        name: 'integration-app',
        packageManager: 'yarn@1.22.22',
        dependencies:
          kind === 'expo'
            ? { expo: '^57.0.0', 'react-native': '0.86.0' }
            : { 'react-native': '0.86.0' },
      },
      null,
      2,
    ),
  );
  await writeFile(path.join(root, 'App.tsx'), appSource);
  return root;
}

void afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

void test('integrates generated React Navigation and Unistyles into a bare app', async () => {
  const root = await createApp('react-native');
  const project = await detectProject(root);
  const plan = await buildSetupPlan(
    project,
    ['navigation', 'unistyles', 'tanstack-query', 'i18n'],
    { navigation: 'react-navigation' },
  );

  assert.ok(
    plan.preview.integrations.some(
      ({ path: filePath, status }) => filePath === 'App.tsx' && status === 'modify',
    ),
  );
  assert.ok(
    plan.preview.integrations.some(
      ({ path: filePath, status }) => filePath === 'babel.config.js' && status === 'create',
    ),
  );
  assert.ok(
    !plan.preview.integrationSteps.includes(
      'Render RootNavigator from the application entry point.',
    ),
  );

  const result = await executeSetupPlan(plan, '1.2.3', {
    commandRunner: () => Promise.resolve(),
  });
  const app = await readFile(path.join(root, 'App.tsx'), 'utf8');
  const babel = await readFile(path.join(root, 'babel.config.js'), 'utf8');
  const manifest = JSON.parse(
    await readFile(path.join(root, '.bink-rn-stack.json'), 'utf8'),
  ) as GenerationManifest;

  assert.match(app, /RootNavigator/u);
  assert.doesNotMatch(app, /LegacyApp/u);
  assert.match(babel, /react-native-unistyles\/plugin/u);
  assert.deepEqual(result.integrations.modified, ['App.tsx']);
  assert.deepEqual(result.integrations.created, ['babel.config.js']);
  assert.match(manifest.integrations['App.tsx'] ?? '', /^[a-f0-9]{64}$/u);

  const repeated = await buildSetupPlan(
    await detectProject(root),
    ['navigation', 'unistyles', 'tanstack-query', 'i18n'],
    { navigation: 'react-navigation' },
  );
  assert.ok(repeated.preview.integrations.every(({ status }) => status === 'unchanged'));
});

void test('configures Expo Router and rebases package changes made during install', async () => {
  const root = await createApp('expo');
  await writeFile(
    path.join(root, 'app.json'),
    JSON.stringify({ expo: { name: 'Integration App', slug: 'integration-app' } }, null, 2),
  );
  await writeFile(path.join(root, 'babel.config.js'), `module.exports = { presets: [] };\n`);
  const plan = await buildSetupPlan(await detectProject(root), ['navigation', 'unistyles'], {
    navigation: 'expo-router',
  });

  assert.deepEqual(
    plan.preview.integrations.map(({ path: filePath }) => filePath),
    ['package.json', 'app.json', 'babel.config.js'],
  );
  assert.ok(!plan.preview.integrationSteps.some((step) => step.includes('expo-router/entry')));

  await executeSetupPlan(plan, '1.2.3', {
    commandRunner: async (_command, _args, cwd) => {
      const packagePath = path.join(cwd, 'package.json');
      const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as {
        dependencies: Record<string, string>;
      };
      packageJson.dependencies['expo-router'] = '^57.0.0';
      await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
    },
  });

  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
    main?: string;
    dependencies: Record<string, string>;
  };
  const appJson = JSON.parse(await readFile(path.join(root, 'app.json'), 'utf8')) as {
    expo: {
      scheme?: string;
      plugins?: unknown[];
      experiments?: { typedRoutes?: boolean };
    };
  };
  const babel = await readFile(path.join(root, 'babel.config.js'), 'utf8');

  assert.equal(packageJson.main, 'expo-router/entry');
  assert.equal(packageJson.dependencies['expo-router'], '^57.0.0');
  assert.equal(appJson.expo.scheme, 'integration-app');
  assert.deepEqual(appJson.expo.plugins, ['expo-router']);
  assert.equal(appJson.expo.experiments?.typedRoutes, true);
  assert.match(babel, /babel-preset-expo/u);
  assert.match(babel, /react-native-unistyles\/plugin/u);
});

void test('integrates selected foundations into an existing Expo Router layout', async () => {
  const root = await createApp('expo');
  const packageJsonPath = path.join(root, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    main?: string;
    dependencies: Record<string, string>;
  };
  packageJson.main = 'expo-router/entry';
  packageJson.dependencies['expo-router'] = '^57.0.0';
  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
  await mkdir(path.join(root, 'src/app'), { recursive: true });
  await writeFile(
    path.join(root, 'src/app/_layout.tsx'),
    `import { Stack } from 'expo-router';\nexport default function Layout() { return <Stack />; }\n`,
  );

  const plan = await buildSetupPlan(
    await detectProject(root),
    ['navigation', 'tanstack-query', 'i18n'],
    { navigation: 'keep' },
  );
  const layout = plan.integrations.find(({ path: filePath }) => filePath === 'src/app/_layout.tsx');

  assert.ok(layout !== undefined);
  assert.match(layout.content, /AppProviders/u);
  assert.match(layout.content, /\.\.\/i18n\/config/u);
  assert.ok(
    !plan.preview.integrationSteps.includes('Wrap the application root with AppProviders.'),
  );
});

void test('aborts when an application file changes after preview', async () => {
  const root = await createApp('expo');
  const plan = await buildSetupPlan(await detectProject(root), ['tanstack-query']);
  await writeFile(path.join(root, 'App.tsx'), `export default function App() { return null; }\n`);
  let installCalls = 0;

  await assert.rejects(
    executeSetupPlan(plan, '1.2.3', {
      commandRunner: () => {
        installCalls += 1;
        return Promise.resolve();
      },
    }),
    IntegrationWriteConflictError,
  );
  assert.equal(installCalls, 0);
});

void test('leaves application files untouched when manual integration is selected', async () => {
  const root = await createApp('expo');
  const before = await readFile(path.join(root, 'App.tsx'), 'utf8');
  const plan = await buildSetupPlan(await detectProject(root), ['tanstack-query', 'i18n'], {
    appIntegration: 'manual',
  });

  assert.equal(plan.preview.appIntegration, 'manual');
  assert.deepEqual(plan.preview.integrations, []);
  assert.deepEqual(plan.integrations, []);
  assert.ok(plan.preview.integrationSteps.includes('Wrap the application root with AppProviders.'));
  assert.ok(
    plan.preview.integrationSteps.includes(
      'Import src/i18n/config.ts before the application renders.',
    ),
  );

  const execution = await executeSetupPlan(plan, '1.2.3', {
    commandRunner: () => Promise.resolve(),
  });

  assert.equal(await readFile(path.join(root, 'App.tsx'), 'utf8'), before);
  assert.deepEqual(execution.integrations, { created: [], modified: [], unchanged: [] });
});
