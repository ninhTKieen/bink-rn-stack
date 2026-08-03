import type {
  NavigationFoundationDefinition,
  NavigationLibrary,
  NavigationStrategy,
} from '@/modules/navigation.types.js';

export const NAVIGATION_LIBRARIES = ['react-navigation', 'expo-router'] as const;
export const NAVIGATION_STRATEGIES = ['keep', ...NAVIGATION_LIBRARIES] as const;

const REACT_NAVIGATION_DEFINITION: NavigationFoundationDefinition = {
  library: 'react-navigation',
  label: 'React Navigation',
  dependencies: [
    '@react-navigation/native',
    '@react-navigation/native-stack',
    'react-native-screens',
    'react-native-safe-area-context',
  ],
  integrationSteps: [
    'Render RootNavigator from the application entry point.',
    'For bare React Native Android, configure react-native-screens in MainActivity as described by React Navigation.',
  ],
  requiresNativeRebuild: true,
};

const EXPO_ROUTER_DEFINITION: NavigationFoundationDefinition = {
  library: 'expo-router',
  label: 'Expo Router',
  dependencies: [
    'expo-router',
    'react-native-safe-area-context',
    'react-native-screens',
    'expo-linking',
    'expo-constants',
    'expo-status-bar',
  ],
  integrationSteps: [
    "Set package.json main to 'expo-router/entry'.",
    'Add a deep-linking scheme and enable experiments.typedRoutes in the Expo app config.',
    "Ensure babel.config.js uses the 'babel-preset-expo' preset when the file exists.",
    'Run npx expo start --clear after applying the Expo Router configuration.',
  ],
  requiresNativeRebuild: true,
};

export function isNavigationLibrary(value: string): value is NavigationLibrary {
  return NAVIGATION_LIBRARIES.some((library) => library === value);
}

export function isNavigationStrategy(value: string): value is NavigationStrategy {
  return NAVIGATION_STRATEGIES.some((strategy) => strategy === value);
}

export function getNavigationDefinition(
  library: NavigationLibrary,
): NavigationFoundationDefinition {
  return library === 'expo-router' ? EXPO_ROUTER_DEFINITION : REACT_NAVIGATION_DEFINITION;
}

export function navigationLabel(library: NavigationLibrary): string {
  return getNavigationDefinition(library).label;
}
