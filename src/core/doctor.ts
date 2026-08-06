import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { CLI_VERSION } from '@/configs/constants.js';
import { detectExistingNavigation } from '@/core/detect-navigation.js';
import type { ProjectDetection } from '@/core/detect-project.types.js';
import type {
  DoctorCheck,
  DoctorReport,
  DoctorSummary,
  TrackedFileAudit,
} from '@/core/doctor.types.js';
import {
  GENERATION_MANIFEST_FILENAME,
  parseGenerationManifest,
} from '@/core/generation-manifest.js';
import type { GenerationManifest } from '@/core/generation-manifest.types.js';
import { getNavigationDefinition } from '@/modules/navigation.js';
import { STACK_MODULES } from '@/modules/stack-module.js';
import type { StackModuleDefinition } from '@/modules/stack-module.types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dependencyNames(value: unknown): string[] {
  return isRecord(value) ? Object.keys(value) : [];
}

function createCheck(
  id: string,
  status: DoctorCheck['status'],
  title: string,
  message: string,
  details: readonly string[] = [],
): DoctorCheck {
  return { id, status, title, message, details: [...details] };
}

function summarize(checks: readonly DoctorCheck[]): DoctorSummary {
  return {
    passed: checks.filter(({ status }) => status === 'pass').length,
    warnings: checks.filter(({ status }) => status === 'warning').length,
    errors: checks.filter(({ status }) => status === 'error').length,
  };
}

function report(
  project: ProjectDetection,
  checks: DoctorCheck[],
  manifest?: GenerationManifest,
): DoctorReport {
  const summary = summarize(checks);

  return {
    project,
    ...(manifest === undefined ? {} : { manifest }),
    checks,
    summary,
    healthy: summary.errors === 0,
  };
}

function projectCheck(project: ProjectDetection): DoctorCheck {
  if (project.kind === 'unknown') {
    return createCheck(
      'project',
      'error',
      'Project',
      'The target is not recognized as an Expo or bare React Native project.',
    );
  }

  return createCheck(
    'project',
    'pass',
    'Project',
    `${project.kind === 'expo' ? 'Expo' : 'Bare React Native'} project detected.`,
  );
}

function packageManagerCheck(project: ProjectDetection): DoctorCheck {
  const manager = project.packageManager;
  if (manager.name === 'unknown') {
    return createCheck(
      'package-manager',
      'warning',
      'Package manager',
      'No package manager could be identified.',
      manager.evidence,
    );
  }

  if (manager.conflictingManagers.length > 0) {
    return createCheck(
      'package-manager',
      'warning',
      'Package manager',
      `${manager.name} was selected, but conflicting package-manager signals were found.`,
      manager.conflictingManagers,
    );
  }

  const label = manager.name === 'yarn' ? 'Yarn' : manager.name === 'bun' ? 'Bun' : manager.name;
  return createCheck(
    'package-manager',
    'pass',
    'Package manager',
    `${label}${manager.version === undefined ? '' : ` ${manager.version}`} detected.`,
  );
}

async function readManifest(project: ProjectDetection): Promise<{
  manifest?: GenerationManifest;
  check: DoctorCheck;
}> {
  const manifestPath = path.join(project.root, GENERATION_MANIFEST_FILENAME);
  let source: string;

  try {
    source = await readFile(manifestPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        check: createCheck(
          'manifest',
          'error',
          'Setup manifest',
          `No ${GENERATION_MANIFEST_FILENAME} file was found. Run the init command first.`,
        ),
      };
    }

    return {
      check: createCheck(
        'manifest',
        'error',
        'Setup manifest',
        `Could not read ${GENERATION_MANIFEST_FILENAME}: ${(error as Error).message}`,
      ),
    };
  }

  try {
    const manifest = parseGenerationManifest(JSON.parse(source));
    if (manifest === undefined) {
      return {
        check: createCheck(
          'manifest',
          'error',
          'Setup manifest',
          `${GENERATION_MANIFEST_FILENAME} does not have a supported structure.`,
        ),
      };
    }

    return {
      manifest,
      check: createCheck(
        'manifest',
        manifest.modules.length === 0 ? 'warning' : 'pass',
        'Setup manifest',
        manifest.modules.length === 0
          ? 'The setup manifest does not track any supported modules.'
          : `${manifest.modules.length} module${manifest.modules.length === 1 ? '' : 's'} tracked from CLI ${manifest.version}.`,
      ),
    };
  } catch (error) {
    return {
      check: createCheck(
        'manifest',
        'error',
        'Setup manifest',
        `${GENERATION_MANIFEST_FILENAME} is not valid JSON: ${(error as Error).message}`,
      ),
    };
  }
}

