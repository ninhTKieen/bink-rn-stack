import { normalizeSourceRoot } from '@/generators/generator-path.js';
import {
  DEFAULT_REACT_HOOK_FORM_SOURCE_ROOT,
  REACT_HOOK_FORM_RELATIVE_FILES,
} from '@/generators/react-hook-form/react-hook-form-generator.constants.js';
import type {
  ReactHookFormFileRecipe,
  ReactHookFormGeneratorOptions,
  RenderedReactHookFormFile,
} from '@/generators/react-hook-form/react-hook-form-generator.types.js';
import { renderGeneratorFiles } from '@/generators/template-renderer.js';

export function createReactHookFormFileRecipes(
  options: ReactHookFormGeneratorOptions = {},
): ReactHookFormFileRecipe[] {
  const sourceRoot = normalizeSourceRoot(options.sourceRoot ?? DEFAULT_REACT_HOOK_FORM_SOURCE_ROOT);
  const templates = [
    'react-hook-form/FormTextInput.tsx.template',
    'react-hook-form/loginForm.ts.template',
    'react-hook-form/index.ts.template',
  ] as const;

  return REACT_HOOK_FORM_RELATIVE_FILES.map((relativePath, index) => {
    const template = templates[index];

    if (template === undefined) {
      throw new Error(`Missing React Hook Form template for ${relativePath}`);
    }

    return {
      destination: `${sourceRoot}/${relativePath}`,
      template,
    };
  });
}

export async function renderReactHookFormFoundation(
  options: ReactHookFormGeneratorOptions = {},
): Promise<RenderedReactHookFormFile[]> {
  return await renderGeneratorFiles(createReactHookFormFileRecipes(options));
}
