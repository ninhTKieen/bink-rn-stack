import { select } from '@inquirer/prompts';

import type { ExistingNavigationDetection } from '@/core/detect-navigation.types.js';
import type { ProjectKind } from '@/core/detect-project.types.js';
import {
  isNavigationStrategy,
  navigationLabel,
  NAVIGATION_STRATEGIES,
} from '@/modules/navigation.js';
import type { NavigationLibrary, NavigationStrategy } from '@/modules/navigation.types.js';
import type { StackModuleName } from '@/modules/stack-module.types.js';

export class NavigationSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NavigationSelectionError';
  }
}

export function parseNavigationOption(value: string): NavigationStrategy {
  const normalizedValue = value.trim().toLowerCase();

  if (!isNavigationStrategy(normalizedValue)) {
    throw new NavigationSelectionError(
      `Unknown navigation choice: ${value}. Available choices: ${NAVIGATION_STRATEGIES.join(', ')}.`,
    );
  }

  return normalizedValue;
}

function hasExistingNavigation(detection: ExistingNavigationDetection): boolean {
  return detection.libraries.length > 0;
}

function detectedNavigationLabel(detection: ExistingNavigationDetection): string {
  if (detection.primary !== undefined) {
    return navigationLabel(detection.primary);
  }

  return detection.libraries.map(navigationLabel).join(' and ');
}

function navigationChoices(
  projectKind: Extract<ProjectKind, 'expo' | 'react-native'>,
  detection: ExistingNavigationDetection,
): Array<{
  name: string;
  value: NavigationStrategy;
  description: string;
}> {
  const existing = new Set(detection.libraries);
  const choices: Array<{
    name: string;
    value: NavigationStrategy;
    description: string;
  }> = [
    {
      name: `Keep existing ${detectedNavigationLabel(detection)}`,
      value: 'keep',
      description: 'Preserve existing navigation dependencies and source files',
    },
  ];
  const libraries: NavigationLibrary[] =
    projectKind === 'expo' ? ['expo-router', 'react-navigation'] : ['react-navigation'];

  for (const library of libraries) {
    choices.push({
      name: `${existing.has(library) ? 'Regenerate' : 'Switch to'} ${navigationLabel(library)}`,
      value: library,
      description: 'Requires --force and may require manual cleanup of the previous setup',
    });
  }

  return choices;
}

export async function selectNavigationLibrary(
  projectKind: Extract<ProjectKind, 'expo' | 'react-native'>,
  selectedModules: readonly StackModuleName[],
  detection: ExistingNavigationDetection,
  requestedLibrary?: string,
): Promise<NavigationStrategy | undefined> {
  const navigationSelected = selectedModules.includes('navigation');

  if (!navigationSelected) {
    if (requestedLibrary !== undefined) {
      throw new NavigationSelectionError(
        'The --navigation option requires navigation to be selected in --modules.',
      );
    }

    return undefined;
  }

  const parsedLibrary =
    requestedLibrary === undefined ? undefined : parseNavigationOption(requestedLibrary);
  const existingNavigation = hasExistingNavigation(detection);

  if (parsedLibrary === 'keep' && !existingNavigation) {
    throw new NavigationSelectionError(
      'The --navigation keep option requires an existing navigation setup.',
    );
  }

  if (projectKind === 'react-native' && parsedLibrary === 'expo-router') {
    throw new NavigationSelectionError(
      'Expo Router can only be selected for an Expo project. Bare React Native uses React Navigation.',
    );
  }

  if (parsedLibrary !== undefined) {
    return parsedLibrary;
  }

  if (existingNavigation) {
    if (process.stdin.isTTY !== true || process.stdout.isTTY !== true) {
      return 'keep';
    }

    return select<NavigationStrategy>({
      message: `Existing navigation detected: ${detectedNavigationLabel(detection)}. What would you like to do?`,
      choices: navigationChoices(projectKind, detection),
    });
  }

  if (projectKind === 'react-native') {
    return 'react-navigation';
  }

  if (process.stdin.isTTY !== true || process.stdout.isTTY !== true) {
    throw new NavigationSelectionError(
      'Selecting navigation for Expo requires a terminal. Pass --navigation react-navigation or --navigation expo-router.',
    );
  }

  return select<NavigationStrategy>({
    message: 'Which navigation library would you like to use?',
    choices: [
      {
        name: 'Expo Router',
        value: 'expo-router',
        description: 'File-based routing designed for Expo applications',
      },
      {
        name: 'React Navigation',
        value: 'react-navigation',
        description: 'Explicit, component-based navigation configuration',
      },
    ],
  });
}
