import { normalizeSourceRoot } from '@/generators/generator-path.js';
import { renderGeneratorFiles } from '@/generators/template-renderer.js';
import {
  DEFAULT_TANSTACK_QUERY_SOURCE_ROOT,
  TANSTACK_QUERY_RELATIVE_FILES,
} from '@/generators/tanstack-query/tanstack-query-generator.constants.js';
import type {
  RenderedTanstackQueryFile,
  TanstackQueryFileRecipe,
  TanstackQueryGeneratorOptions,
} from '@/generators/tanstack-query/tanstack-query-generator.types.js';

export function createTanstackQueryFileRecipes(
  options: TanstackQueryGeneratorOptions = {},
): TanstackQueryFileRecipe[] {
  const sourceRoot = normalizeSourceRoot(options.sourceRoot ?? DEFAULT_TANSTACK_QUERY_SOURCE_ROOT);
  const templates = [
    'tanstack-query/queryClient.ts.template',
    'tanstack-query/query-index.ts.template',
    'tanstack-query/QueryProvider.tsx.template',
    'tanstack-query/QueryProvider.types.ts.template',
  ] as const;

  return TANSTACK_QUERY_RELATIVE_FILES.map((relativePath, index) => {
    const template = templates[index];

    if (template === undefined) {
      throw new Error(`Missing TanStack Query template for ${relativePath}`);
    }

    return {
      destination: `${sourceRoot}/${relativePath}`,
      template,
    };
  });
}

export async function renderTanstackQueryFoundation(
  options: TanstackQueryGeneratorOptions = {},
): Promise<RenderedTanstackQueryFile[]> {
  return await renderGeneratorFiles(createTanstackQueryFileRecipes(options));
}
