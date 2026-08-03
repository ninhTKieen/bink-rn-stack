export const DEFAULT_I18N_SOURCE_ROOT = 'src';
export const DEFAULT_I18N_STORAGE_ID = 'app-preferences';

export const I18N_RELATIVE_FILES = [
  'i18n/config.ts',
  'i18n/resources.ts',
  'i18n/types.ts',
  'i18n/i18next.d.ts',
  'i18n/locales/en.json',
  'i18n/index.ts',
  'stores/mmkvStorage.ts',
  'stores/languageStore.ts',
] as const;

export const I18N_GENERATED_FILES = I18N_RELATIVE_FILES.map((file) => `src/${file}`);
