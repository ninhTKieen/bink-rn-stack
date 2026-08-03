export const DEFAULT_AXIOS_SOURCE_ROOT = 'src';
export const DEFAULT_API_BASE_URL = 'https://api.example.com';
export const DEFAULT_API_TIMEOUT_MS = 15_000;

export const AXIOS_RELATIVE_FILES = [
  'api/config.ts',
  'api/types.ts',
  'api/errors.ts',
  'api/client.ts',
  'api/index.ts',
] as const;

export const AXIOS_GENERATED_FILES = AXIOS_RELATIVE_FILES.map((file) => `src/${file}`);
