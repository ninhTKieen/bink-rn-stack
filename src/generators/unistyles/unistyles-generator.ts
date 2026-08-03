import { normalizeSourceRoot } from '@/generators/generator-path.js';
import { renderGeneratorFiles } from '@/generators/template-renderer.js';
import {
  DEFAULT_UNISTYLES_SOURCE_ROOT,
  DEFAULT_UNISTYLES_STORAGE_ID,
  UNISTYLES_RELATIVE_FILES,
} from '@/generators/unistyles/unistyles-generator.constants.js';
import type {
  RenderedUnistylesFile,
  UnistylesFileRecipe,
  UnistylesGeneratorOptions,
} from '@/generators/unistyles/unistyles-generator.types.js';

export function createUnistylesFileRecipes(
  options: UnistylesGeneratorOptions = {},
): UnistylesFileRecipe[] {
  const sourceRoot = normalizeSourceRoot(options.sourceRoot ?? DEFAULT_UNISTYLES_SOURCE_ROOT);
  const storageId = options.storageId ?? DEFAULT_UNISTYLES_STORAGE_ID;
  const templates = [
    'unistyles/breakpoints.ts.template',
    'unistyles/themes.ts.template',
    'unistyles/types.ts.template',
    'unistyles/unistyles.d.ts.template',
    'unistyles/unistyles.ts.template',
    'unistyles/index.ts.template',
    'shared/mmkvStorage.ts.template',
    'unistyles/themePreference.ts.template',
    'unistyles/themeStore.ts.template',
  ] as const;

  return UNISTYLES_RELATIVE_FILES.map((relativePath, index) => {
    const template = templates[index];

    if (template === undefined) {
      throw new Error(`Missing Unistyles template for ${relativePath}`);
    }

    return {
      destination: `${sourceRoot}/${relativePath}`,
      template,
      ...(template === 'shared/mmkvStorage.ts.template' ? { variables: { storageId } } : {}),
    };
  });
}

export async function renderUnistylesFoundation(
  options: UnistylesGeneratorOptions = {},
): Promise<RenderedUnistylesFile[]> {
  return await renderGeneratorFiles(createUnistylesFileRecipes(options));
}
