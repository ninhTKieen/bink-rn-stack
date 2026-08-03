import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CommandRunner } from '@/core/dependency-installer.types.js';
import { DependencyInstallationError, installDependencies } from '@/core/dependency-installer.js';
import type { ProjectDetection } from '@/core/detect-project.types.js';

function project(packageManager: ProjectDetection['packageManager']): ProjectDetection {
  return {
    root: '/tmp/example-app',
    name: 'example-app',
    kind: 'expo',
    evidence: ['dependency:expo'],
    packageJsonPath: '/tmp/example-app/package.json',
    packageManager,
  };
}

void test('runs the detected package manager in the project root', async () => {
  const calls: Array<{ command: string; args: readonly string[]; cwd: string }> = [];
  const runner: CommandRunner = (command, args, cwd) => {
    calls.push({ command, args, cwd });
    return Promise.resolve();
  };

  const result = await installDependencies(
    project({
      name: 'pnpm',
      source: 'lockfile',
      evidence: ['lockfile:pnpm-lock.yaml'],
      conflictingManagers: [],
    }),
    ['axios', 'zustand'],
    { runner },
  );

  assert.deepEqual(calls, [
    {
      command: 'pnpm',
      args: ['add', 'axios', 'zustand'],
      cwd: '/tmp/example-app',
    },
  ]);
  assert.deepEqual(result.installed, ['axios', 'zustand']);
  assert.equal(result.command?.display, 'pnpm add axios zustand');
});

void test('skips the runner when no dependencies are missing', async () => {
  let called = false;
  const result = await installDependencies(
    project({
      name: 'unknown',
      source: 'none',
      evidence: [],
      conflictingManagers: [],
    }),
    [],
    {
      runner: () => {
        called = true;
        return Promise.resolve();
      },
    },
  );

  assert.equal(called, false);
  assert.deepEqual(result, { installed: [] });
});

void test('rejects missing dependencies when the package manager is unknown', async () => {
  await assert.rejects(
    installDependencies(
      project({
        name: 'unknown',
        source: 'ambiguous',
        evidence: ['lockfile:yarn.lock', 'lockfile:package-lock.json'],
        conflictingManagers: ['npm', 'yarn'],
      }),
      ['axios'],
    ),
    DependencyInstallationError,
  );
});
