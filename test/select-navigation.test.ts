import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  NavigationSelectionError,
  parseNavigationOption,
  selectNavigationLibrary,
} from '@/cli/prompts/select-navigation.js';
import type { ExistingNavigationDetection } from '@/core/detect-navigation.types.js';

const NO_NAVIGATION: ExistingNavigationDetection = {
  libraries: [],
  evidence: {},
};

const EXPO_ROUTER: ExistingNavigationDetection = {
  libraries: ['expo-router'],
  primary: 'expo-router',
  evidence: { 'expo-router': ['dependency:expo-router'] },
};

void test('parses supported navigation options', () => {
  assert.equal(parseNavigationOption(' React-Navigation '), 'react-navigation');
  assert.equal(parseNavigationOption('EXPO-ROUTER'), 'expo-router');
  assert.equal(parseNavigationOption('keep'), 'keep');
});

void test('rejects an unknown navigation option', () => {
  assert.throws(() => parseNavigationOption('native-navigation'), NavigationSelectionError);
});

void test('defaults bare React Native navigation to React Navigation', async () => {
  assert.equal(
    await selectNavigationLibrary('react-native', ['navigation'], NO_NAVIGATION),
    'react-navigation',
  );
});

void test('rejects Expo Router for bare React Native', async () => {
  await assert.rejects(
    selectNavigationLibrary('react-native', ['navigation'], NO_NAVIGATION, 'expo-router'),
    /Expo Router can only be selected for an Expo project/u,
  );
});

void test('accepts an explicit Expo navigation selection', async () => {
  assert.equal(
    await selectNavigationLibrary('expo', ['navigation'], NO_NAVIGATION, 'expo-router'),
    'expo-router',
  );
  assert.equal(
    await selectNavigationLibrary('expo', ['navigation'], NO_NAVIGATION, 'react-navigation'),
    'react-navigation',
  );
});

void test('rejects --navigation when navigation is not selected', async () => {
  await assert.rejects(
    selectNavigationLibrary('expo', ['axios'], NO_NAVIGATION, 'expo-router'),
    /requires navigation to be selected/u,
  );
});

void test('keeps detected navigation by default in a non-interactive run', async () => {
  assert.equal(await selectNavigationLibrary('expo', ['navigation'], EXPO_ROUTER), 'keep');
});

void test('rejects keep when no navigation setup exists', async () => {
  await assert.rejects(
    selectNavigationLibrary('expo', ['navigation'], NO_NAVIGATION, 'keep'),
    /requires an existing navigation setup/u,
  );
});