function manifestVersionCheck(manifest: GenerationManifest): DoctorCheck {
  return manifest.version === CLI_VERSION
    ? createCheck(
        'manifest-version',
        'pass',
        'CLI version',
        `Manifest and current CLI both use version ${CLI_VERSION}.`,
      )
    : createCheck(
        'manifest-version',
        'warning',
        'CLI version',
        `Manifest was generated by CLI ${manifest.version}; current CLI is ${CLI_VERSION}.`,
      );
}

async function installedDependencies(project: ProjectDetection): Promise<Set<string>> {
  const parsed: unknown = JSON.parse(await readFile(project.packageJsonPath, 'utf8'));
  const packageJson = isRecord(parsed) ? parsed : {};

  return new Set([
    ...dependencyNames(packageJson.dependencies),
    ...dependencyNames(packageJson.devDependencies),
    ...dependencyNames(packageJson.peerDependencies),
    ...dependencyNames(packageJson.optionalDependencies),
  ]);
}

function requiredDependencies(
  project: ProjectDetection,
  manifest: GenerationManifest,
): { dependencies: string[]; navigationError?: DoctorCheck } {
  const dependencies = new Set<string>();
  let navigationError: DoctorCheck | undefined;

  for (const moduleName of manifest.modules) {
    if (moduleName === 'navigation') {
      if (manifest.navigation === undefined) {
        navigationError = createCheck(
          'navigation-manifest',
          'error',
          'Navigation manifest',
          'Navigation is tracked, but the selected navigation library is missing from the manifest.',
        );
      } else {
        getNavigationDefinition(manifest.navigation).dependencies.forEach((name) =>
          dependencies.add(name),
        );
      }
      continue;
    }

    const definition: StackModuleDefinition | undefined = STACK_MODULES.find(
      ({ name }) => name === moduleName,
    );
    if (definition === undefined) {
      continue;
    }

    definition.dependencies.forEach((name) => dependencies.add(name));
    const platformDependencies =
      project.kind === 'expo' ? definition.expoDependencies : definition.reactNativeDependencies;
    platformDependencies?.forEach((name) => dependencies.add(name));
  }

  return {
    dependencies: [...dependencies],
    ...(navigationError === undefined ? {} : { navigationError }),
  };
}

async function dependenciesCheck(
  project: ProjectDetection,
  manifest: GenerationManifest,
): Promise<{ check: DoctorCheck; navigationError?: DoctorCheck }> {
  const required = requiredDependencies(project, manifest);
  const installed = await installedDependencies(project);
  const missing = required.dependencies.filter((name) => !installed.has(name));

  return {
    check:
      missing.length === 0
        ? createCheck(
            'dependencies',
            'pass',
            'Dependencies',
            `${required.dependencies.length} required dependenc${required.dependencies.length === 1 ? 'y is' : 'ies are'} declared.`,
          )
        : createCheck(
            'dependencies',
            'error',
            'Dependencies',
            `${missing.length} required dependenc${missing.length === 1 ? 'y is' : 'ies are'} missing.`,
            missing,
          ),
    ...(required.navigationError === undefined
      ? {}
      : { navigationError: required.navigationError }),
  };
}

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function safeTrackedPath(root: string, filePath: string): string | undefined {
  const absolutePath = path.resolve(root, filePath);
  const relativePath = path.relative(path.resolve(root), absolutePath);

  return relativePath.length > 0 && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
    ? absolutePath
    : undefined;
}

