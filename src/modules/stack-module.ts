import type { StackModuleDefinition, StackModuleName } from '@/modules/stack-module.types.js';
import { I18N_GENERATED_FILES } from '@/generators/i18n/i18n-generator.constants.js';

export const STACK_MODULES = [
  {
    name: 'axios',
    label: 'Axios',
    description: 'HTTP client and base API configuration',
    dependencies: ['axios'],
    files: ['src/api/client.ts', 'src/api/index.ts'],
    integrationSteps: [],
  },
  {
    name: 'unistyles',
    label: 'Unistyles',
    description: 'Theming and responsive React Native styles',
    dependencies: [
      'react-native-unistyles',
      'react-native-nitro-modules',
      'react-native-edge-to-edge',
      'react-native-reanimated',
      '@react-native/normalize-colors',
      'zustand',
      'react-native-mmkv',
    ],
    files: [
      'src/theme/unistyles.ts',
      'src/theme/themes.ts',
      'src/theme/types.ts',
      'src/theme/index.ts',
      'src/stores/themeStore.ts',
      'src/stores/index.ts',
      'src/providers/AppProviders.tsx',
      'src/providers/index.ts',
    ],
    integrationSteps: [
      'Import src/theme/unistyles.ts before the application renders.',
      'Wrap the application root with AppProviders.',
      'Apply the required Unistyles Babel configuration.',
    ],
    requiresNativeRebuild: true,
  },
  {
    name: 'zustand',
    label: 'Zustand',
    description: 'Lightweight application state management',
    dependencies: ['zustand', 'react-native-mmkv', 'react-native-nitro-modules'],
    files: ['src/stores/themeStore.ts', 'src/stores/index.ts'],
    integrationSteps: [],
    requiresNativeRebuild: true,
  },
  {
    name: 'tanstack-query',
    label: 'TanStack Query',
    description: 'Server-state fetching, caching, and synchronization',
    dependencies: ['@tanstack/react-query'],
    files: [
      'src/providers/QueryProvider.tsx',
      'src/providers/AppProviders.tsx',
      'src/providers/index.ts',
    ],
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
    files: I18N_GENERATED_FILES,
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
