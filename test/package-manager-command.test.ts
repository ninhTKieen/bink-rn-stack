import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createPackageInstallCommand,
  createPackageRemoveCommand,
} from '@/core/package-manager-command.js';

const cases = [
  ['npm', 'npm', 'install'],
  ['yarn', 'yarn', 'add'],
  ['pnpm', 'pnpm', 'add'],
  ['bun', 'bun', 'add'],
] as const;

for (const [packageManager, command, action] of cases) {
  void test(`creates the ${packageManager} install command`, () => {
    const result = createPackageInstallCommand(packageManager, ['axios', 'zustand']);

    assert.deepEqual(result, {
      packageManager,
      command,
      args: [action, 'axios', 'zustand'],
      display: `${command} ${action} axios zustand`,
    });
  });
}

const removeCases = [
  ['npm', 'npm', 'uninstall'],
  ['yarn', 'yarn', 'remove'],
  ['pnpm', 'pnpm', 'remove'],
  ['bun', 'bun', 'remove'],
] as const;

for (const [packageManager, command, action] of removeCases) {
  void test(`creates the ${packageManager} remove command`, () => {
    const result = createPackageRemoveCommand(packageManager, ['axios', 'zustand']);

    assert.deepEqual(result, {
      packageManager,
      command,
      args: [action, 'axios', 'zustand'],
      display: `${command} ${action} axios zustand`,
    });
  });
}

void test('does not create a command when every dependency already exists', () => {
  assert.equal(createPackageInstallCommand('yarn', []), undefined);
  assert.equal(createPackageRemoveCommand('yarn', []), undefined);
});
