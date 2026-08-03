import { renderAxiosFoundation } from '@/generators/axios/axios-generator.js';
import { renderCompositionFoundation } from '@/generators/composition/composition-generator.js';
import type {
  FoundationFileContribution,
  FoundationRenderOptions,
  RenderedFoundation,
  RenderedFoundationFile,
} from '@/generators/foundation-renderer.types.js';
import type { RenderedGeneratorFile } from '@/generators/generator.types.js';
import { renderI18nFoundation } from '@/generators/i18n/i18n-generator.js';
import { renderNavigationFoundation } from '@/generators/navigation/navigation-generator.js';
import { renderTanstackQueryFoundation } from '@/generators/tanstack-query/tanstack-query-generator.js';
import { renderUnistylesFoundation } from '@/generators/unistyles/unistyles-generator.js';
import { renderZustandFoundation } from '@/generators/zustand/zustand-generator.js';
import { STACK_MODULE_NAMES } from '@/modules/stack-module.js';
import type { StackModuleName } from '@/modules/stack-module.types.js';

export class FoundationFileConflictError extends Error {
  readonly path: string;

  constructor(filePath: string) {
    super(`Generators produced different contents for the same file: ${filePath}`);
    this.name = 'FoundationFileConflictError';
    this.path = filePath;
  }
}

export function mergeFoundationFileContributions(
  contributions: readonly FoundationFileContribution[],
): RenderedFoundationFile[] {
  const files = new Map<string, RenderedFoundationFile>();

  for (const contribution of contributions) {
    const existingFile = files.get(contribution.path);

    if (existingFile === undefined) {
      files.set(contribution.path, {
        path: contribution.path,
        content: contribution.content,
        requestedBy: [contribution.requestedBy],
      });
      continue;
    }

    if (existingFile.content !== contribution.content) {
      throw new FoundationFileConflictError(contribution.path);
    }

    if (!existingFile.requestedBy.includes(contribution.requestedBy)) {
      existingFile.requestedBy.push(contribution.requestedBy);
    }
  }

  return [...files.values()];
}

async function renderModuleFoundation(
  moduleName: StackModuleName,
  options: FoundationRenderOptions,
): Promise<RenderedGeneratorFile[]> {
  const sourceRootOption =
    options.sourceRoot === undefined ? {} : { sourceRoot: options.sourceRoot };
  const storageIdOption = options.storageId === undefined ? {} : { storageId: options.storageId };

  switch (moduleName) {
    case 'navigation':
      if (options.preserveNavigation === true) {
        return [];
      }

      if (options.navigation === undefined) {
        throw new Error('A navigation library is required when navigation is selected.');
      }

      return await renderNavigationFoundation({
        library: options.navigation,
        selectedModules: options.selectedModules,
        ...sourceRootOption,
      });
    case 'axios':
      return await renderAxiosFoundation({
        ...sourceRootOption,
        ...(options.apiBaseUrl === undefined ? {} : { apiBaseUrl: options.apiBaseUrl }),
        ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      });
    case 'unistyles':
      return await renderUnistylesFoundation({ ...sourceRootOption, ...storageIdOption });
    case 'zustand':
      return await renderZustandFoundation({ ...sourceRootOption, ...storageIdOption });
    case 'tanstack-query':
      return await renderTanstackQueryFoundation(sourceRootOption);
    case 'i18n':
      return await renderI18nFoundation({
        projectKind: options.projectKind,
        ...sourceRootOption,
        ...storageIdOption,
      });
  }
}

export async function renderSelectedFoundations(
  options: FoundationRenderOptions,
): Promise<RenderedFoundation> {
  const selectedModuleSet = new Set(options.selectedModules);
  const selectedModules = STACK_MODULE_NAMES.filter((moduleName) =>
    selectedModuleSet.has(moduleName),
  );

  if (selectedModules.length !== selectedModuleSet.size) {
    throw new Error('One or more selected modules are not supported.');
  }

  const moduleOutputs = await Promise.all(
    selectedModules.map(async (moduleName) => ({
      moduleName,
      files: await renderModuleFoundation(moduleName, options),
    })),
  );
  const contributions: FoundationFileContribution[] = moduleOutputs.flatMap(
    ({ moduleName, files }) =>
      files.map((file) => ({
        ...file,
        requestedBy: moduleName,
      })),
  );
  const compositionFiles = renderCompositionFoundation({
    selectedModules,
    ...(options.sourceRoot === undefined ? {} : { sourceRoot: options.sourceRoot }),
  });

  for (const file of compositionFiles) {
    for (const requestedBy of file.requestedBy) {
      contributions.push({
        path: file.path,
        content: file.content,
        requestedBy,
      });
    }
  }

  return {
    selectedModules,
    ...(options.navigation === undefined ? {} : { navigation: options.navigation }),
    ...(options.preserveNavigation === true ? { preservedNavigation: true } : {}),
    files: mergeFoundationFileContributions(contributions),
  };
}
