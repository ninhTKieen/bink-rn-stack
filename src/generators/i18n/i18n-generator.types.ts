import type { ProjectKind } from '@/core/detect-project.types.js';
import type { GeneratorFileRecipe, RenderedGeneratorFile } from '@/generators/generator.types.js';

export interface I18nGeneratorOptions {
  projectKind: Extract<ProjectKind, 'expo' | 'react-native'>;
  sourceRoot?: string;
  storageId?: string;
}

export type I18nFileRecipe = GeneratorFileRecipe;
export type RenderedI18nFile = RenderedGeneratorFile;
