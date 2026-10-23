# Deploy on Cloudflare Pages

## Cause of the previous build failure

1. Pages ran **`bun install`** instead of **pnpm** (this monorepo is pnpm-only).
2. Transitive dep **`@scalar/types@0.25.0`** has a **404 tarball** on npm (broken publish). Pinned to `0.24.0` in root `package.json`.

## Pages settings (copy exactly)

| Setting | Value |
|---------|--------|
| Framework preset | Vite |
| **Build command** | `corepack enable && corepack prepare pnpm@9.15.9 --activate && pnpm install --filter @workspace/floorplan... && pnpm --filter @workspace/floorplan run build` |
| **Build output directory** | `artifacts/floorplan/dist/public` |
| Root directory | *(leave empty)* |

### Environment variables

| Name | Value |
|------|--------|
| `NODE_VERSION` | `22` |
| `BASE_PATH` | `/` |
| `PNPM_VERSION` | `9.15.9` |

Optional but recommended (disables bun auto-install if your account has it):

| Name | Value |
|------|--------|
| `SKIP_DEPENDENCY_INSTALL` | `true` |

When `SKIP_DEPENDENCY_INSTALL=true`, the **Build command** must install deps itself (the command above already does `pnpm install`).

## Why this build command

- `corepack prepare pnpm@9.15.9` → forces pnpm (never bun/npm).
- `pnpm install --filter @workspace/floorplan...` → installs **only** the floorplan app and its workspace deps (skips `api-spec`/orval and the broken scalar chain when possible).
- Output path matches Vite `build.outDir`.

## After a failed build

1. Update the repo with this fixed `package.json` / `pnpm-workspace.yaml`.
2. In Pages → Settings → Builds: paste the build command above.
3. Retry deployment.

## Local check

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --filter @workspace/floorplan...
BASE_PATH=/ pnpm --filter @workspace/floorplan run build
ls artifacts/floorplan/dist/public
```
