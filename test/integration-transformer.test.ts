import assert from 'node:assert/strict';
import { test } from 'node:test';

import { integrateBabelConfig } from '@/integrations/babel-transformer.js';
import { integrateApplicationSource } from '@/integrations/source-transformer.js';

void test('adds root imports and providers idempotently', () => {
  const source = `import { View } from 'react-native';

export default function App() {
  return <View />;
}
`;
  const options = {
    sideEffectImports: ['./src/theme/unistyles', './src/i18n/config'],
    namedImports: [{ source: './src/providers', imported: 'AppProviders' }],
    wrapRootWith: 'AppProviders',
  };

  const first = integrateApplicationSource('App.tsx', source, options);
  const second = integrateApplicationSource('App.tsx', first.content, options);

  assert.equal(first.applied, true);
  assert.match(first.content, /import \{ AppProviders \} from ["']\.\/src\/providers["']/u);
  assert.match(first.content, /import ["']\.\/src\/theme\/unistyles["']/u);
  assert.match(first.content, /import ["']\.\/src\/i18n\/config["']/u);
  assert.match(first.content, /<AppProviders><View \/><\/AppProviders>/u);
  assert.ok(
    first.content.indexOf('./src/theme/unistyles') < first.content.indexOf('./src/providers'),
  );
  assert.equal(second.content, first.content);
});

void test('replaces the root output with RootNavigator', () => {
  const result = integrateApplicationSource(
    'src/App.tsx',
    `const App = () => <LegacyRoot />;\nexport default App;\n`,
    {
      sideEffectImports: [],
      namedImports: [{ source: './navigation', imported: 'RootNavigator' }],
      replaceRootWith: 'RootNavigator',
    },
  );

  assert.equal(result.applied, true);
  assert.match(result.content, /import \{ RootNavigator \} from ["']\.\/navigation["']/u);
  assert.match(result.content, /const App = \(\) => <RootNavigator \/>/u);
  assert.doesNotMatch(result.content, /LegacyRoot/u);
});

void test('leaves source unsupported when no default root component can be identified', () => {
  const source = `export const App = () => <View />;\n`;
  const result = integrateApplicationSource('App.tsx', source, {
    sideEffectImports: [],
    namedImports: [],
    wrapRootWith: 'AppProviders',
  });

  assert.equal(result.applied, false);
  assert.equal(result.content, source);
});

void test('adds Babel preset and Unistyles plugin idempotently', () => {
  const source = `module.exports = function (api) {
  api.cache(true);
  return { presets: [] };
};
`;
  const options = { preset: 'babel-preset-expo', unistylesRoot: 'src' };

  const first = integrateBabelConfig(source, options);
  const second = integrateBabelConfig(first.content, options);

  assert.equal(first.applied, true);
  assert.match(first.content, /presets: \[["']babel-preset-expo["']\]/u);
  assert.match(first.content, /["']react-native-unistyles\/plugin["']/u);
  assert.match(first.content, /root: ["']src["']/u);
  assert.equal(second.content, first.content);
});
