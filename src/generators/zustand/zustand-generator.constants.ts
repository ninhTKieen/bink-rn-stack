export const DEFAULT_ZUSTAND_SOURCE_ROOT = 'src';
export const DEFAULT_ZUSTAND_STORAGE_ID = 'app-preferences';

export const ZUSTAND_RELATIVE_FILES = ['stores/mmkvStorage.ts'] as const;

export const ZUSTAND_GENERATED_FILES = ZUSTAND_RELATIVE_FILES.map((file) => `src/${file}`);
