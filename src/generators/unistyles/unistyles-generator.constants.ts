export const DEFAULT_UNISTYLES_SOURCE_ROOT = 'src';
export const DEFAULT_UNISTYLES_STORAGE_ID = 'app-preferences';

export const UNISTYLES_RELATIVE_FILES = [
  'theme/breakpoints.ts',
  'theme/themes.ts',
  'theme/types.ts',
  'theme/unistyles.d.ts',
  'theme/unistyles.ts',
  'theme/index.ts',
  'stores/mmkvStorage.ts',
  'stores/themePreference.ts',
  'stores/themeStore.ts',
  'stores/themeStore.types.ts',
] as const;

export const UNISTYLES_GENERATED_FILES = UNISTYLES_RELATIVE_FILES.map((file) => `src/${file}`);
