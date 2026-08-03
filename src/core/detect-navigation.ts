import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { ExistingNavigationDetection } from '@/core/detect-navigation.types.js';
import type { ProjectDetection } from '@/core/detect-project.types.js';
import type { NavigationLibrary } from '@/modules/navigation.types.js';

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const IGNORED_DIRECTORIES = new Set([
  '.expo',
  '.git',
  'android',
  'build',
  'dist',
  'ios',
  'node_modules',
]);
const MAX_SOURCE_FILES = 750;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dependencyNames(value: unknown): string[] {
  return isRecord(value) ? Object.keys(value) : [];
}

async function collectSourceFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    if (files.length >= MAX_SOURCE_FILES) {
      return;
    }

    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= MAX_SOURCE_FILES) {
        return;
      }

      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          await visit(entryPath);
        }
        continue;
      }

      if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(entryPath);
      }
    }
  }

  await Promise.all(
    ['src', 'app', 'navigation', 'routes'].map((directory) => visit(path.join(root, directory))),
  );

  for (const filename of ['App.js', 'App.jsx', 'App.ts', 'App.tsx', 'index.js', 'index.ts']) {
    files.push(path.join(root, filename));
  }

  return [...new Set(files)];
}

async function sourceEvidence(root: string): Promise<{
  expoRouter: string[];
  reactNavigation: string[];
}> {
  const expoRouter: string[] = [];
  const reactNavigation: string[] = [];
  const sourceFiles = await collectSourceFiles(root);

  await Promise.all(
    sourceFiles.map(async (filePath) => {
      try {
        const content = await readFile(filePath, 'utf8');
        const relativePath = path.relative(root, filePath);

        if (
          /from ['"]expo-router(?:\/[^'"]*)?['"]|import ['"]expo-router\/entry['"]/.test(content)
        ) {
          expoRouter.push(`source:${relativePath}`);
        }

        if (/from ['"]@react-navigation\/native['"]|<NavigationContainer(?:\s|>)/.test(content)) {
          reactNavigation.push(`source:${relativePath}`);
        }
      } catch {
        return;
      }
    }),
  );

  return { expoRouter: expoRouter.sort(), reactNavigation: reactNavigation.sort() };
}

export async function detectExistingNavigation(
  project: ProjectDetection,
): Promise<ExistingNavigationDetection> {
  const parsed: unknown = JSON.parse(await readFile(project.packageJsonPath, 'utf8'));
  const packageJson = isRecord(parsed) ? parsed : {};
  const dependencies = new Set([
    ...dependencyNames(packageJson.dependencies),
    ...dependencyNames(packageJson.devDependencies),
    ...dependencyNames(packageJson.peerDependencies),
  ]);
  const evidence: Partial<Record<NavigationLibrary, string[]>> = {};
  const expoRouterEvidence: string[] = [];
  const reactNavigationEvidence: string[] = [];
  const main = typeof packageJson.main === 'string' ? packageJson.main : undefined;

  if (dependencies.has('expo-router')) {
    expoRouterEvidence.push('dependency:expo-router');
  }

  if (main?.includes('expo-router') === true) {
    expoRouterEvidence.push(`package.json#main:${main}`);
  }

  for (const dependency of dependencies) {
    if (dependency.startsWith('@react-navigation/')) {
      reactNavigationEvidence.push(`dependency:${dependency}`);
    }
  }

  const sources = await sourceEvidence(project.root);
  expoRouterEvidence.push(...sources.expoRouter);
  reactNavigationEvidence.push(...sources.reactNavigation);

  if (expoRouterEvidence.length > 0) {
    evidence['expo-router'] = [...new Set(expoRouterEvidence)];
  }

  if (reactNavigationEvidence.length > 0) {
    evidence['react-navigation'] = [...new Set(reactNavigationEvidence)];
  }

  const libraries: NavigationLibrary[] = [];
  if (evidence['expo-router'] !== undefined) {
    libraries.push('expo-router');
  }
  if (evidence['react-navigation'] !== undefined) {
    libraries.push('react-navigation');
  }

  const primary =
    main?.includes('expo-router') === true
      ? 'expo-router'
      : libraries.length === 1
        ? libraries[0]
        : undefined;

  return {
    libraries,
    ...(primary === undefined ? {} : { primary }),
    evidence,
  };
}
