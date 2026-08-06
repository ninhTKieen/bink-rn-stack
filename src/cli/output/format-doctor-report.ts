import type { DoctorCheck, DoctorReport } from '@/core/doctor.types.js';

function projectLabel(report: DoctorReport): string {
  if (report.project.kind === 'expo') {
    return 'Expo';
  }

  return report.project.kind === 'react-native' ? 'bare React Native' : 'unknown';
}

function checkMarker(check: DoctorCheck): string {
  if (check.status === 'pass') {
    return '✔';
  }

  return check.status === 'warning' ? '!' : '✖';
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = [
    '',
    'Doctor report',
    '-------------',
    `Project: ${report.project.name} (${projectLabel(report)})`,
    `Root: ${report.project.root}`,
    '',
  ];

  for (const check of report.checks) {
    lines.push(`${checkMarker(check)} ${check.title}: ${check.message}`);
    check.details.forEach((detail) => lines.push(`    - ${detail}`));
  }

  lines.push(
    '',
    `Summary: ${report.summary.passed} passed, ${report.summary.warnings} warning${report.summary.warnings === 1 ? '' : 's'}, ${report.summary.errors} error${report.summary.errors === 1 ? '' : 's'}`,
  );

  return lines.join('\n');
}