async function auditTrackedFiles(
  root: string,
  trackedFiles: Readonly<Record<string, string>>,
): Promise<TrackedFileAudit> {
  const audit: TrackedFileAudit = {
    total: Object.keys(trackedFiles).length,
    healthy: [],
    missing: [],
    modified: [],
    unsafe: [],
  };

  await Promise.all(
    Object.entries(trackedFiles).map(async ([filePath, expectedHash]) => {
      const absolutePath = safeTrackedPath(root, filePath);
      if (absolutePath === undefined) {
        audit.unsafe.push(filePath);
        return;
      }

      try {
        const content = await readFile(absolutePath, 'utf8');
        audit[hash(content) === expectedHash ? 'healthy' : 'modified'].push(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          audit.missing.push(filePath);
          return;
        }

        audit.modified.push(filePath);
      }
    }),
  );

  audit.healthy.sort();
  audit.missing.sort();
  audit.modified.sort();
  audit.unsafe.sort();
  return audit;
}

function trackedFilesCheck(
  id: string,
  title: string,
  audit: TrackedFileAudit,
  missingStatus: DoctorCheck['status'],
): DoctorCheck {
  if (audit.total === 0) {
    return createCheck(
      id,
      id === 'generated-files' ? 'warning' : 'pass',
      title,
      'No files are tracked in this category.',
    );
  }

  if (audit.unsafe.length > 0) {
    return createCheck(
      id,
      'error',
      title,
      `${audit.unsafe.length} tracked path${audit.unsafe.length === 1 ? ' is' : 's are'} outside the project root.`,
      audit.unsafe,
    );
  }

  if (audit.missing.length > 0) {
    return createCheck(
      id,
      missingStatus,
      title,
      `${audit.missing.length} of ${audit.total} tracked file${audit.total === 1 ? '' : 's'} ${audit.missing.length === 1 ? 'is' : 'are'} missing.`,
      audit.missing,
    );
  }

  if (audit.modified.length > 0) {
    return createCheck(
      id,
      'warning',
      title,
      `${audit.modified.length} of ${audit.total} tracked file${audit.total === 1 ? '' : 's'} ${audit.modified.length === 1 ? 'has' : 'have'} changed since setup.`,
      audit.modified,
    );
  }

  return createCheck(
    id,
    'pass',
    title,
    `${audit.total} tracked file${audit.total === 1 ? ' is' : 's are'} healthy.`,
  );
}

async function navigationCheck(
  project: ProjectDetection,
  manifest: GenerationManifest,
): Promise<DoctorCheck | undefined> {
  if (!manifest.modules.includes('navigation') || manifest.navigation === undefined) {
    return undefined;
  }

  const detection = await detectExistingNavigation(project);
  return detection.libraries.includes(manifest.navigation)
    ? createCheck(
        'navigation',
        'pass',
        'Navigation',
        `${manifest.navigation === 'expo-router' ? 'Expo Router' : 'React Navigation'} is still detected.`,
      )
    : createCheck(
        'navigation',
        'warning',
        'Navigation',
        `${manifest.navigation === 'expo-router' ? 'Expo Router' : 'React Navigation'} is tracked but no longer detected.`,
        Object.values(detection.evidence).flat(),
      );
}

export async function doctorProject(project: ProjectDetection): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [projectCheck(project), packageManagerCheck(project)];

  if (project.kind === 'unknown') {
    return report(project, checks);
  }

  const manifestResult = await readManifest(project);
  checks.push(manifestResult.check);
  if (manifestResult.manifest === undefined) {
    return report(project, checks);
  }

  const manifest = manifestResult.manifest;
  checks.push(manifestVersionCheck(manifest));

  const dependencyResult = await dependenciesCheck(project, manifest);
  if (dependencyResult.navigationError !== undefined) {
    checks.push(dependencyResult.navigationError);
  }
  checks.push(dependencyResult.check);

  const [generatedAudit, integrationAudit, navigation] = await Promise.all([
    auditTrackedFiles(project.root, manifest.files),
    auditTrackedFiles(project.root, manifest.integrations),
    navigationCheck(project, manifest),
  ]);
  checks.push(
    trackedFilesCheck('generated-files', 'Generated files', generatedAudit, 'error'),
    trackedFilesCheck('integrated-files', 'Integrated files', integrationAudit, 'warning'),
  );
  if (navigation !== undefined) {
    checks.push(navigation);
  }

  return report(project, checks, manifest);
}
