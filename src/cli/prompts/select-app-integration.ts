import { select } from '@inquirer/prompts';

import type { AppIntegrationMode } from '@/integrations/integration.types.js';
import type { StackModuleName } from '@/modules/stack-module.types.js';

const APP_INTEGRATION_MODULES: ReadonlySet<StackModuleName> = new Set([
  'navigation',
  'unistyles',
  'tanstack-query',
  'i18n',
]);

export async function selectAppIntegration(
  selectedModules: readonly StackModuleName[],
  requestedIntegration?: boolean,
): Promise<AppIntegrationMode> {
  if (requestedIntegration !== undefined) {
    return requestedIntegration ? 'automatic' : 'manual';
  }

  if (!selectedModules.some((moduleName) => APP_INTEGRATION_MODULES.has(moduleName))) {
    return 'manual';
  }

  if (process.stdin.isTTY !== true || process.stdout.isTTY !== true) {
    return 'manual';
  }

  return select<AppIntegrationMode>({
    message: 'Automatically integrate the selected foundations into the application?',
    choices: [
      {
        name: 'Yes, integrate automatically',
        value: 'automatic',
        description: 'Preview and apply safe changes to supported application and config files',
      },
      {
        name: 'No, I will integrate manually',
        value: 'manual',
        description: 'Generate foundations and print the required manual integration steps',
      },
    ],
  });
}
