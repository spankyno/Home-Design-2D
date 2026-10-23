# Deploy on Cloudflare Pages

## Previous failures (fixed)

1. **bun instead of pnpm** → force pnpm via build command + `packageManager`.
2. **`@scalar/types@0.25.0` 404** → override to `0.24.0`.
3. **ECONNRESET to `http://35.245.43.102/npm/...`** → the lockfile was generated on **Replit** and hardcoded Replit’s private npm mirror. Cloudflare cannot reach it. Lockfile tarball URLs were stripped; `.npmrc` forces `https://registry.npmjs.org/`.

## Pages settings

| Setting | Value |
|---------|--------|
| Framework preset | Vite |
| **Build command** | `corepack enable && corepack prepare pnpm@9.15.9 --activate && pnpm install --filter @workspace/floorplan... && pnpm --filter @workspace/floorplan run build` |
| **Build output directory** | `artifacts/floorplan/dist/public` |
| Root directory | *(empty)* |

### Environment variables

| Name | Value |
|------|--------|
| `NODE_VERSION` | `22` |
| `BASE_PATH` | `/` |
| `SKIP_DEPENDENCY_INSTALL` | `true` |

## Local check

```bash
corepack enable && corepack prepare pnpm@9.15.9 --activate
pnpm install --filter @workspace/floorplan...
BASE_PATH=/ pnpm --filter @workspace/floorplan run build
```
