import type { GeneratorFileRecipe, RenderedGeneratorFile } from '@/generators/generator.types.js';
import type { NavigationLibrary } from '@/modules/navigation.types.js';
import type { StackModuleName } from '@/modules/stack-module.types.js';

export interface NavigationGeneratorOptions {
  library: NavigationLibrary;
  selectedModules: readonly StackModuleName[];
  sourceRoot?: string;
}

export interface NavigationFileRecipe extends GeneratorFileRecipe {}

export interface RenderedNavigationFile extends RenderedGeneratorFile {}
