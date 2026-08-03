# bink-rn-stack

An opinionated setup CLI for React Native and Expo applications.

## Current milestone

The CLI detects Expo and bare React Native projects, detects their package manager, previews the setup, installs missing dependencies, and writes the selected foundations after confirmation.

```bash
yarn build
node dist/cli.js init /path/to/your-app
```

For local development:

```bash
yarn dev init /path/to/your-app
```

The interactive flow offers either the complete stack or a checkbox list for Axios, Unistyles, Zustand, TanStack Query, and i18n. For non-interactive use, pass all modules or a comma-separated selection:

```bash
yarn dev init /path/to/your-app --modules all
yarn dev init /path/to/your-app --modules axios,zustand,tanstack-query
```

Preview the complete plan without making changes:

```bash
yarn dev init /path/to/your-app --modules all --dry-run
```

Skip the confirmation prompt in scripts or CI:

```bash
yarn dev init /path/to/your-app --modules all --yes
```

Existing files with different content block setup. Review the preview first, then use
`--force` only when you intentionally want the generated version to replace them.

The preview reports dependencies to install or skip, generated-file paths, unchanged files and conflicts, the package-manager command, app integration work, and native rebuild steps. Shared outputs such as MMKV storage are deduplicated, and provider/store barrel files are composed from the selected modules.

Machine-readable output is available with `--json`:

```bash
yarn dev init /path/to/your-app --json
```

Detection gives Expo precedence because Expo projects normally declare both `expo` and `react-native`. It also recognizes the `expo` object in `app.json` and conventional `app.config.*` files.

The same command detects npm, Yarn, pnpm, or Bun from the `packageManager` field or the app's lockfile. If different package-manager lockfiles conflict, the result is reported as ambiguous instead of selecting one silently.

## Development checks

```bash
yarn format
yarn lint
yarn typecheck
yarn test
yarn build
```

Run the full validation pipeline with `yarn validate`.

Internal source imports use the `@/` alias for the `src` directory:

```ts
import { detectProject } from '@/core/detect-project.js';
```

The build rewrites these aliases to Node-compatible relative paths in `dist`.
