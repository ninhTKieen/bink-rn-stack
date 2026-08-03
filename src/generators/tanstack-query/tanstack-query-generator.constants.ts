export const DEFAULT_TANSTACK_QUERY_SOURCE_ROOT = 'src';

export const TANSTACK_QUERY_RELATIVE_FILES = [
  'query/queryClient.ts',
  'query/index.ts',
  'providers/QueryProvider.tsx',
  'providers/QueryProvider.types.ts',
  'providers/index.ts',
] as const;

export const TANSTACK_QUERY_GENERATED_FILES = TANSTACK_QUERY_RELATIVE_FILES.map(
  (file) => `src/${file}`,
);
