import path from 'node:path';

export function normalizeSourceRoot(sourceRoot: string): string {
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
