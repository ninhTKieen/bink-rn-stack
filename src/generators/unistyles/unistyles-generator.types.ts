import type { GeneratorFileRecipe, RenderedGeneratorFile } from '@/generators/generator.types.js';

export interface UnistylesGeneratorOptions {
  sourceRoot?: string;
  storageId?: string;
}

export type UnistylesFileRecipe = GeneratorFileRecipe;
export type RenderedUnistylesFile = RenderedGeneratorFile;
