import type { GeneratorFileRecipe, RenderedGeneratorFile } from '@/generators/generator.types.js';

export interface ZustandGeneratorOptions {
  sourceRoot?: string;
  storageId?: string;
}

export type ZustandFileRecipe = GeneratorFileRecipe;
export type RenderedZustandFile = RenderedGeneratorFile;
