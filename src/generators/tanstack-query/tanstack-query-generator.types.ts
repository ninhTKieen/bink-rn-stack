import type { GeneratorFileRecipe, RenderedGeneratorFile } from '@/generators/generator.types.js';

export interface TanstackQueryGeneratorOptions {
  sourceRoot?: string;
}

export type TanstackQueryFileRecipe = GeneratorFileRecipe;
export type RenderedTanstackQueryFile = RenderedGeneratorFile;
