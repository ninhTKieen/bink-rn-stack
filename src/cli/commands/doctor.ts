import type { Command } from 'commander';

import type { DoctorOptions } from '@/cli/commands/doctor.types.js';
import { formatDoctorReport } from '@/cli/output/format-doctor-report.js';
import { doctorProject } from '@/core/doctor.js';
import { detectProject } from '@/core/detect-project.js';

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check the health of an initialized React Native or Expo stack')
    .argument('[path]', 'path to the React Native app', '.')
    .option('--json', 'print the doctor report as JSON')
    .option('--strict', 'treat warnings as a failing result')
    .action(async (targetPath: string, options: DoctorOptions) => {
      const report = await doctorProject(await detectProject(targetPath));

      process.stdout.write(
        options.json === true
          ? `${JSON.stringify(report, null, 2)}\n`
          : `${formatDoctorReport(report)}\n`,
      );

      if (report.summary.errors > 0 || (options.strict === true && report.summary.warnings > 0)) {
        process.exitCode = 1;
      }
    });
}
