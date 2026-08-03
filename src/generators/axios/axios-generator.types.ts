import type { GeneratorFileRecipe, RenderedGeneratorFile } from '@/generators/generator.types.js';

export interface AxiosGeneratorOptions {
  sourceRoot?: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
}

export type AxiosFileRecipe = GeneratorFileRecipe;
export type RenderedAxiosFile = RenderedGeneratorFile;
