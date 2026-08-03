export const DEFAULT_REACT_HOOK_FORM_SOURCE_ROOT = 'src';

export const REACT_HOOK_FORM_RELATIVE_FILES = [
  'forms/fields/FormTextInput.tsx',
  'forms/login/loginForm.ts',
  'forms/index.ts',
] as const;

export const REACT_HOOK_FORM_GENERATED_FILES = REACT_HOOK_FORM_RELATIVE_FILES.map(
  (file) => `src/${file}`,
);
