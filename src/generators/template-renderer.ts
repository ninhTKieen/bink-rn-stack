import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  GeneratorFileRecipe,
  RenderedGeneratorFile,
  TemplateVariables,
} from '@/generators/generator.types.js';

const TEMPLATE_ROOT = fileURLToPath(new URL('../../templates/', import.meta.url));
const TEMPLATE_TOKEN_PATTERN = /\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g;

function resolveTemplatePath(template: string): string {
  const templatePath = path.resolve(TEMPLATE_ROOT, template);
  const relativePath = path.relative(TEMPLATE_ROOT, templatePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Template path must stay inside the templates directory: ${template}`);
  }

  return templatePath;
}

export function renderTemplate(template: string, variables: TemplateVariables = {}): string {
  return template.replace(TEMPLATE_TOKEN_PATTERN, (_token, key: string) => {
    const value = variables[key];

    if (value === undefined) {
      throw new Error(`Missing template variable: ${key}`);
    }

    return value;
  });
}

export async function renderGeneratorFiles(
  recipes: readonly GeneratorFileRecipe[],
): Promise<RenderedGeneratorFile[]> {
  return Promise.all(
    recipes.map(async ({ destination, template, variables }) => {
      const templateContents = await readFile(resolveTemplatePath(template), 'utf8');

      return {
        path: destination,
        content: renderTemplate(templateContents, variables),
      };
    }),
  );
}
