import type {
  CompositionGeneratorOptions,
  RenderedCompositionFile,
} from '@/generators/composition/composition-generator.types.js';
import { normalizeSourceRoot } from '@/generators/generator-path.js';
import type { StackModuleName } from '@/modules/stack-module.types.js';

const DEFAULT_COMPOSITION_SOURCE_ROOT = 'src';
const STATE_MODULES: readonly StackModuleName[] = ['unistyles', 'zustand', 'i18n'];

function renderAppProviders(): string {
  return [
    "import { QueryProvider } from './QueryProvider';",
    "import type { AppProvidersProps } from './AppProviders.types';",
    '',
    'export function AppProviders({ children }: AppProvidersProps) {',
    '  return <QueryProvider>{children}</QueryProvider>;',
    '}',
    '',
  ].join('\n');
}

function renderAppProvidersTypes(): string {
  return [
    "import type { ReactNode } from 'react';",
    '',
    'export interface AppProvidersProps {',
    '  children: ReactNode;',
    '}',
    '',
  ].join('\n');
}

function renderProvidersIndex(): string {
  return [
    "export { AppProviders } from './AppProviders';",
    "export type { AppProvidersProps } from './AppProviders.types';",
    "export { QueryProvider } from './QueryProvider';",
    "export type { QueryProviderProps } from './QueryProvider.types';",
    '',
  ].join('\n');
}

function renderStoresIndex(selectedModules: ReadonlySet<StackModuleName>): string {
  const exports = ["export { appStorage, mmkvStorage } from './mmkvStorage';"];

  if (selectedModules.has('i18n')) {
    exports.push(
      "export { useLanguageStore } from './languageStore';",
      "export type { LanguageState } from './languageStore.types';",
    );
  }

  if (selectedModules.has('unistyles')) {
    exports.push(
      "export { getStoredThemePreference, persistThemePreference } from './themePreference';",
      "export { useThemeStore } from './themeStore';",
      "export type { ThemeState } from './themeStore.types';",
    );
  }

  return `${exports.join('\n')}\n`;
}

export function renderCompositionFoundation(
  options: CompositionGeneratorOptions,
): RenderedCompositionFile[] {
  const sourceRoot = normalizeSourceRoot(options.sourceRoot ?? DEFAULT_COMPOSITION_SOURCE_ROOT);
  const selectedModules = new Set(options.selectedModules);
  const files: RenderedCompositionFile[] = [];

  if (selectedModules.has('tanstack-query')) {
    const requestedBy: StackModuleName[] = ['tanstack-query'];
    files.push(
      {
        path: `${sourceRoot}/providers/AppProviders.tsx`,
        content: renderAppProviders(),
        requestedBy,
      },
      {
        path: `${sourceRoot}/providers/AppProviders.types.ts`,
        content: renderAppProvidersTypes(),
        requestedBy,
      },
      {
        path: `${sourceRoot}/providers/index.ts`,
        content: renderProvidersIndex(),
        requestedBy,
      },
    );
  }

  const selectedStateModules = STATE_MODULES.filter((moduleName) =>
    selectedModules.has(moduleName),
  );
  if (selectedStateModules.length > 0) {
    files.push({
      path: `${sourceRoot}/stores/index.ts`,
      content: renderStoresIndex(selectedModules),
      requestedBy: selectedStateModules,
    });
  }

  return files;
}
