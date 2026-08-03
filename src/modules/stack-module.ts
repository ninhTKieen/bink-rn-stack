import type { StackModuleDefinition, StackModuleName } from '@/modules/stack-module.types.js';

export const STACK_MODULES = [
  {
    name: 'navigation',
    label: 'Navigation',
    description: 'React Navigation or Expo Router application foundation',
    dependencies: [],
    integrationSteps: [],
  },
  {
    name: 'axios',
    label: 'Axios',
    description: 'HTTP client and base API configuration',
    dependencies: ['axios'],
    integrationSteps: [],
  },
  {
    name: 'unistyles',
    label: 'Unistyles',
    description: 'Theming and responsive React Native styles',
    dependencies: [
      'react-native-unistyles',
      'react-native-nitro-modules',
      '@react-native/normalize-colors',
      'zustand',
      'react-native-mmkv',
    ],
    integrationSteps: [
      'Verify React Native 0.78+ or Expo SDK 53+ with the New Architecture enabled.',
      'Import src/theme/unistyles.ts before any StyleSheet.create call.',
      "Add ['react-native-unistyles/plugin', { root: 'src' }] to babel.config.js.",
      'Enable edgeToEdgeEnabled=true when it is not already provided by Expo SDK 54+.',
    ],
    requiresNativeRebuild: true,
  },
  {
    name: 'zustand',
    label: 'Zustand',
    description: 'State management with an MMKV persistence adapter',
    dependencies: ['zustand', 'react-native-mmkv', 'react-native-nitro-modules'],
    integrationSteps: [],
    requiresNativeRebuild: true,
  },
  {
    name: 'tanstack-query',
    label: 'TanStack Query',
    description: 'Server-state fetching, caching, and synchronization',
    dependencies: ['@tanstack/react-query'],
    integrationSteps: ['Wrap the application root with AppProviders.'],
  },
  {
    name: 'i18n',
    label: 'i18n',
    description: 'Localization and language management',
    dependencies: [
      'i18next',
      'react-i18next',
      'zustand',
      'react-native-mmkv',
      'react-native-nitro-modules',
    ],
    expoDependencies: ['expo-localization'],
    reactNativeDependencies: ['react-native-localize'],
    integrationSteps: ['Import src/i18n/config.ts before the application renders.'],
    requiresNativeRebuild: true,
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
