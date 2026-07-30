import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export type ProjectKind = 'expo' | 'react-native' | 'unknown';

export interface ProjectDetection {
  root: string;
  name: string;
  kind: ProjectKind;
  evidence: string[];
  packageJsonPath: string;
}

export type ProjectDetectionErrorCode =
  | 'DIRECTORY_NOT_FOUND'
  | 'NOT_A_DIRECTORY'
  | 'PACKAGE_JSON_NOT_FOUND'
  | 'INVALID_PACKAGE_JSON'
  | 'UNSUPPORTED_PROJECT';

export class ProjectDetectionError extends Error {
  readonly code: ProjectDetectionErrorCode;

  constructor(code: ProjectDetectionErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ProjectDetectionError';
    this.code = code;
  }
}

interface PackageJson {
  name?: unknown;
  dependencies?: unknown;
  devDependencies?: unknown;
  peerDependencies?: unknown;
}

type DependencyMap = Record<string, string>;

const EXPO_CONFIG_FILES = [
  'app.config.js',
  'app.config.jsx',
  'app.config.mjs',
  'app.config.cjs',
  'app.config.ts',
  'app.config.tsx',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dependencyMap(value: unknown): DependencyMap {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function collectDependencies(packageJson: PackageJson): DependencyMap {
  return {
    ...dependencyMap(packageJson.peerDependencies),
    ...dependencyMap(packageJson.devDependencies),
    ...dependencyMap(packageJson.dependencies),
  };
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function hasExpoObjectInAppJson(root: string): Promise<boolean> {
  const appJsonPath = path.join(root, 'app.json');

  if (!(await exists(appJsonPath))) {
    return false;
  }

  try {
    const appJson: unknown = JSON.parse(await readFile(appJsonPath, 'utf8'));
    return isRecord(appJson) && isRecord(appJson.expo);
  } catch {
    return false;
  }
}

async function findExpoConfig(root: string): Promise<string | undefined> {
  for (const configFile of EXPO_CONFIG_FILES) {
    if (await exists(path.join(root, configFile))) {
      return configFile;
    }
  }

  return undefined;
}

async function readPackageJson(packageJsonPath: string): Promise<PackageJson> {
  let contents: string;

  try {
    contents = await readFile(packageJsonPath, 'utf8');
  } catch (error) {
    throw new ProjectDetectionError(
      'PACKAGE_JSON_NOT_FOUND',
      `No package.json was found at ${packageJsonPath}. Run this command from a React Native app root or pass its path.`,
      { cause: error },
    );
  }

  try {
    const parsed: unknown = JSON.parse(contents);

    if (!isRecord(parsed)) {
      throw new TypeError('package.json must contain a JSON object.');
    }

    return parsed;
  } catch (error) {
    throw new ProjectDetectionError(
      'INVALID_PACKAGE_JSON',
      `The package.json at ${packageJsonPath} is not valid JSON.`,
      { cause: error },
    );
  }
}

export async function detectProject(targetPath = '.'): Promise<ProjectDetection> {
  const root = path.resolve(targetPath);

  let targetStat;
  try {
    targetStat = await stat(root);
  } catch (error) {
    throw new ProjectDetectionError(
      'DIRECTORY_NOT_FOUND',
      `The target directory does not exist: ${root}`,
      { cause: error },
    );
  }

  if (!targetStat.isDirectory()) {
    throw new ProjectDetectionError(
      'NOT_A_DIRECTORY',
      `The target path is not a directory: ${root}`,
    );
  }

  const packageJsonPath = path.join(root, 'package.json');
  const packageJson = await readPackageJson(packageJsonPath);
  const dependencies = collectDependencies(packageJson);
  const evidence: string[] = [];

  if (dependencies.expo !== undefined) {
    evidence.push(`dependency:expo@${dependencies.expo}`);
  }

  if (dependencies['react-native'] !== undefined) {
    evidence.push(`dependency:react-native@${dependencies['react-native']}`);
  }

  const appJsonHasExpoObject = await hasExpoObjectInAppJson(root);
  if (appJsonHasExpoObject) {
    evidence.push('config:app.json#expo');
  }

  const expoConfig = await findExpoConfig(root);
  if (expoConfig !== undefined) {
    evidence.push(`config:${expoConfig}`);
  }

  const hasExpoSignal =
    dependencies.expo !== undefined || appJsonHasExpoObject || expoConfig !== undefined;
  const kind: ProjectKind = hasExpoSignal
    ? 'expo'
    : dependencies['react-native'] !== undefined
      ? 'react-native'
      : 'unknown';

  return {
    root,
    name: typeof packageJson.name === 'string' ? packageJson.name : path.basename(root),
    kind,
    evidence,
    packageJsonPath,
  };
}
