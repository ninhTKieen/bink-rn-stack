import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, test } from 'node:test';

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

async function createExpoApp(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bink-cli-'));
  temporaryDirectories.push(root);
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'cli-app',
      packageManager: 'yarn@1.22.22',
      dependencies: {
        axios: '^1.0.0',
        expo: '^55.0.0',
        'react-native': '0.83.0',
      },
    }),
  );
  return root;
}

async function runInit(root: string, ...options: string[]): Promise<string> {
  const executable = path.join(process.cwd(), 'node_modules/.bin/tsx');
  const { stdout } = await execFileAsync(
    executable,
    ['src/cli.ts', 'init', root, '--modules', 'axios', ...options],
    { cwd: process.cwd() },
  );
  return stdout;
}

async function runAllModulesInit(root: string, ...options: string[]): Promise<string> {
  const executable = path.join(process.cwd(), 'node_modules/.bin/tsx');
  const { stdout } = await execFileAsync(
    executable,
    ['src/cli.ts', 'init', root, '--modules', 'all', ...options],
    { cwd: process.cwd() },
  );
  return stdout;
}

async function runModulesInit(
  root: string,
  modules: string,
  ...options: string[]
): Promise<string> {
  const executable = path.join(process.cwd(), 'node_modules/.bin/tsx');
  const { stdout } = await execFileAsync(
    executable,
    ['src/cli.ts', 'init', root, '--modules', modules, ...options],
    { cwd: process.cwd() },
  );
  return stdout;
}

async function runLifecycle(
  root: string,
  command: 'add' | 'update' | 'remove',
  ...options: string[]
): Promise<string> {
  const executable = path.join(process.cwd(), 'node_modules/.bin/tsx');
  const { stdout } = await execFileAsync(executable, ['src/cli.ts', command, root, ...options], {
    cwd: process.cwd(),
  });
  return stdout;
}

void afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

void test('applies init with --yes and safely recognizes a repeat run', async () => {
  const root = await createExpoApp();

  const firstOutput = await runInit(root, '--yes');
  const secondOutput = await runInit(root, '--yes');

  assert.match(firstOutput, /Applying setup/u);
  assert.match(firstOutput, /Setup complete/u);
  assert.match(firstOutput, /Files created: 5/u);
  assert.match(secondOutput, /Files unchanged: 5/u);
  await access(path.join(root, 'src/api/client.ts'));
  await access(path.join(root, '.bink-rn-stack.json'));
});

void test('keeps --dry-run preview-only even when --yes is present', async () => {
  const root = await createExpoApp();

  const output = await runInit(root, '--dry-run', '--yes');

  assert.match(output, /Dry run complete\. No changes were made\./u);
  await assert.rejects(access(path.join(root, 'src/api/client.ts')));
  await assert.rejects(access(path.join(root, '.bink-rn-stack.json')));
});

void test('keeps the Expo navigation choice when all modules are selected', async () => {
  const root = await createExpoApp();

  const output = await runAllModulesInit(root, '--navigation', 'expo-router', '--dry-run');

  assert.match(
    output,
    /Selected modules: Navigation, Axios, Unistyles, Zustand, React Hook Form \+ Zod, TanStack Query, i18n/u,
  );
  assert.match(output, /Navigation: Expo Router/u);
  assert.match(output, /├── app\//u);
  assert.match(output, /├── forms\//u);
  await assert.rejects(access(path.join(root, 'src/app/_layout.tsx')));
});

void test('preserves detected navigation by default when all modules run non-interactively', async () => {
  const root = await createExpoApp();
  const packageJsonPath = path.join(root, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    main?: string;
    dependencies: Record<string, string>;
  };
  packageJson.main = 'expo-router/entry';
  packageJson.dependencies['expo-router'] = '^57.0.0';
  await writeFile(packageJsonPath, JSON.stringify(packageJson));

  const output = await runAllModulesInit(root, '--dry-run');

  assert.match(output, /Existing navigation: Expo Router/u);
  assert.match(output, /Navigation: Keep existing Expo Router/u);
  assert.doesNotMatch(output, /src\/app\/_layout\.tsx/u);
});

void test('defaults to manual app integration in non-interactive runs', async () => {
  const root = await createExpoApp();
  await writeFile(
    path.join(root, 'App.tsx'),
    `export default function App() { return <LegacyApp />; }\n`,
  );

  const output = await runModulesInit(root, 'tanstack-query', '--dry-run');

  assert.match(output, /App integration: Manual/u);
  assert.match(output, /Manual app integration/u);
  assert.match(output, /Wrap the application root with AppProviders/u);
  assert.doesNotMatch(output, /Automatic app integration/u);
});

void test('previews automatic integration only when explicitly enabled non-interactively', async () => {
  const root = await createExpoApp();
  await writeFile(
    path.join(root, 'App.tsx'),
    `export default function App() { return <LegacyApp />; }\n`,
  );

  const output = await runModulesInit(root, 'tanstack-query', '--integrate', '--dry-run');

  assert.match(output, /App integration: Automatic/u);
  assert.match(output, /Automatic app integration/u);
  assert.match(output, /~ App\.tsx/u);
  assert.doesNotMatch(output, /Manual app integration/u);
});

void test('adds, updates, and removes tracked modules through lifecycle commands', async () => {
  const root = await createExpoApp();
  const packageJsonPath = path.join(root, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    dependencies: Record<string, string>;
  };
  packageJson.dependencies['react-hook-form'] = '^7.0.0';
  packageJson.dependencies.zod = '^4.0.0';
  packageJson.dependencies['@hookform/resolvers'] = '^5.0.0';
  await writeFile(packageJsonPath, JSON.stringify(packageJson));
  await runInit(root, '--yes');

  const addOutput = await runLifecycle(root, 'add', '--modules', 'react-hook-form', '--yes');
  assert.match(addOutput, /Add complete/u);
  assert.match(addOutput, /Modules tracked: 2/u);
  await access(path.join(root, 'src/forms/fields/FormTextInput.tsx'));

  const updateOutput = await runLifecycle(root, 'update', '--yes');
  assert.match(updateOutput, /Update complete/u);

  const removeOutput = await runLifecycle(root, 'remove', '--modules', 'react-hook-form', '--yes');
  assert.match(removeOutput, /Remove complete/u);
  assert.match(removeOutput, /Modules tracked: 1/u);
  await assert.rejects(access(path.join(root, 'src/forms/fields/FormTextInput.tsx')));

  const manifest = JSON.parse(await readFile(path.join(root, '.bink-rn-stack.json'), 'utf8')) as {
    modules: string[];
  };
  assert.deepEqual(manifest.modules, ['axios']);
});
