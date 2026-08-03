import { normalizeSourceRoot } from '@/generators/generator-path.js';
import {
  DEFAULT_NAVIGATION_SOURCE_ROOT,
  EXPO_ROUTER_RELATIVE_FILES,
  REACT_NAVIGATION_RELATIVE_FILES,
} from '@/generators/navigation/navigation-generator.constants.js';
import type {
  NavigationFileRecipe,
  NavigationGeneratorOptions,
  RenderedNavigationFile,
} from '@/generators/navigation/navigation-generator.types.js';
import { renderGeneratorFiles } from '@/generators/template-renderer.js';

function foundationImports(selectedModules: ReadonlySet<string>): string {
  const imports: string[] = [];

  if (selectedModules.has('unistyles')) {
    imports.push("import '../theme/unistyles';");
  }

  if (selectedModules.has('i18n')) {
    imports.push("import '../i18n/config';");
  }

  return imports.length === 0 ? '' : `${imports.join('\n')}\n\n`;
}

function providerVariables(selectedModules: ReadonlySet<string>): {
  providerImport: string;
  rootReturn: string;
} {
  if (!selectedModules.has('tanstack-query')) {
    return {
      providerImport: '',
      rootReturn: '  return navigator;',
    };
  }

  return {
    providerImport: "import { AppProviders } from '../providers';\n",
    rootReturn: '  return <AppProviders>{navigator}</AppProviders>;',
  };
}

export function createNavigationFileRecipes(
  options: NavigationGeneratorOptions,
): NavigationFileRecipe[] {
  const sourceRoot = normalizeSourceRoot(options.sourceRoot ?? DEFAULT_NAVIGATION_SOURCE_ROOT);
  const selectedModules = new Set(options.selectedModules);
  const commonVariables = {
    foundationImports: foundationImports(selectedModules),
    ...providerVariables(selectedModules),
  };

  if (options.library === 'expo-router') {
    const templates = [
      'navigation/expo-router/layout.tsx.template',
      'navigation/expo-router/index.tsx.template',
    ] as const;

    return EXPO_ROUTER_RELATIVE_FILES.map((relativePath, index) => {
      const template = templates[index];

      if (template === undefined) {
        throw new Error(`Missing Expo Router template for ${relativePath}`);
      }

      return {
        destination: `${sourceRoot}/${relativePath}`,
        template,
        ...(index === 0 ? { variables: commonVariables } : {}),
      };
    });
  }

  const templates = [
    'navigation/react-navigation/RootNavigator.tsx.template',
    'navigation/react-navigation/types.ts.template',
    'navigation/react-navigation/index.ts.template',
    'navigation/react-navigation/HomeScreen.tsx.template',
  ] as const;

  return REACT_NAVIGATION_RELATIVE_FILES.map((relativePath, index) => {
    const template = templates[index];

    if (template === undefined) {
      throw new Error(`Missing React Navigation template for ${relativePath}`);
    }

    return {
      destination: `${sourceRoot}/${relativePath}`,
      template,
      ...(index === 0 ? { variables: commonVariables } : {}),
    };
  });
}

export async function renderNavigationFoundation(
  options: NavigationGeneratorOptions,
): Promise<RenderedNavigationFile[]> {
  return await renderGeneratorFiles(createNavigationFileRecipes(options));
}
