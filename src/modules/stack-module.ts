import type { StackModuleDefinition, StackModuleName } from '@/modules/stack-module.types.js';

export const STACK_MODULES = [
  {
    name: 'axios',
    label: 'Axios',
    description: 'HTTP client and base API configuration',
  },
  {
    name: 'unistyles',
    label: 'Unistyles',
    description: 'Theming and responsive React Native styles',
  },
  {
    name: 'zustand',
    label: 'Zustand',
    description: 'Lightweight application state management',
  },
  {
    name: 'tanstack-query',
    label: 'TanStack Query',
    description: 'Server-state fetching, caching, and synchronization',
  },
  {
    name: 'i18n',
    label: 'i18n',
    description: 'Localization and language management',
  },
] as const satisfies readonly StackModuleDefinition[];

export const STACK_MODULE_NAMES: readonly StackModuleName[] = STACK_MODULES.map(({ name }) => name);

export function isStackModuleName(value: string): value is StackModuleName {
  return STACK_MODULE_NAMES.some((name) => name === value);
}

export function moduleLabels(moduleNames: readonly StackModuleName[]): string[] {
  const selectedNames = new Set(moduleNames);
  return STACK_MODULES.filter(({ name }) => selectedNames.has(name)).map(({ label }) => label);
}
