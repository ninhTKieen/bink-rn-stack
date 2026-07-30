# bink-rn-stack

An opinionated setup CLI for React Native and Expo applications.

## Current milestone

The CLI can inspect an application directory and distinguish an Expo app from a bare React Native app. Package installation and source generation will be added in subsequent milestones.

```bash
yarn build
node dist/cli.js init /path/to/your-app
```

For local development:

```bash
yarn dev init /path/to/your-app
```

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
