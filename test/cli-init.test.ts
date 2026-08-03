import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
