import type { SetupPreview } from '@/core/setup-preview.types.js';
import { moduleLabels } from '@/modules/stack-module.js';

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

export function formatSetupPreview(preview: SetupPreview): string {
  const lines = [
    '',
    'Setup preview',
    '-------------',
    `Project: ${preview.project.name} (${projectLabel(preview.project.kind)})`,
    `Root: ${preview.project.root}`,
    `Package manager: ${packageManagerLabel(preview)}`,
    `Selected modules: ${moduleLabels(preview.selectedModules).join(', ')}`,
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

  if (preview.integrationSteps.length > 0) {
    lines.push('', 'App integration');
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
