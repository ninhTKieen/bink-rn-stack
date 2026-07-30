import { checkbox, select } from '@inquirer/prompts';

import { isStackModuleName, STACK_MODULE_NAMES, STACK_MODULES } from '@/modules/stack-module.js';
import type { ModuleSelectionMode, StackModuleName } from '@/modules/stack-module.types.js';

export class ModuleSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModuleSelectionError';
  }
}

export function parseModuleOption(value: string): StackModuleName[] {
  const requestedModules = value
    .split(',')
    .map((moduleName) => moduleName.trim().toLowerCase())
    .filter((moduleName) => moduleName.length > 0);

  if (requestedModules.length === 0) {
    throw new ModuleSelectionError('Select at least one module or use --modules all.');
  }

  if (requestedModules.includes('all')) {
    if (requestedModules.length > 1) {
      throw new ModuleSelectionError('The all option cannot be combined with individual modules.');
    }

    return [...STACK_MODULE_NAMES];
  }

  const invalidModules = requestedModules.filter((moduleName) => !isStackModuleName(moduleName));
  if (invalidModules.length > 0) {
    throw new ModuleSelectionError(
      `Unknown module${invalidModules.length === 1 ? '' : 's'}: ${invalidModules.join(', ')}. Available modules: ${STACK_MODULE_NAMES.join(', ')}.`,
    );
  }

  const selectedModules = new Set(requestedModules as StackModuleName[]);
  return STACK_MODULE_NAMES.filter((moduleName) => selectedModules.has(moduleName));
}

export async function promptForModules(): Promise<StackModuleName[]> {
  if (process.stdin.isTTY !== true || process.stdout.isTTY !== true) {
    throw new ModuleSelectionError(
      `Interactive module selection requires a terminal. Pass --modules all or a comma-separated list of: ${STACK_MODULE_NAMES.join(', ')}.`,
    );
  }

  const selectionMode = await select<ModuleSelectionMode>({
    message: 'Which modules would you like to install?',
    choices: [
      {
        name: 'All modules',
        value: 'all',
        description: 'Install and configure the complete React Native stack',
      },
      {
        name: 'Choose modules',
        value: 'custom',
        description: 'Select one or more modules individually',
      },
    ],
  });

  if (selectionMode === 'all') {
    return [...STACK_MODULE_NAMES];
  }

  return checkbox<StackModuleName>({
    message: 'Select modules to install',
    choices: STACK_MODULES.map(({ name, label, description }) => ({
      name: label,
      value: name,
      description,
    })),
    required: true,
  });
}
