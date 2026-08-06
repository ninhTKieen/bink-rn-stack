import { randomUUID, createHash } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { GenerationManifest } from '@/core/generation-manifest.types.js';
import type { RenderedFoundation } from '@/generators/foundation-renderer.types.js';
import type { IntegrationChange } from '@/integrations/integration.types.js';
import { STACK_MODULE_NAMES } from '@/modules/stack-module.js';
import { isNavigationLibrary } from '@/modules/navigation.js';
import type { StackModuleName } from '@/modules/stack-module.types.js';

export const GENERATION_MANIFEST_FILENAME = '.bink-rn-stack.json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStackModuleName(value: unknown): value is StackModuleName {
  return typeof value === 'string' && STACK_MODULE_NAMES.some((name) => name === value);
}

function parseManifest(value: unknown): GenerationManifest | undefined {
  if (!isRecord(value) || !Array.isArray(value.modules) || !isRecord(value.files)) {
    return undefined;
  }

  const modules = value.modules.filter(isStackModuleName);
  const files = Object.fromEntries(
    Object.entries(value.files).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  const integrations = isRecord(value.integrations)
    ? Object.fromEntries(
        Object.entries(value.integrations).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : {};

  return {
    version: typeof value.version === 'string' ? value.version : 'unknown',
    modules,
    ...(typeof value.navigation === 'string' && isNavigationLibrary(value.navigation)
      ? { navigation: value.navigation }
      : {}),
    files,
    integrations,
  };
}

async function readManifest(manifestPath: string): Promise<GenerationManifest | undefined> {
  try {
    return parseManifest(JSON.parse(await readFile(manifestPath, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }

    return undefined;
  }
}

function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function writeGenerationManifest(
  projectRoot: string,
  foundation: RenderedFoundation,
  integrations: readonly IntegrationChange[],
  version: string,
): Promise<GenerationManifest> {
  const manifestPath = path.join(path.resolve(projectRoot), GENERATION_MANIFEST_FILENAME);
  const existingManifest = await readManifest(manifestPath);
  const modules = STACK_MODULE_NAMES.filter(
    (moduleName) =>
      existingManifest?.modules.includes(moduleName) === true ||
      foundation.selectedModules.includes(moduleName),
  );
  const manifest: GenerationManifest = {
    version,
    modules,
    ...(foundation.navigation === undefined
      ? existingManifest?.navigation === undefined
        ? {}
        : { navigation: existingManifest.navigation }
      : { navigation: foundation.navigation }),
    files: {
      ...(existingManifest?.files ?? {}),
      ...Object.fromEntries(foundation.files.map((file) => [file.path, contentHash(file.content)])),
    },
    integrations: {
      ...(existingManifest?.integrations ?? {}),
      ...Object.fromEntries(
        integrations.map((integration) => [integration.path, contentHash(integration.content)]),
      ),
    },
  };
  const temporaryPath = path.join(
    path.dirname(manifestPath),
    `.${path.basename(manifestPath)}.${process.pid}.${randomUUID()}.tmp`,
  );

  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });

  try {
    await rename(temporaryPath, manifestPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }

  return manifest;
}
