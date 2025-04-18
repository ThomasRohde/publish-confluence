# Project Overview

**Repository Layout**
- **Root**: `package.json`, `tsconfig.json`, `vite.config.ts`, `README.md`, `publish-confluence.json`, `docs/`, `samples/`
- **src/**: core modules (`cli.ts`, `client.ts`, `config.ts`, `publisher.ts`, `utils.ts`, etc.) and `project-templates/` for reusable templates
- **samples/**: multiple demo apps (Vite, Webpack, React, Preact) with their own configs and publish settings
- **docs/**: documentation and templates for Confluence pages and macros

**Major Components**
- **CLI entrypoint (`src/cli.ts`)**: Commander-based interface, loads config, triggers publish workflow
- **ConfluenceClient (`src/client.ts`)**: REST API communication, authentication, error handling
- **Publisher (`src/publisher.ts`)**: file scanning (globby), template rendering (Handlebars), page upsert logic
- **Project templates (`src/project-templates/`)**: predefined setups for different project types
- **Vite config (`vite.config.ts`)**: build settings for bundling assets
- **TypeScript config (`tsconfig.json`)**: ES module, target settings, incremental builds

# Recommendations

## High Priority

### 1. Enable Full TypeScript Strict Mode
**What**: Turn on all `strict` flags in `tsconfig.json`.
**Why**: Catches type errors early, prevents runtime issues, improves code quality.
**How**:
```diff
// tsconfig.json
  {
-   "compilerOptions": {
-     // ...
-   }
+   "compilerOptions": {
+     "strict": true,
+     "noImplicitAny": true,
+     "strictNullChecks": true,
+     "strictFunctionTypes": true,
+     "strictPropertyInitialization": true,
+     "noImplicitThis": true,
+     "alwaysStrict": true,
+     // existing settings
+   }
  }
``` 
<https://www.typescriptlang.org/tsconfig#strict>

### 2. Integrate ESLint + Prettier with Husky Hooks
**What**: Add ESLint and Prettier, enforce via pre-commit hooks.
**Why**: Ensures consistent style, catches lint errors before merging, improves DX.
**How**:
```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier eslint-config-prettier husky lint-staged
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
``` 
.lintstagedrc.json:
```json
{ "src/**/*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"] }
``` 
<https://eslint.org/docs/user-guide/getting-started>

### 3. Audit Dependencies Regularly
**What**: Run `npm audit` or integrate Snyk/GitHub Dependabot.
**Why**: Identifies security vulnerabilities, keeps dependencies up-to-date.
**How**:
```bash
npm audit fix --force
``` 
Enable GitHub Dependabot in repo settings: <https://docs.github.com/en/code-security/dependabot>

## Medium Priority

### 4. Define Path Aliases for Cleaner Imports
**What**: Use `paths` in `tsconfig.json` and `alias` in `vite.config.ts`.
**Why**: Avoids long relative imports, improves readability.
**How**:
```diff
// tsconfig.json
  "compilerOptions": {
+   "baseUrl": "./",
+   "paths": { "@src/*": ["src/*"] }
  }
// vite.config.ts
import path from 'path'
export default defineConfig({
  resolve: {
    alias: { '@src': path.resolve(__dirname, 'src') }
  }
})
``` 
<https://vitejs.dev/config/#resolve-alias>

### 5. Optimize Vite Build for Template Projects
**What**: Enable caching, specify `build.commonjsOptions`, split vendor chunks.
**Why**: Reduces build time, improves bundle performance in demos.
**How**:
```diff
// vite.config.ts
export default defineConfig({
  cacheDir: 'node_modules/.vite',
  build: {
+   rollupOptions: {
+     output: {
+       manualChunks: { vendor: ['react','react-dom'] }
+     }
+   }
  }
})
``` 
<https://vitejs.dev/guide/build.html>

### 6. Add Incremental Builds and Watch Mode for CLI Dev
**What**: Enable `tsc --build --watch` in dev script.
**Why**: Faster iteration by only recompiling changed files.
**How**:
```diff
// package.json
  "scripts": {
-   "dev": "vite build --watch",
+   "dev": "tsc --build --watch; vite build --watch",
    // existing scripts
  }
``` 
<https://www.typescriptlang.org/docs/handbook/project-references.html>

## Low Priority

### 7. Introduce Barrel Files for Cleaner Exports
**What**: Aggregate module exports in `src/index.ts` or per-folder `index.ts`.
**Why**: Simplifies imports, centralizes public API.
**How**:
```ts
// src/index.ts
export * from './cli';
export * from './client';
...  
``` 

### 8. Improve Documentation and Templates
**What**: Add `CONTRIBUTING.md`, issue/PR templates, code-of-conduct.
**Why**: Guides contributors, maintains quality standards.
**How**: Create `.github/CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE.md`, `.github/PULL_REQUEST_TEMPLATE.md`

### 9. Enhance README with Examples and Badges
**What**: Show usage examples, install badges, license badge.
**Why**: Improves first-time developer onboarding.
**How**: Add snippet:
```md
```bash
npm install -g publish-confluence
publish-confluence --help
```
```

# Resources

- **TypeScript**: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html
- **Vite**: https://vitejs.dev/config/
- **ESLint**: https://eslint.org/docs/user-guide/getting-started
- **Prettier**: https://prettier.io/docs/en/index.html
- **Husky**: https://typicode.github.io/husky/
