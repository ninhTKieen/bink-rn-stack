import {
  AXIOS_RELATIVE_FILES,
  DEFAULT_API_BASE_URL,
  DEFAULT_API_TIMEOUT_MS,
  DEFAULT_AXIOS_SOURCE_ROOT,
} from '@/generators/axios/axios-generator.constants.js';
import type {
  AxiosFileRecipe,
  AxiosGeneratorOptions,
  RenderedAxiosFile,
} from '@/generators/axios/axios-generator.types.js';
import { normalizeSourceRoot } from '@/generators/generator-path.js';
import { renderGeneratorFiles } from '@/generators/template-renderer.js';

function validateTimeout(timeoutMs: number): void {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Axios timeout must be a positive integer: ${timeoutMs}`);
  }
}

export function createAxiosFileRecipes(options: AxiosGeneratorOptions = {}): AxiosFileRecipe[] {
  const sourceRoot = normalizeSourceRoot(options.sourceRoot ?? DEFAULT_AXIOS_SOURCE_ROOT);
  const apiBaseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  validateTimeout(timeoutMs);

  const templates = [
    'axios/config.ts.template',
    'axios/types.ts.template',
    'axios/errors.ts.template',
    'axios/client.ts.template',
    'axios/index.ts.template',
  ] as const;

  return AXIOS_RELATIVE_FILES.map((relativePath, index) => {
    const template = templates[index];

    if (template === undefined) {
      throw new Error(`Missing Axios template for ${relativePath}`);
    }

    return {
      destination: `${sourceRoot}/${relativePath}`,
      template,
      ...(template === 'axios/config.ts.template'
        ? {
            variables: {
              apiBaseUrlLiteral: JSON.stringify(apiBaseUrl),
              timeoutMs: String(timeoutMs),
            },
          }
        : {}),
    };
  });
}

export async function renderAxiosFoundation(
  options: AxiosGeneratorOptions = {},
): Promise<RenderedAxiosFile[]> {
  return await renderGeneratorFiles(createAxiosFileRecipes(options));
}
