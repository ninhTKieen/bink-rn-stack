import type { LifecyclePlan } from '@/core/lifecycle.types.js';
import { moduleLabels } from '@/modules/stack-module.js';

const ACTION_LABELS = {
  add: 'Add',
  update: 'Update',
  remove: 'Remove',
} as const;

const FILE_MARKERS = {
  create: '+',
  update: '~',
  remove: '-',
  unchanged: '=',
  missing: '=',
  conflict: '!',
} as const;

export function formatLifecyclePreview(plan: LifecyclePlan): string {
  const lines = [
    '',
    `${ACTION_LABELS[plan.action]} preview`,
    `${'-'.repeat(ACTION_LABELS[plan.action].length + 8)}`,
    `Project: ${plan.project.name}`,
    `Root: ${plan.project.root}`,
    `Modules before: ${moduleLabels(plan.modulesBefore).join(', ') || 'None'}`,
    `Modules after: ${moduleLabels(plan.modulesAfter).join(', ') || 'None'}`,
    '',
    'Dependencies',
  ];

  if (plan.dependencies.install.length === 0 && plan.dependencies.remove.length === 0) {
    lines.push('  No dependency changes.');
  } else {
    plan.dependencies.install.forEach((dependency) => lines.push(`  + ${dependency}`));
    plan.dependencies.remove.forEach((dependency) => lines.push(`  - ${dependency}`));
  }

  if (plan.dependencies.installCommand !== undefined) {
    lines.push('', 'Install command', `  ${plan.dependencies.installCommand}`);
  }
  if (plan.dependencies.removeCommand !== undefined) {
    lines.push('', 'Remove command', `  ${plan.dependencies.removeCommand}`);
  }

  lines.push('', 'Generated files');
  if (plan.files.length === 0) {
    lines.push('  No generated files.');
  } else {
    plan.files.forEach((file) => {
      const suffix =
        file.action === 'conflict'
          ? ' (conflict)'
          : file.action === 'missing'
            ? ' (already missing)'
            : '';
      lines.push(`  ${FILE_MARKERS[file.action]} ${file.path}${suffix}`);
    });
  }

  if (plan.setup.preview.integrations.length > 0) {
    lines.push('', 'Automatic app integration');
    plan.setup.preview.integrations.forEach((integration) => {
      const marker =
        integration.status === 'create' ? '+' : integration.status === 'modify' ? '~' : '=';
      lines.push(`  ${marker} ${integration.path}`);
    });
  }

  if (plan.setup.preview.integrationSteps.length > 0) {
    lines.push('', 'Manual app integration');
    plan.setup.preview.integrationSteps.forEach((step) => lines.push(`  - ${step}`));
  }
  if (plan.setup.preview.nativeSteps.length > 0) {
    lines.push('', 'Native steps');
    plan.setup.preview.nativeSteps.forEach((step) => lines.push(`  - ${step}`));
  }
  if (plan.warnings.length > 0) {
    lines.push('', 'Warnings');
    plan.warnings.forEach((warning) => lines.push(`  ! ${warning}`));
  }

  return lines.join('\n');
}
