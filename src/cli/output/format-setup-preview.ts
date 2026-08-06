import type { SetupPreview } from '@/core/setup-preview.types.js';
import { moduleLabels } from '@/modules/stack-module.js';
import { navigationLabel } from '@/modules/navigation.js';

import { formatFileTree } from '@/cli/output/format-file-tree.js';

function projectLabel(kind: SetupPreview['project']['kind']): string {
  if (kind === 'expo') {
    return 'Expo';
  }

  return kind === 'react-native' ? 'bare React Native' : 'unknown';
}

function packageManagerLabel(preview: SetupPreview): string {
  const { name, version } = preview.project.packageManager;
  const label = name === 'yarn' ? 'Yarn' : name === 'bun' ? 'Bun' : name;
  return `${label}${version === undefined ? '' : ` ${version}`}`;
}

function existingNavigationLabel(preview: SetupPreview): string | undefined {
  const detection = preview.existingNavigation;

  if (detection === undefined || detection.libraries.length === 0) {
    return undefined;
  }

  if (detection.primary !== undefined) {
    return navigationLabel(detection.primary);
  }

  return detection.libraries.map(navigationLabel).join(' and ');
}

function selectedNavigationLabel(preview: SetupPreview): string | undefined {
  if (preview.navigation === undefined) {
    return undefined;
  }

  if (preview.navigation === 'keep') {
    return `Keep existing ${existingNavigationLabel(preview) ?? 'navigation'}`;
  }

  return navigationLabel(preview.navigation);
}

export function formatSetupPreview(preview: SetupPreview): string {
  const navigation = selectedNavigationLabel(preview);
  const existingNavigation = existingNavigationLabel(preview);
  const lines = [
    '',
    'Setup preview',
    '-------------',
    `Project: ${preview.project.name} (${projectLabel(preview.project.kind)})`,
    `Root: ${preview.project.root}`,
    `Package manager: ${packageManagerLabel(preview)}`,
    `Selected modules: ${moduleLabels(preview.selectedModules).join(', ')}`,
    ...(existingNavigation === undefined ? [] : [`Existing navigation: ${existingNavigation}`]),
    ...(navigation === undefined ? [] : [`Navigation: ${navigation}`]),
    `App integration: ${preview.appIntegration === 'automatic' ? 'Automatic' : 'Manual'}`,
    '',
    'Dependencies',
  ];

  for (const dependency of preview.dependencies) {
    lines.push(
      dependency.status === 'existing'
        ? `  = ${dependency.name} (already installed)`
        : `  + ${dependency.name}`,
    );
  }

  lines.push('', 'Generated files');
  lines.push(...formatFileTree(preview.files).map((line) => `  ${line}`));

  lines.push('', 'Install command');
  lines.push(
    preview.installCommand === undefined
      ? '  No dependency install command is required yet.'
      : `  ${preview.installCommand}`,
  );

  if (preview.integrations.length > 0) {
    lines.push('', 'Automatic app integration');
    for (const integration of preview.integrations) {
      const marker =
        integration.status === 'create' ? '+' : integration.status === 'modify' ? '~' : '=';
      const status = integration.status === 'unchanged' ? ' (already integrated)' : '';
      lines.push(`  ${marker} ${integration.path}${status}`);
      integration.descriptions.forEach((description) => lines.push(`    - ${description}`));
    }
  }

  if (preview.integrationSteps.length > 0) {
    lines.push('', 'Manual app integration');
    preview.integrationSteps.forEach((step) => lines.push(`  - ${step}`));
  }

  if (preview.nativeSteps.length > 0) {
    lines.push('', 'Native steps');
    preview.nativeSteps.forEach((step) => lines.push(`  - ${step}`));
  }

  if (preview.warnings.length > 0) {
    lines.push('', 'Warnings');
    preview.warnings.forEach((warning) => lines.push(`  ! ${warning}`));
  }

  return lines.join('\n');
}
