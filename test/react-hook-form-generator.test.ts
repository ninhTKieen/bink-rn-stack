import assert from 'node:assert/strict';
import { test } from 'node:test';

import { REACT_HOOK_FORM_GENERATED_FILES } from '@/generators/react-hook-form/react-hook-form-generator.constants.js';
import {
  createReactHookFormFileRecipes,
  renderReactHookFormFoundation,
} from '@/generators/react-hook-form/react-hook-form-generator.js';

void test('renders a typed React Native form field and Zod-backed login form', async () => {
  const files = await renderReactHookFormFoundation();
  const contentsByPath = new Map(files.map(({ path, content }) => [path, content]));

  assert.deepEqual(
    files.map(({ path }) => path),
    REACT_HOOK_FORM_GENERATED_FILES,
  );

  const field = contentsByPath.get('src/forms/fields/FormTextInput.tsx') ?? '';
  assert.match(field, /Controller/);
  assert.match(field, /Control<TFieldValues>/);
  assert.match(field, /name: Path<TFieldValues>/);
  assert.match(field, /onChangeText=\{onChange\}/);
  assert.match(field, /fieldState: \{ error \}/);

  const loginForm = contentsByPath.get('src/forms/login/loginForm.ts') ?? '';
  assert.match(loginForm, /zodResolver\(loginSchema\)/);
  assert.match(loginForm, /email: z\.email/);
  assert.match(loginForm, /type LoginFormValues = z\.infer<typeof loginSchema>/);
  assert.match(loginForm, /useForm<LoginFormValues>/);

  const barrel = contentsByPath.get('src/forms/index.ts') ?? '';
  assert.match(barrel, /export \{ FormTextInput \}/);
  assert.match(barrel, /export \{ loginFormDefaultValues, loginSchema, useLoginForm \}/);
  assert.ok(files.every(({ content }) => !content.includes('{{')));
});

void test('supports a custom relative source root', () => {
  const recipes = createReactHookFormFileRecipes({ sourceRoot: 'app' });

  assert.ok(recipes.every(({ destination }) => destination.startsWith('app/')));
});

void test('rejects source roots outside the target project', () => {
  assert.throws(
    () => createReactHookFormFileRecipes({ sourceRoot: '../outside' }),
    /Source root must be a relative project path/,
  );
});
