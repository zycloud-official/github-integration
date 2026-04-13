# github-integration

A Netlify-style deployment platform for yangfrenz.club members, powered by a GitHub App and CapRover. Members connect their GitHub repos, and every push to the default branch automatically builds and deploys their app — no CLI, no credentials to manage.

Deployed at `github-integration.zycloud.space` on the **zycloud** CapRover instance. Member apps are served at `https://{owner}-{repo}.zycloud.space`.

**Package manager: yarn** — use `yarn` for all installs and script runs. Do not use `npm` or `npx`; use `yarn` equivalents instead.

---

## File map

| File | Purpose |
|------|---------|
| `src/index.js` | Express app — middleware and route registration |
| `src/db.js` | Prisma client singleton |
| `src/github.js` | GitHub App instance + `downloadTarball` |
| `src/caprover.js` | CapRover API client (login, create app, upload, SSL) |
| `src/detect.js` | Framework detection → generates `captain-definition` |
| `src/deploy.js` | Deploy pipeline: download → extract → inject → repack → upload |
| `src/routes/webhook.js` | `POST /webhook` — HMAC verify + event handlers |
| `src/routes/auth.js` | `GET /auth/github`, `/auth/callback`, `POST /auth/logout` |
| `src/routes/dashboard.js` | `GET /dashboard` — member apps + deploy status |
| `prisma/schema.prisma` | Production schema (PostgreSQL) |
| `prisma/schema.dev.prisma` | Development schema (SQLite) |
| `scripts/start.sh` | Container entrypoint — runs `prisma db push` then starts server |

---

## Local dev

```bash
cp .env.example .env
yarn install
yarn dev:db:generate   # generate Prisma client from SQLite schema
yarn dev:db:push       # create/sync local DB
yarn dev
```

Use `yarn dev:db:studio` to browse the DB. Use smee.io or ngrok to receive webhooks locally.

---

## Environment variables

| Var | Description |
|-----|-------------|
| `PORT` | Server port (default `3000`) |
| `BASE_URL` | `https://github-integration.zycloud.space` |
| `DATABASE_PROVIDER` | `sqlite` (local) or `postgres` (production) |
| `DATABASE_URL` | SQLite: `file:./data/zycloud.db` — Postgres: full connection string |
| `GITHUB_APP_ID` | Numeric GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY` | PEM private key with literal `\n` for newlines |
| `GITHUB_WEBHOOK_SECRET` | Webhook secret from GitHub App settings |
| `GITHUB_CLIENT_ID` | OAuth client ID |
| `GITHUB_CLIENT_SECRET` | OAuth client secret |
| `GITHUB_APP_SLUG` | App URL slug (e.g. `github-integration`) |
| `CAPROVER_URL` | `https://captain.zycloud.space` |
| `CAPROVER_PASSWORD` | CapRover admin password |

---

## Deploy to zycloud

**One-time CapRover setup:**
1. Create app named `github-integration`
2. Set all env vars above
3. Add persistent volume at `/app/data` (Postgres: skip this)
4. Enable HTTPS

Subsequent deploys: `caprover deploy` CLI, or wire this repo through its own webhook to self-deploy.

> **Note:** `yarn.lock` must be committed before deploying — the Dockerfile uses `--frozen-lockfile`. Run `yarn install` locally to generate it.

---

## Roadmap

- [ ] Web dashboard UI (currently `/dashboard` returns JSON)
- [ ] Build logs streamed to dashboard
- [ ] Branch previews (not just default branch)
- [ ] Delete CapRover app when repo is disconnected
- [ ] Per-member resource quotas on CapRover
- [ ] Custom subdomains under `yangfrenz.club` per member
- [ ] Web-based code editor (github.dev deep link or code-server sidecar)
- [ ] `yangfrenz.club` membership portal integration
