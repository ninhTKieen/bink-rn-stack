import { normalizeSourceRoot } from '@/generators/generator-path.js';
import { renderGeneratorFiles } from '@/generators/template-renderer.js';
import {
  DEFAULT_ZUSTAND_SOURCE_ROOT,
  DEFAULT_ZUSTAND_STORAGE_ID,
  ZUSTAND_RELATIVE_FILES,
} from '@/generators/zustand/zustand-generator.constants.js';
import type {
  RenderedZustandFile,
  ZustandFileRecipe,
  ZustandGeneratorOptions,
} from '@/generators/zustand/zustand-generator.types.js';

export function createZustandFileRecipes(
  options: ZustandGeneratorOptions = {},
): ZustandFileRecipe[] {
  const sourceRoot = normalizeSourceRoot(options.sourceRoot ?? DEFAULT_ZUSTAND_SOURCE_ROOT);
  const storageId = options.storageId ?? DEFAULT_ZUSTAND_STORAGE_ID;

  return ZUSTAND_RELATIVE_FILES.map((relativePath) => ({
    destination: `${sourceRoot}/${relativePath}`,
    template: 'shared/mmkvStorage.ts.template',
    variables: { storageId },
  }));
}

export async function renderZustandFoundation(
  options: ZustandGeneratorOptions = {},
): Promise<RenderedZustandFile[]> {
  return await renderGeneratorFiles(createZustandFileRecipes(options));
}
