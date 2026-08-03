import path from 'node:path';

import {
  DEFAULT_I18N_SOURCE_ROOT,
  DEFAULT_I18N_STORAGE_ID,
  I18N_RELATIVE_FILES,
} from '@/generators/i18n/i18n-generator.constants.js';
import type {
  I18nFileRecipe,
  I18nGeneratorOptions,
  RenderedI18nFile,
} from '@/generators/i18n/i18n-generator.types.js';
import { renderGeneratorFiles } from '@/generators/template-renderer.js';

function normalizeSourceRoot(sourceRoot: string): string {
  const normalized = sourceRoot.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');

  if (
    normalized.length === 0 ||
    path.isAbsolute(normalized) ||
    normalized.split('/').includes('..')
  ) {
    throw new Error(`Source root must be a relative project path: ${sourceRoot}`);
  }

  return normalized;
}

export function createI18nFileRecipes(options: I18nGeneratorOptions): I18nFileRecipe[] {
  const sourceRoot = normalizeSourceRoot(options.sourceRoot ?? DEFAULT_I18N_SOURCE_ROOT);
  const storageId = options.storageId ?? DEFAULT_I18N_STORAGE_ID;
  const configTemplate =
    options.projectKind === 'expo'
      ? 'i18n/config.expo.ts.template'
      : 'i18n/config.native.ts.template';
  const templates = [
    configTemplate,
    'i18n/resources.ts.template',
    'i18n/types.ts.template',
    'i18n/i18next.d.ts.template',
    'i18n/locales/en.json.template',
    'i18n/index.ts.template',
    'i18n/mmkvStorage.ts.template',
    'i18n/languageStore.ts.template',
    'i18n/languageStore.types.ts.template',
  ] as const;

  return I18N_RELATIVE_FILES.map((relativePath, index) => {
    const template = templates[index];

    if (template === undefined) {
      throw new Error(`Missing i18n template for ${relativePath}`);
    }

    return {
      destination: `${sourceRoot}/${relativePath}`,
      template,
      ...(template === 'i18n/mmkvStorage.ts.template' ? { variables: { storageId } } : {}),
    };
  });
}

export async function renderI18nFoundation(
  options: I18nGeneratorOptions,
): Promise<RenderedI18nFile[]> {
  return await renderGeneratorFiles(createI18nFileRecipes(options));
}
