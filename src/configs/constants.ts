import { readFileSync } from 'node:fs';

interface CliPackageJson {
  version?: unknown;
}

const packageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as CliPackageJson;

export const CLI_VERSION =
  typeof packageJson.version === 'string' ? packageJson.version : 'unknown';
