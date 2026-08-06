import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { IntegrationChange } from '@/integrations/integration.types.js';
import { isJsonRecord, renderJson } from '@/integrations/json-transformer.js';

async function rebasePackageJson(
  projectRoot: string,
  change: IntegrationChange,
): Promise<IntegrationChange> {
  const before = await readFile(path.join(projectRoot, change.path), 'utf8');
  const current: unknown = JSON.parse(before);
  const desired: unknown = JSON.parse(change.content);

  if (!isJsonRecord(current) || !isJsonRecord(desired)) {
    return change;
  }

  if (typeof desired.main !== 'string' || current.main === desired.main) {
    return { ...change, before, content: before };
  }

  current.main = desired.main;

  return {
    ...change,
    before,
    content: renderJson(before, current),
  };
}

export async function rebaseIntegrationChangesAfterInstall(
  projectRoot: string,
  changes: readonly IntegrationChange[],
): Promise<IntegrationChange[]> {
  return await Promise.all(
    changes.map(async (change) =>
      change.path === 'package.json' ? await rebasePackageJson(projectRoot, change) : change,
    ),
  );
}
