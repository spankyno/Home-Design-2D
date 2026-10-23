# Deploy Floor Plan Designer on Cloudflare Pages

Static SPA only (Vite). No email API, no Resend, no Worker required.

## 1. Push to Git

```bash
git init
git add .
git commit -m "Floor plan designer"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

## 2. Cloudflare Pages

1. Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Select the repo.

| Setting | Value |
|---------|--------|
| Framework preset | Vite |
| Build command | `corepack enable && pnpm install && pnpm --filter @workspace/floorplan run build` |
| Build output directory | `artifacts/floorplan/dist/public` |
| Root directory | *(empty)* |

**Environment variables:**

| Name | Value |
|------|--------|
| `NODE_VERSION` | `22` |
| `BASE_PATH` | `/` |

3. **Save and Deploy**.

## 3. Direct upload (no Git)

```bash
corepack enable
pnpm install
export BASE_PATH=/
pnpm --filter @workspace/floorplan run build
npx wrangler pages deploy artifacts/floorplan/dist/public --project-name=floorplan-editor
```

## Notes

- The editor runs entirely in the browser (localStorage). Export PNG / PDF / JSON works client-side.
- `artifacts/api-server` is optional (health check only) and is **not** needed for Pages.
